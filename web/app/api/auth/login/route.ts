import { verifyPassword } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { createSession, maybeCleanupSessions } from '@/lib/session';

type Body = { studentNo?: string; password?: string };

export const POST = handler(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as Body;
  const studentNo = (body.studentNo ?? '').trim();
  const password = body.password ?? '';

  if (!studentNo || !password) throw new HttpError(400, '请填学号和密码');

  const user = await one<{ id: number; password_hash: string | null; status: string; role: string }>(
    'select id, password_hash, status, role from users where student_no = $1',
    [studentNo],
  );

  // 学号不存在和密码错误给同一个提示，不泄露"这个学号存不存在"
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, '学号或密码不对');
  }
  if (user.status === 'pending') throw new HttpError(403, '申请还在等管理员通过，过了就能登');
  if (user.status === 'disabled') throw new HttpError(403, '这个账号已被停用，找班长问问');

  await createSession(user.id, req.headers.get('user-agent'));
  await query('update users set last_login_at = now() where id = $1', [user.id]);
  await maybeCleanupSessions();

  return Response.json({ ok: true, role: user.role });
});
