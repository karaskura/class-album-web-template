import { execFile } from 'node:child_process';
import { copyFile, link, mkdir, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { config } from './config';
import { one, query } from './db';
import { HttpError } from './http';
import { localStoragePath, storage } from './storage';

const execFileAsync = promisify(execFile);

/** 分层阈值（天）：7 天内算新内容，14 天后可以归档 */
export const COLD_DAYS = 7;
export const ARCHIVE_DAYS = 14;

/** 归档包放在照片目录的隔壁 */
export function archiveDir(): string {
  return join(dirname(config.localStorageDir), 'archives');
}

export type TierCounts = {
  fresh: number;
  cold: number;
  archivable: number;
  archivableBytes: number;
  totalActive: number;
};

/** 三层各有多少张 */
export async function tierCounts(): Promise<TierCounts> {
  const row = await one<{
    fresh: number;
    cold: number;
    archivable: number;
    archivable_bytes: string;
    total: number;
  }>(
    `select
       count(*) filter (where created_at >  now() - interval '${COLD_DAYS} days')::int as fresh,
       count(*) filter (where created_at <= now() - interval '${COLD_DAYS} days'
                          and created_at >  now() - interval '${ARCHIVE_DAYS} days')::int as cold,
       count(*) filter (where created_at <= now() - interval '${ARCHIVE_DAYS} days')::int as archivable,
       coalesce(sum(bytes) filter (where created_at <= now() - interval '${ARCHIVE_DAYS} days'), 0)::bigint as archivable_bytes,
       count(*)::int as total
     from photos
     where status = 'active'`,
  );
  return {
    fresh: row?.fresh ?? 0,
    cold: row?.cold ?? 0,
    archivable: row?.archivable ?? 0,
    archivableBytes: Number(row?.archivable_bytes ?? 0),
    totalActive: row?.total ?? 0,
  };
}

export type UploaderGroup = {
  uploader_id: number | null;
  name: string;
  count: number;
  bytes: number;
};

/** 待归档的照片，按上传者分组 */
export async function archivableByUploader(): Promise<UploaderGroup[]> {
  const rows = await query<{ uploader_id: number | null; name: string; count: number; bytes: string }>(
    `select p.uploader_id,
            coalesce(u.name, '已注销的同学') as name,
            count(*)::int as count,
            coalesce(sum(p.bytes), 0)::bigint as bytes
       from photos p
       left join users u on u.id = p.uploader_id
      where p.status = 'active'
        and p.created_at <= now() - interval '${ARCHIVE_DAYS} days'
      group by 1, 2
      order by count desc, name`,
  );
  return rows.map((row) => ({ ...row, bytes: Number(row.bytes) }));
}

export type ArchiveBatch = {
  id: number;
  created_at: string;
  photo_count: number;
  total_bytes: number;
  file_bytes: number | null;
  confirmed_at: string | null;
  note: string | null;
  creator_name: string | null;
  /** 还有多少张照片的文件留在服务器上 */
  remaining: number;
};

export async function listArchiveBatches(): Promise<ArchiveBatch[]> {
  const rows = await query<ArchiveBatch & { total_bytes: string; file_bytes: string | null }>(
    `select a.id, a.created_at, a.photo_count,
            a.total_bytes::bigint as total_bytes,
            a.file_bytes::bigint  as file_bytes,
            a.confirmed_at, a.note,
            u.name as creator_name,
            (select count(*)::int from photos p
              where p.archive_batch = a.id and p.archived_at is not null) as remaining
       from archives a
       left join users u on u.id = a.created_by
      order by a.id desc
      limit 50`,
  );
  return rows.map((row) => ({
    ...row,
    total_bytes: Number(row.total_bytes),
    file_bytes: row.file_bytes === null ? null : Number(row.file_bytes),
  }));
}

/** 把用户名变成安全的文件夹名（挡掉 / \ : 这些） */
function safeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
  return cleaned.slice(0, 40) || '未命名';
}

function photoFileName(photo: { id: number; created_at: Date | string; storage_key: string }): string {
  const ext = photo.storage_key.includes('.') ? photo.storage_key.split('.').pop() : 'webp';
  const date = new Date(photo.created_at).toISOString().slice(0, 10);
  return `${date}_${String(photo.id).padStart(4, '0')}.${ext}`;
}

type ArchivablePhoto = {
  id: number;
  created_at: Date;
  storage_key: string;
  bytes: number | null;
  uploader_name: string;
};

/**
 * 一键归档：
 *  1. 建批次
 *  2. 照片标记为 archived（立刻从网站下架）
 *  3. 把原图按「上传者姓名/日期_编号.webp」组织，打包成一个 zip
 *
 * 注意：这一步**不会删服务器上的照片**，要等管理员确认「已保存到本地」才删。
 */
