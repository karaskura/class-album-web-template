import { audit, one, query } from '@/lib/db';
import { HttpError, handler, jsonOk } from '@/lib/http';
import { canManage, requireUser } from '@/lib/session';

/**
 * 删除评论（2026-10-08 举报机制配套）
 *
 * 做的是**软删除**：只写 deleted_at / deleted_by，原始记录留在库里，
 * 处置动作写审计日志 —— 和《安全评估报告》里承诺的处置方式一致。
 * 作者本人能删自己的，管理员能删任何一条。
 */

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();

  const { id } = await ctx.params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) throw new HttpError(400, '评论 id 不对');

  const comment = await one<{ id: number; user_id: number; photo_id: number }>(
    'select id, user_id, photo_id from comments where id = $1 and deleted_at is null',
    [commentId],
  );
  if (!comment) throw new HttpError(404, '这条评论已经不在了');
  if (comment.user_id !== user.id && !canManage(user)) throw new HttpError(403, '只能删自己的评论');

  await query('update comments set deleted_at = now(), deleted_by = $1 where id = $2', [
    user.id,
    commentId,
  ]);
  await audit(user.id, 'comment_delete', `comment:${commentId}`, { photoId: comment.photo_id });

  return jsonOk();
});
