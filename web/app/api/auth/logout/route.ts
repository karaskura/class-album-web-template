import { handler } from '@/lib/http';
import { destroySession } from '@/lib/session';

export const POST = handler(async () => {
  await destroySession();
  return Response.json({ ok: true });
});
