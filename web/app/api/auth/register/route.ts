import { checkPasswordStrength, hashPassword, isValidStudentNo } from '@/lib/auth';
import { one, tx } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';

type Body = {
  studentNo?: string;
  name?: string;
  inviteCode?: string;
  password?: string;
};

type Invite = {
  id: number;
  bound_student_no: string | null;
  expires_at: Date | null;
  used_by: number | null;
};

export const POST = handler(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as Body;
  const studentNo = (body.studentNo ?? '').trim();
  const name = (body.name ?? '').trim();
  const inviteCode = (body.inviteCode ?? '').trim().toUpperCase();
  const password = body.password ?? '';

  // ---------- 先做一遍基础校验 ----------
  if (!isValidStudentNo(studentNo)) throw new HttpError(400, '学号格式不对（4~20 位数字或字母）');
  if (name.length < 1 || name.length > 20) throw new HttpError(400, '姓名长度不对');
  const weak = checkPasswordStrength(password);
  if (weak) throw new HttpError(400, weak);
  if (!inviteCode) throw new HttpError(400, '请填邀请码');

  // ---------- 验邀请码 ----------
  const invite = await one<Invite>(
    'select id, bound_student_no, expires_at, used_by from invites where code = $1',
    [inviteCode],
  );
  if (!invite) throw new HttpError(400, '邀请码不存在，检查一下有没有打错');
  if (invite.used_by) throw new HttpError(400, '这个邀请码已经被用过了');
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, '邀请码已过期');
  }
  if (invite.bound_student_no && invite.bound_student_no !== studentNo) {
    throw new HttpError(400, '这个邀请码是发给别的学号的');
  }

  const existing = await one<{ id: number; status: string }>(
    'select id, status from users where student_no = $1',
    [studentNo],
  );
  if (existing) {
    throw new HttpError(
      400,
      existing.status === 'pending' ? '这个学号已经提交过申请了，等管理员通过' : '这个学号已经注册过了，直接登录',
    );
  }

  // ---------- 第一个注册的人自动成为管理员，否则没人能审批 ----------
  const adminExists = await one('select 1 as ok from users where role = $1 limit 1', ['admin']);
  const bootstrap = !adminExists;
  const status = bootstrap ? 'active' : 'pending';
  const role: 'admin' | 'member' = bootstrap ? 'admin' : 'member';

  await tx(async (client) => {
    const result = await client.query<{ id: number }>(
      `insert into users (student_no, name, password_hash, role, status, approved_at)
       values ($1, $2, $3, $4, $5, case when $5 = 'active' then now() else null end)
       returning id`,
      [studentNo, name, hashPassword(password), role, status],
    );
    const userId = result.rows[0].id;
    await client.query('update invites set used_by = $1, used_at = now() where id = $2', [
      userId,
      invite.id,
    ]);
  });

  return Response.json({ ok: true, status, bootstrap });
});
