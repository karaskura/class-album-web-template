import { audit, one } from '@/lib/db';
import { HttpError, handler, jsonOk } from '@/lib/http';
import { REPORT_REASONS } from '@/lib/reports';
import { filterSensitive } from '@/lib/sensitive';
import { requireUser } from '@/lib/session';

/**
 * 举报（2026-10-08）
 *
 * 公安联网备案《安全评估报告》要求网站建立投诉举报机制，
 * 所以每条照片 / 评论都能被成员举报，管理员在后台处理。
 */

type Body = {
  targetType?: string;
  targetId?: number;
  reason?: string;
  detail?: string;
};

const REASONS: readonly string[] = REPORT_REASONS;

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as Body;

  const targetType = body.targetType === 'photo' || body.targetType === 'comment' ? body.targetType : '';
  if (!targetType) throw new HttpError(400, '举报对象不对');

  const targetId = Number(body.targetId);
  if (!Number.isInteger(targetId) || targetId <= 0) throw new HttpError(400, '举报对象不对');

  const reason = (body.reason ?? '').trim();
  if (!REASONS.includes(reason)) throw new HttpError(400, '请选一个举报原因');

  const detail = filterSensitive((body.detail ?? '').trim()).text;
  if (detail.length > 200) throw new HttpError(400, '补充说明最多 200 字');

  // 目标得真实存在（软删除的不算）
  if (targetType === 'photo') {
    const photo = await one<{ id: number }>(
      `select id from photos where id = $1 and status <> 'deleted'`,
      [targetId],
    );
    if (!photo) throw new HttpError(404, '这张照片已经不在了');
  } else {
    const comment = await one<{ id: number }>(
      'select id from comments where id = $1 and deleted_at is null',
      [targetId],
    );
    if (!comment) throw new HttpError(404, '这条评论已经不在了');
  }

  // 同一个人对同一个东西，24 小时内只收一条，避免刷爆后台
  const dup = await one<{ id: number }>(
    `select id from reports
      where reporter_id = $1 and target_type = $2 and target_id = $3
        and status = 'pending' and created_at > now() - interval '24 hours'`,
    [user.id, targetType, targetId],
  );
  if (dup) throw new HttpError(400, '你已经举报过了，管理员正在看');

  const row = await one<{ id: number }>(
    `insert into reports (reporter_id, target_type, target_id, reason, detail)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [user.id, targetType, targetId, reason, detail || null],
  );

  await audit(user.id, 'report_create', `${targetType}:${targetId}`, { reason, reportId: row?.id });

  return jsonOk({ ok: true, id: row?.id });
});
