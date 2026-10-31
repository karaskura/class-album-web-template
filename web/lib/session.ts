import { randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { one, query } from './db';
import { HttpError } from './http';
import type { SessionUser } from './types';

export const SESSION_COOKIE = 'album_session';
/** 游客（只读）标记：不动 users 表，只是一张"我进来看看"的通行证 */
export const GUEST_COOKIE = 'album_guest';
const SESSION_TTL_DAYS = 30;
const GUEST_TTL_SECONDS = 30 * 86_400;

/** 生产环境默认只走 HTTPS 下发 cookie；局域网 HTTP 部署时用 COOKIE_SECURE=false 关掉 */
function cookieSecure(): boolean {
  const raw = (process.env.COOKIE_SECURE ?? '').toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.NODE_ENV === 'production';
}

/** 登录成功：写库 + 下发 cookie（只能在 Route Handler / Server Action 里调用） */
export async function createSession(userId: number, userAgent?: string | null): Promise<void> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await query(
    'insert into sessions (id, user_id, expires_at, user_agent) values ($1, $2, $3, $4)',
    [id, userId, expiresAt, userAgent ?? null],
  );
  const store = await cookies();
  // 正式登录了就不再是游客
  store.delete(GUEST_COOKIE);
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    secure: cookieSecure(),
  });
}

/** 游客入口（登录页的「我就来看看」）：只发一张只读通行证 */
export async function createGuestSession(): Promise<void> {
  const store = await cookies();
  store.set(GUEST_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_TTL_SECONDS,
    secure: cookieSecure(),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) {
    await query('delete from sessions where id = $1', [sid]).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
  store.delete(GUEST_COOKIE);
}

/**
 * 当前登录用户；没登录或已被停用返回 null。
 * 用 React cache 包一层：同一次请求里 layout 和 page 都调用也只查一次库。
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  return await one<SessionUser>(
    `select u.id, u.student_no, u.name, u.role, u.status, u.avatar_key, u.admin_level
       from sessions s
       join users u on u.id = s.user_id
      where s.id = $1
        and s.expires_at > now()
        and u.status = 'active'`,
    [sid],
  );
});

/** 谁在看这个页面：登录用户 / 游客 / 谁都不是 */
export type Viewer = { kind: 'user'; user: SessionUser } | { kind: 'guest' };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getCurrentUser();
  if (user) return { kind: 'user', user };
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value === '1' ? { kind: 'guest' } : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const store = await cookies();
  if (store.get(GUEST_COOKIE)?.value === '1') {
    throw new HttpError(403, '游客只能看，不能评论和发布哦～想动手就先登录');
  }
  throw new HttpError(401, '请先登录');
}

/* ---------------- 管理员等级（2026-10-05 晚，维护者 SSS 需求）----------------
   0 = 维护者：全权（编辑、访问、发布活动、发管理员）
   1 = 一级：发布活动 + 审核作品（能进管理后台）
   2 = 二级：只能发布活动
   非管理员 = 999（比谁都低）
--------------------------------------------------------------------------- */

export function adminLevel(user: SessionUser | null | undefined): number {
  if (!user || user.role !== 'admin') return 999;
  // 老数据没写级别时按最低权限算，安全第一
  return user.admin_level ?? 2;
}

export function isOwner(user: SessionUser | null | undefined): boolean {
  return adminLevel(user) === 0;
}

/** 能进管理后台审核东西的（0、1 级） */
export function canManage(user: SessionUser | null | undefined): boolean {
  return adminLevel(user) <= 1;
}

/** 能发布活动的（所有管理员 0/1/2 级） */
export function canPublishActivity(user: SessionUser | null | undefined): boolean {
  return adminLevel(user) <= 2;
}

/** 管理后台那类「审核」操作：一级以上 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManage(user)) throw new HttpError(403, '这个操作要一级管理员以上');
  return user;
}

/** 只有维护者能干的事：发/撤管理员 */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isOwner(user)) throw new HttpError(403, '只有维护者能做这个操作');
  return user;
}

/** 发布活动：任何等级的管理员都行 */
export async function requireActivityPublisher(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canPublishActivity(user)) throw new HttpError(403, '只有管理员能发布活动');
  return user;
}

/** 顺手清理过期会话（1% 概率触发，不用定时任务） */
export async function maybeCleanupSessions(): Promise<void> {
  if (Math.random() > 0.01) return;
  await query('delete from sessions where expires_at < now()').catch(() => {});
}
