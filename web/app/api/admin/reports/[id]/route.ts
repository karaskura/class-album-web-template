import { audit, query } from '@/lib/db';
import { HttpError, handler, jsonOk } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

/** 管理员处理举报：标记已处理 / 忽略（2026-10-08） */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();

  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) throw new HttpError(400, '举报 id 不对');

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const status = body.action === 'handled' ? 'handled' : body.action === 'dismissed' ? 'dismissed' : '';
  if (!status) throw new HttpError(400, '动作不对');

  const updated = await query<{ id: number }>(
    `update reports set status = $1, handled_by = $2, handled_at = now()
      where id = $3 and status = 'pending'
      returning id`,
    [status, admin.id, reportId],
  );
  if (updated.length === 0) throw new HttpError(400, '这条举报已经处理过了');

  await audit(admin.id, `report_${status}`, `report:${reportId}`, null);

  return jsonOk();
});
