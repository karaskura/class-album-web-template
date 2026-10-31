import { createArchive } from '@/lib/archive';
import { audit } from '@/lib/db';
import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

export const maxDuration = 300; // 打包可能要几十秒

type Body = { note?: string };

/**
 * 一键归档：把超过 14 天的照片从网站上撤下来，并打包成一个 zip。
 * **不会删服务器上的照片**，要等管理员确认「已保存到本地」才删。
 */
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Body;

  const result = await createArchive(admin.id, body.note);
  await audit(admin.id, 'archive.create', String(result.batchId), {
    count: result.count,
    bytes: result.totalBytes,
  });

  return Response.json({ ok: true, ...result });
});
