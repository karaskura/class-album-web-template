import { cookies } from 'next/headers';
import { checkPasswordStrength, hashPassword, verifyPassword } from '@/lib/auth';
import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { SESSION_COOKIE, requireUser } from '@/lib/session';

type Body = { currentPassword?: string; newPassword?: string };

/**
 * 修改自己的密码。
 * 要求先验证当前密码，防止别人趁你没锁屏时把你的密码改了。
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as Body;

  const currentPassword = body.currentPassword ?? '';
  const newPassword = body.newPassword ?? '';

  if (!currentPassword) throw new HttpError(400, '请输入当前密码');
  const weak = checkPasswordStrength(newPassword);
  if (weak) throw new HttpError(400, weak);
  if (newPassword === currentPassword) throw new HttpError(400, '新密码不能和当前密码一样');

  const row = await one<{ password_hash: string | null }>(
    'select password_hash from users where id = $1',
    [user.id],
  );
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    throw new HttpError(400, '当前密码不对');
  }

  await query('update users set password_hash = $1 where id = $2', [
    hashPassword(newPassword),
    user.id,
  ]);

  // 改完密码把其它设备踢下线，当前这台保留（不然你自己也被踢了）
  const store = await cookies();
  const currentSessionId = store.get(SESSION_COOKIE)?.value ?? '';
  await query('delete from sessions where user_id = $1 and id <> $2', [user.id, currentSessionId]);

  await audit(user.id, 'user.changePassword', String(user.id), null);

  return Response.json({ ok: true });
});
