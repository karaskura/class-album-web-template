import { checkPasswordStrength, generateRandomPassword, hashPassword } from '@/lib/auth';
import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };
type Body = {
  action?: 'approve' | 'disable' | 'enable' | 'promote' | 'reset-password';
  /** 只在 reset-password 时用；不传就自动生成一个 */
  password?: string;
};

type Target = { id: number; name: string; status: string; role: string };

async function resolveTarget(ctx: Ctx): Promise<Target> {
  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId) || memberId <= 0) throw new HttpError(400, '成员 id 不对');
  const target = await one<Target>('select id, name, status, role from users where id = $1', [memberId]);
  if (!target) throw new HttpError(404, '找不到这个同学');
  return target;
}

/** 审批 / 停用 / 恢复 / 设为管理员 */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const target = await resolveTarget(ctx);
  const body = (await req.json().catch(() => ({}))) as Body;

  if (
    target.id === admin.id &&
    (body.action === 'disable' || body.action === 'promote' || body.action === 'reset-password')
  ) {
    throw new HttpError(
      400,
      body.action === 'reset-password'
        ? '改自己的密码请用「我的 → 修改密码」'
        : '不能对自己做这个操作',
    );
  }

  switch (body.action) {
    case 'approve': {
      const result = await query(
        `update users
            set status = 'active', approved_at = now(), approved_by = $1
          where id = $2 and status = 'pending'`,
        [admin.id, target.id],
      );
      if (result.length === 0 && target.status !== 'pending') {
        // status 已经是 active 的情况（重复点击）不用报错
      }
      break;
    }
    case 'disable': {
      await query(`update users set status = 'disabled' where id = $1`, [target.id]);
      // 踢下线
      await query('delete from sessions where user_id = $1', [target.id]);
      break;
    }
    case 'enable': {
      await query(`update users set status = 'active' where id = $1`, [target.id]);
      break;
    }
    case 'promote': {
      await query(`update users set role = 'admin' where id = $1`, [target.id]);
      break;
    }
    case 'reset-password': {
      // 传了就用传的，没传就随机生成一个
      const wanted = (body.password ?? '').trim();
      const newPassword = wanted || generateRandomPassword();
      const weak = checkPasswordStrength(newPassword);
      if (weak) throw new HttpError(400, weak);

      await query('update users set password_hash = $1 where id = $2', [
        hashPassword(newPassword),
        target.id,
      ]);
      // 把他所有设备踢下线，逼他用新密码重新登
      await query('delete from sessions where user_id = $1', [target.id]);
      await audit(admin.id, 'member.resetPassword', String(target.id), { name: target.name });

      return Response.json({ ok: true, password: newPassword, generated: !wanted });
    }
    default:
      throw new HttpError(400, '不认识的操作');
  }

  await audit(admin.id, `member.${body.action}`, String(target.id), { name: target.name });
  return Response.json({ ok: true });
});

/** 拒绝申请：只允许删掉还没通过的人 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const target = await resolveTarget(ctx);

  if (target.status !== 'pending') {
    throw new HttpError(400, '只能删除"待审批"的申请；已加入的同学请用"停用"');
  }

  await query('delete from users where id = $1', [target.id]);
  await audit(admin.id, 'member.reject', String(target.id), { name: target.name });
  return Response.json({ ok: true });
});
