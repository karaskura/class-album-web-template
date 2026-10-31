import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { one } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

/** 下载归档包（只有管理员能下） */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();

  const { id } = await ctx.params;
  const batchId = Number(id);
  if (!Number.isInteger(batchId) || batchId <= 0) throw new HttpError(400, '批次 id 不对');

  const batch = await one<{ id: number; file_path: string | null; photo_count: number }>(
    'select id, file_path, photo_count from archives where id = $1',
    [batchId],
  );
  if (!batch) throw new HttpError(404, '归档批次不存在');
  if (!batch.file_path) throw new HttpError(404, '这个批次没有归档包了（可能已经删掉）');

  let size = 0;
  try {
    size = (await stat(batch.file_path)).size;
  } catch {
    throw new HttpError(404, '归档包文件不在了');
  }

  const filename = `班级相册-归档-${batchId}（${batch.photo_count}张）.zip`;
  const stream = Readable.toWeb(createReadStream(batch.file_path)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(size),
      // 中文文件名要用 filename* 才不会乱码
      'Content-Disposition': `attachment; filename="class-album-${batchId}.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
});
