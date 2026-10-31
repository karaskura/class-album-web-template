import { one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireOwner } from '@/lib/session';
import type { ManagerRow } from '@/lib/types';

/** 管理员名单（只有维护者能看/能改） */
export const GET = handler(async () => {
  await requireOwner();
  const managers = await query<ManagerRow>(
    `select id, name, student_no, admin_level, avatar_key
       from users
      where role = 'admin'
      order by admin_level, student_no`,
  );
  return Response.json({ managers });
});

/** 添加管理员（要选等级：1 = 发活动+审核，2 = 只能发活动） */
export const POST = handler(async (req: Request) => {
  const owner = await requireOwner();

  const body = (await req.json().catch(() => ({}))) as { userId?: number; level?: number };
  const userId = Number(body.userId);
  const level = Number(body.level);

  if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, '先选一个人');
  if (level !== 1 && level !== 2) throw new HttpError(400, '权限等级只能选一级或二级');
  if (userId === owner.id) throw new HttpError(400, '你自己已经是最高权限了');

  const target = await one<{ id: number; status: string; admin_level: number | null }>(
    'select id, status, admin_level from users where id = $1',
    [userId],
  );
  if (!target) throw new HttpError(404, '找不到这个账号');
  if (target.status !== 'active') throw new HttpError(400, '这个账号还没通过审批，先批了再说');
  if (target.admin_level === 0) throw new HttpError(400, '不能改维护者自己的权限');

  await query('update users set role = $2, admin_level = $3 where id = $1', [
    userId,
    'admin',
    level,
  ]);

  return Response.json({ ok: true });
});

/** 撤销管理员 */
export const DELETE = handler(async (req: Request) => {
  await requireOwner();

  const body = (await req.json().catch(() => ({}))) as { userId?: number };
  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, '先选一个人');

  const target = await one<{ id: number; admin_level: number | null }>(
    'select id, admin_level from users where id = $1',
    [userId],
  );
  if (!target) throw new HttpError(404, '找不到这个账号');
  if (target.admin_level === 0) throw new HttpError(400, '维护者的权限撤不掉');

  await query("update users set role = 'member', admin_level = null where id = $1", [userId]);
  return Response.json({ ok: true });
});
