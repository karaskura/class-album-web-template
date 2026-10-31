import { one, tx } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { sanitizeKey } from '@/lib/storage';

type Item = {
  storageKey?: string;
  thumbKey?: string;
  microKey?: string;
  width?: number;
  height?: number;
  bytes?: number;
  mime?: string;
  takenAt?: string | null;
  description?: string | null;
};

type Body = { albumId?: number | null; items?: Item[] };

/** 上传第三步：图片都传完了，把元数据写进数据库 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as Body;

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new HttpError(400, '没有要登记的照片');
  if (items.length > 60) throw new HttpError(400, '一次最多登记 60 张');

  const albumId = Number.isInteger(body.albumId) && Number(body.albumId) > 0 ? Number(body.albumId) : null;
  if (albumId) {
    const album = await one('select id from albums where id = $1', [albumId]);
    if (!album) throw new HttpError(400, '相册不存在');
  }

  // 先统一校验存储路径，免得脏数据进库
  const prepared = items.map((item) => {
    try {
      return {
        storageKey: sanitizeKey(item.storageKey ?? ''),
        thumbKey: sanitizeKey(item.thumbKey ?? ''),
        microKey: sanitizeKey(item.microKey ?? ''),
        width: Number.isFinite(item.width) ? Math.round(Number(item.width)) : null,
        height: Number.isFinite(item.height) ? Math.round(Number(item.height)) : null,
        bytes: Number.isFinite(item.bytes) ? Math.round(Number(item.bytes)) : null,
        mime: typeof item.mime === 'string' ? item.mime.slice(0, 60) : null,
        takenAt: item.takenAt ? new Date(item.takenAt) : null,
        description:
          typeof item.description === 'string' && item.description.trim()
            ? item.description.trim().slice(0, 500)
            : null,
      };
    } catch {
      throw new HttpError(400, '照片路径不合法');
    }
  });

  await tx(async (client) => {
    for (const photo of prepared) {
      await client.query(
        `insert into photos
           (album_id, uploader_id, storage_key, thumb_key, micro_key,
            width, height, bytes, mime, taken_at, description)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          albumId,
          user.id,
          photo.storageKey,
          photo.thumbKey,
          photo.microKey,
          photo.width,
          photo.height,
          photo.bytes,
          photo.mime,
          photo.takenAt,
          photo.description,
        ],
      );
    }

    // 相册还没有封面的话，拿第一张当封面
    if (albumId) {
      await client.query(
        `update albums
            set cover_photo_id = (
              select id from photos
               where album_id = $1 and status = 'active'
               order by created_at desc
               limit 1
            )
          where id = $1 and cover_photo_id is null`,
        [albumId],
      );
    }
  });

  return Response.json({ ok: true, count: prepared.length });
});
