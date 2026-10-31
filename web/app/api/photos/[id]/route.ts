import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { filterSensitive } from '@/lib/sensitive';
import { requireUser } from '@/lib/session';
import { storage } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  /** 照片说明。传空字符串 = 清空 */
  description?: string;
  /** 放到哪个相册。传 null = 不放进任何相册 */
  albumId?: number | string | null;
};

async function resolvePhoto(ctx: Ctx) {
  const { id } = await ctx.params;
  const photoId = Number(id);
  if (!Number.isInteger(photoId) || photoId <= 0) throw new HttpError(400, '照片 id 不对');

  const photo = await one<{
    id: number;
    uploader_id: number | null;
    storage_key: string;
    thumb_key: string;
    micro_key: string;
    album_id: number | null;
    description: string | null;
  }>(
    `select id, uploader_id, storage_key, thumb_key, micro_key, album_id, description
       from photos where id = $1 and status = 'active'`,
    [photoId],
  );
  if (!photo) throw new HttpError(404, '照片不存在，或者已经被删掉了');
  return photo;
}

/**
 * 修改照片信息：改说明、换相册。
 * 权限跟上删除一样：上传者本人，或者管理员。
 */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const photo = await resolvePhoto(ctx);

  const isOwner = photo.uploader_id === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) throw new HttpError(403, '只能改自己上传的照片');

  const body = (await req.json().catch(() => ({}))) as Body;
  const fields: string[] = [];
  const params: unknown[] = [];
  const changed: Record<string, unknown> = {};

  if (body.description !== undefined) {
    // 敏感词过滤（2026-10-08）：命中替换成 * 并记审计
    const filtered = filterSensitive(String(body.description ?? '').trim().slice(0, 500));
    if (filtered.hit) {
      await audit(user.id, 'sensitive_filtered', `photo:${photo.id}`, {
        where: 'photo_description',
        words: filtered.words,
      });
    }
    const text = filtered.text;
    params.push(text || null);
    fields.push(`description = $${params.length}`);
    changed.description = text || null;
  }

  if (body.albumId !== undefined) {
    const raw = body.albumId;
    const albumId = raw === null || raw === undefined || raw === '' ? null : Number(raw);

    if (albumId !== null) {
      if (!Number.isInteger(albumId) || albumId <= 0) throw new HttpError(400, '相册 id 不对');
      const album = await one('select id from albums where id = $1', [albumId]);
      if (!album) throw new HttpError(400, '这个相册不存在');
    }
    params.push(albumId);
    fields.push(`album_id = $${params.length}`);
    changed.albumId = albumId;
  }

  if (fields.length === 0) throw new HttpError(400, '没有要改的内容');

  params.push(photo.id);
  await query(`update photos set ${fields.join(', ')} where id = $${params.length}`, params);

  // 换了相册之后，旧相册的封面可能指向这张已经不属于它的照片，清理一下
  if (changed.albumId !== undefined && photo.album_id && photo.album_id !== changed.albumId) {
    await query(
      `update albums set cover_photo_id = null where id = $1 and cover_photo_id = $2`,
      [photo.album_id, photo.id],
    ).catch(() => {});
  }

  // 新相册还没有封面的话，把这张当封面
  if (typeof changed.albumId === 'number') {
    await query(
      `update albums set cover_photo_id = $1
        where id = $2 and (cover_photo_id is null
          or not exists (select 1 from photos p where p.id = cover_photo_id and p.status = 'active'))`,
      [photo.id, changed.albumId],
    ).catch(() => {});
  }

  await audit(user.id, 'photo.update', String(photo.id), changed);
  return Response.json({ ok: true });
});

/**
 * 删除照片。
 *
 * 权限：上传者可以删自己的；管理员可以删任何一张。
 *
 * 做法：数据库里把 status 改成 'deleted'（立刻从所有页面消失），
 *      同时把磁盘/对象存储上的三个文件也删掉——"删除"就该是删除，
 *      不然知道 URL 的人还能把图捞出来。
 *      数据库里留一条 status='deleted' 的记录，方便查是谁删的。
 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const photo = await resolvePhoto(ctx);

  const isOwner = photo.uploader_id === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new HttpError(403, '只能删自己上传的照片');
  }

  // 1. 数据库标记为已删除
  await query(`update photos set status = 'deleted' where id = $1`, [photo.id]);

  // 2. 文件也删掉（失败不影响主流程，最多留个孤儿文件）
  await Promise.all([
    storage.deleteObject(photo.storage_key),
    storage.deleteObject(photo.thumb_key),
    storage.deleteObject(photo.micro_key),
  ]).catch(() => {});

  // 3. 如果这张是某相册的封面，把封面清掉，让它自动选下一张
  await query(`update albums set cover_photo_id = null where cover_photo_id = $1`, [photo.id]).catch(
    () => {},
  );

  await audit(user.id, 'photo.delete', String(photo.id), {
    byAdmin: isAdmin && !isOwner,
    uploaderId: photo.uploader_id,
  });

  return Response.json({ ok: true });
});
