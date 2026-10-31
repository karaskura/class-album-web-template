import { one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireUser } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

async function resolvePhotoId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const photoId = Number(id);
  if (!Number.isInteger(photoId) || photoId <= 0) throw new HttpError(400, '照片 id 不对');
  const photo = await one(`select id from photos where id = $1 and status = 'active'`, [photoId]);
  if (!photo) throw new HttpError(404, '照片不存在或已删除');
  return photoId;
}

async function countLikes(photoId: number): Promise<number> {
  const row = await one<{ count: number }>(
    'select count(*)::int as count from likes where photo_id = $1',
    [photoId],
  );
  return row?.count ?? 0;
}

/** 点赞 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const photoId = await resolvePhotoId(ctx);

  await query(
    'insert into likes (photo_id, user_id) values ($1, $2) on conflict (photo_id, user_id) do nothing',
    [photoId, user.id],
  );

  return Response.json({ ok: true, liked: true, likeCount: await countLikes(photoId) });
});

/** 取消点赞 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const photoId = await resolvePhotoId(ctx);

  await query('delete from likes where photo_id = $1 and user_id = $2', [photoId, user.id]);

  return Response.json({ ok: true, liked: false, likeCount: await countLikes(photoId) });
});
