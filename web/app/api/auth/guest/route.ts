import { handler } from '@/lib/http';
import { createGuestSession } from '@/lib/session';

/** 登录页的「我就来看看」：给一张只读通行证，不建账号、不写库 */
export const POST = handler(async () => {
  await createGuestSession();
  return Response.json({ ok: true, guest: true });
});
