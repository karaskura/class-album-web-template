import { generateInviteCode, isValidStudentNo } from '@/lib/auth';
import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

type Body = { note?: string | null; boundStudentNo?: string | null };

/** 生成邀请码（仅管理员） */
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Body;

  const note = (body.note ?? '').trim().slice(0, 60) || null;
  const boundStudentNo = (body.boundStudentNo ?? '').trim() || null;
  if (boundStudentNo && !isValidStudentNo(boundStudentNo)) {
    throw new HttpError(400, '学号格式不对（4~20 位数字或字母）');
  }

  // 撞码了就重试几次（空间足够大，基本不会撞）
  let code = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode();
    const exists = await one('select 1 as ok from invites where code = $1', [candidate]);
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new HttpError(500, '生成邀请码失败，再点一次试试');

  await query(
    'insert into invites (code, note, bound_student_no, created_by) values ($1, $2, $3, $4)',
    [code, note, boundStudentNo, admin.id],
  );
  await audit(admin.id, 'invite.create', code, { note, boundStudentNo });

  return Response.json({ ok: true, code });
});