export async function createArchive(adminId: number, note?: string) {
  const photos = await query<ArchivablePhoto>(
    `select p.id, p.created_at, p.storage_key, p.bytes,
            coalesce(u.name, '已注销的同学') as uploader_name
       from photos p
       left join users u on u.id = p.uploader_id
      where p.status = 'active'
        and p.created_at <= now() - interval '${ARCHIVE_DAYS} days'
      order by p.created_at asc, p.id asc`,
  );

  if (photos.length === 0) {
    throw new HttpError(400, `还没有超过 ${ARCHIVE_DAYS} 天的照片，暂时不用归档`);
  }

  const totalBytes = photos.reduce((sum, p) => sum + Number(p.bytes ?? 0), 0);

  const batch = await one<{ id: number }>(
    `insert into archives (created_by, photo_count, total_bytes, note)
     values ($1, $2, $3, $4) returning id`,
    [adminId, photos.length, totalBytes, note?.trim() || null],
  );
  if (!batch) throw new HttpError(500, '创建归档批次失败');

  await query(
    `update photos set status = 'archived', archived_at = now(), archive_batch = $1
      where id = any($2::bigint[])`,
    [batch.id, photos.map((p) => p.id)],
  );

  let zipBytes = 0;
  let zipPath: string | null = null;
  try {
    const built = await buildZip(batch.id, photos);
    zipPath = built.zipPath;
    zipBytes = built.zipBytes;
    await query(`update archives set file_path = $1, file_bytes = $2 where id = $3`, [
      zipPath,
      zipBytes,
      batch.id,
    ]);
  } catch (err) {
    // 打包失败也要让管理员知道，但照片已经下架了，可以「恢复上架」
    await query(`update archives set note = $1 where id = $2`, [
      `打包失败：${err instanceof Error ? err.message : String(err)}`,
      batch.id,
    ]);
    throw new HttpError(500, `照片已下架，但打包失败：${err instanceof Error ? err.message : err}`);
  }

  return { batchId: batch.id, count: photos.length, totalBytes, zipPath, zipBytes };
}

/** 用硬链接搭一个临时目录，再交给系统 zip 打包（不占额外磁盘、不吃内存） */
async function buildZip(batchId: number, photos: ArchivablePhoto[]) {
  const staging = join(archiveDir(), `.staging-${batchId}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const folders = new Set<string>();

  try {
    for (const photo of photos) {
      const folder = safeFolderName(photo.uploader_name);
      const folderPath = join(staging, folder);
      await mkdir(folderPath, { recursive: true });
      folders.add(folder);

      const target = join(folderPath, photoFileName(photo));
      const localSource = localStoragePath(photo.storage_key);

      if (localSource) {
        try {
          await link(localSource, target); // 硬链接：不占额外空间
        } catch {
          await copyFile(localSource, target);
        }
      } else {
        // OSS 等远程存储：只能下载下来再写
        const object = await storage.readObject(photo.storage_key);
        if (!object) continue;
        await writeFile(target, object.data);
      }
    }

    const zipPath = join(archiveDir(), `班级相册-归档-${batchId}.zip`);
    await rm(zipPath, { force: true });

    const folderList = [...folders];
    // 用文件夹名当参数，zip 包里的目录结构才干净（不会带 ./ 前缀）
    await execFileAsync('zip', ['-r', '-q', '-9', zipPath, ...folderList], { cwd: staging });

    const info = await stat(zipPath);
    return { zipPath, zipBytes: info.size };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** 管理员确认「已经保存到本地」→ 才真正删掉服务器上的照片文件 */
export async function confirmArchive(batchId: number): Promise<{ deletedFiles: number }> {
  const batch = await one<{ id: number; confirmed_at: string | null }>(
    'select id, confirmed_at from archives where id = $1',
    [batchId],
  );
  if (!batch) throw new HttpError(404, '归档批次不存在');
  if (batch.confirmed_at) throw new HttpError(400, '这个批次已经确认过了');

  const photos = await query<{ id: number; storage_key: string; thumb_key: string; micro_key: string }>(
    `select id, storage_key, thumb_key, micro_key
       from photos where archive_batch = $1 and archived_at is not null`,
    [batchId],
  );

  let deleted = 0;
  for (const photo of photos) {
    for (const key of [photo.storage_key, photo.thumb_key, photo.micro_key]) {
      await storage.deleteObject(key).catch(() => {});
      deleted += 1;
    }
  }

  await query(`update photos set archived_at = null where archive_batch = $1`, [batchId]);
  await query(`update archives set confirmed_at = now() where id = $1`, [batchId]);

  return { deletedFiles: deleted };
}

/** 反悔：把这一批恢复到网站上（前提是文件还在） */
export async function restoreArchive(batchId: number): Promise<{ restored: number }> {
  const batch = await one<{ id: number; confirmed_at: string | null }>(
    'select id, confirmed_at from archives where id = $1',
    [batchId],
  );
  if (!batch) throw new HttpError(404, '归档批次不存在');
  if (batch.confirmed_at) {
    throw new HttpError(400, '这批文件的服务器副本已经删掉了，没法恢复上架');
  }

  const result = await query<{ id: number }>(
    `update photos set status = 'active', archived_at = null, archive_batch = null
      where archive_batch = $1 and status = 'archived'
      returning id`,
    [batchId],
  );
  await query('delete from archives where id = $1', [batchId]).catch(() => {});

  return { restored: result.length };
}

/** 删掉已经确认过的归档包本身（腾空间） */
export async function deleteArchiveFile(batchId: number): Promise<void> {
  const batch = await one<{ file_path: string | null; confirmed_at: string | null }>(
    'select file_path, confirmed_at from archives where id = $1',
    [batchId],
  );
  if (!batch) throw new HttpError(404, '归档批次不存在');
  if (!batch.confirmed_at) throw new HttpError(400, '先确认已经保存到本地，才能删除归档包');

  if (batch.file_path) await rm(batch.file_path, { force: true }).catch(() => {});
  await query('update archives set file_path = null, file_bytes = null where id = $1', [batchId]);
}

/** 列出归档目录里剩下的 zip（防止有孤儿文件） */
export async function listArchiveFiles(): Promise<string[]> {
  try {
    const entries = await readdir(archiveDir());
    return entries.filter((name) => name.endsWith('.zip'));
  } catch {
    return [];
  }
}
