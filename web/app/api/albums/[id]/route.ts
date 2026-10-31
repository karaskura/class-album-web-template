import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  name?: string;
  description?: string | null;
  eventDate?: string | null;
};

async function resolveAlbumId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId <= 0) throw new HttpError(400, '相册 id 不对');
  const album = await one('select id from albums where id = $1', [albumId]);
  if (!album) throw new HttpError(404, '相册不存在');
  return albumId;
}

/** 改相册信息（管理员） */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const albumId = await resolveAlbumId(ctx);
  const body = (await req.json().catch(() => ({}))) as Body;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(400, '相册名不能是空的');
    if (name.length > 60) throw new HttpError(400, '相册名太长了');
    params.push(name);
    fields.push(`name = $${params.length}`);
  }

  if (body.description !== undefined) {
    const text = String(body.description ?? '').trim().slice(0, 120);
    params.push(text || null);
    fields.push(`description = $${params.length}`);
  }

  if (body.eventDate !== undefined) {
    const raw = String(body.eventDate ?? '').trim();
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(400, '日期格式不对');
    params.push(raw || null);
    fields.push(`event_date = $${params.length}`);
  }

  if (fields.length === 0) throw new HttpError(400, '没有要改的内容');

  params.push(albumId);
  await query(`update albums set ${fields.join(', ')} where id = $${params.length}`, params);

  await audit(admin.id, 'album.update', String(albumId), body);
  return Response.json({ ok: true });
});

/**
 * 删除相册（管理员）。
 * 注意：**里面的照片不会跟着删**，只是变成"未归类"，还能在时间轴里看到。
 * 想连照片一起删，得先把照片删掉或者移走。
 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const albumId = await resolveAlbumId(ctx);

  const countRow = await one<{ n: number }>(
    `select count(*)::int as n from photos where album_id = $1 and status = 'active'`,
    [albumId],
  );

  // 照片先摘出来，别跟着相册一起消失
  await query('update photos set album_id = null where album_id = $1', [albumId]);
  await query('delete from albums where id = $1', [albumId]);

  await audit(admin.id, 'album.delete', String(albumId), { keptPhotos: countRow?.n ?? 0 });

  return Response.json({ ok: true, keptPhotos: countRow?.n ?? 0 });
});
