import { audit, one } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { filterSensitive } from '@/lib/sensitive';
import { requireAdmin } from '@/lib/session';

type Body = { name?: string; description?: string | null; eventDate?: string | null };

/** 新建相册（仅管理员） */
export const POST = handler(async (req: Request) => {
  const user = await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Body;

  // 敏感词过滤（2026-10-08）
  const filteredName = filterSensitive((body.name ?? '').trim());
  const name = filteredName.text;
  if (!name) throw new HttpError(400, '相册名不能是空的');
  if (name.length > 60) throw new HttpError(400, '相册名太长了');

  let eventDate: string | null = null;
  if (body.eventDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.eventDate)) throw new HttpError(400, '日期格式不对');
    eventDate = body.eventDate;
  }

  const filteredDesc = filterSensitive((body.description ?? '').trim().slice(0, 120));
  const description = filteredDesc.text || null;

  const album = await one<{ id: number; name: string }>(
    `insert into albums (name, description, event_date, created_by)
     values ($1, $2, $3, $4)
     returning id, name`,
    [name, description, eventDate, user.id],
  );

  if (filteredName.hit || filteredDesc.hit) {
    await audit(user.id, 'sensitive_filtered', `album:${album?.id}`, {
      where: 'album',
      words: [...filteredName.words, ...filteredDesc.words],
    });
  }

  await audit(user.id, 'album.create', album ? String(album.id) : null, { name });
  return Response.json({ ok: true, album });
});
