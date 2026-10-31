import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { filterSensitive } from '@/lib/sensitive';
import { requireUser } from '@/lib/session';
import type { CommentRow } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };
type Body = { content?: string };

/** 发一条评论 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();

  const { id } = await ctx.params;
  const photoId = Number(id);
  if (!Number.isInteger(photoId) || photoId <= 0) throw new HttpError(400, '照片 id 不对');

  const photo = await one<{ id: number; uploader_id: number | null }>(
    `select id, uploader_id from photos where id = $1 and status = 'active'`,
    [photoId],
  );
  if (!photo) throw new HttpError(404, '照片不存在或已删除');

  const body = (await req.json().catch(() => ({}))) as Body;
  // 敏感词过滤（2026-10-08 · 安全评估要求的"自动发现与处置"）：
  // 命中的词替换成等长 *，并把这次过滤记进审计日志
  const { text: content, hit, words } = filterSensitive((body.content ?? '').trim());
  if (!content) throw new HttpError(400, '评论不能是空的');
  if (content.length > 500) throw new HttpError(400, '评论太长了（最多 500 字）');
  if (hit) await audit(user.id, 'sensitive_filtered', `photo:${photoId}`, { where: 'comment', words });

  const comment = await one<CommentRow>(
    `with inserted as (
       insert into comments (photo_id, user_id, content)
       values ($1, $2, $3)
       returning id, user_id, content, created_at
     )
     select i.id, i.user_id, i.content, i.created_at,
            u.name as author_name, u.student_no as author_no
       from inserted i
       join users u on u.id = i.user_id`,
    [photoId, user.id, content],
  );

  // 通知作品作者：有人点评了你的作品就给你留一条（自己点评自己的不发）
  if (comment && photo.uploader_id && photo.uploader_id !== user.id) {
    await query(
      `insert into notifications (user_id, actor_id, photo_id, comment_id, type)
       values ($1, $2, $3, $4, 'photo_comment')`,
      [photo.uploader_id, user.id, photoId, comment.id],
    );
  }

  return Response.json({ ok: true, comment });
});
