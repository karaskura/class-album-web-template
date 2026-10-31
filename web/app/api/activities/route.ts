import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { filterSensitive } from '@/lib/sensitive';
import { requireActivityPublisher } from '@/lib/session';
import { sanitizeKey } from '@/lib/storage';

type Body = {
  title?: string;
  description?: string;
  coverKey?: string | null;
  participantIds?: number[];
};

/** 发布活动（一级 / 二级 / 维护者都能发） */
export const POST = handler(async (req: Request) => {
  const user = await requireActivityPublisher();

  const body = (await req.json().catch(() => ({}))) as Body;

  // 敏感词过滤（2026-10-08）
  const filteredTitle = filterSensitive((body.title ?? '').trim());
  const title = filteredTitle.text;
  if (!title) throw new HttpError(400, '给活动起个标题吧');
  if (title.length > 60) throw new HttpError(400, '标题太长啦（最多 60 字）');

  const filteredDesc = filterSensitive((body.description ?? '').trim());
  const description = filteredDesc.text;
  if (description.length > 2000) throw new HttpError(400, '活动内容太长了（最多 2000 字）');

  let coverKey: string | null = null;
  if (body.coverKey) {
    try {
      coverKey = sanitizeKey(body.coverKey);
    } catch {
      throw new HttpError(400, '封面路径不对');
    }
    if (!coverKey.startsWith('activities/')) throw new HttpError(400, '封面路径不对');
  }

  const ids = Array.from(
    new Set(
      (body.participantIds ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );

  const activity = await one<{ id: number; published_at: string }>(
    `insert into activities (title, description, cover_key, created_by)
     values ($1, $2, $3, $4)
     returning id, published_at`,
    [title, description || null, coverKey, user.id],
  );
  if (!activity) throw new HttpError(500, '活动没存上，再点一次试试');

  if (filteredTitle.hit || filteredDesc.hit) {
    await audit(user.id, 'sensitive_filtered', `activity:${activity.id}`, {
      where: 'activity',
      words: [...filteredTitle.words, ...filteredDesc.words],
    });
  }

  if (ids.length > 0) {
    // 只认真实存在、且状态正常的账号
    await query(
      `insert into activity_participants (activity_id, user_id)
       select $1, u.id from users u
        where u.id = any($2::bigint[]) and u.status = 'active'
       on conflict do nothing`,
      [activity.id, ids],
    );
  }

  return Response.json({ ok: true, id: activity.id, publishedAt: activity.published_at });
});
