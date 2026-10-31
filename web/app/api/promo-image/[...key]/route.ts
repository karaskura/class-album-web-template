import { HttpError, handler } from '@/lib/http';
import { sanitizeKey, storage } from '@/lib/storage';

/**
 * 宣传图的公开出口。
 * 宣传栏的图是"给所有人看"的（含还没登录的人），所以这里**不要求身份**；
 * 但只放行 `promos/` 开头的对象，班里的照片仍然必须走需要身份的 /api/media。
 */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ key: string[] }> }) => {
  const { key } = await ctx.params;
  const joined = (key ?? []).join('/');
  if (!joined) throw new HttpError(400, '缺少图片路径');

  let safe: string;
  try {
    safe = sanitizeKey(joined);
  } catch {
    throw new HttpError(400, '图片路径不合法');
  }
  if (!safe.startsWith('promos/')) throw new HttpError(403, '这不是宣传图');

  const object = await storage.readObject(safe);
  if (!object) return new Response('Not Found', { status: 404 });

  return new Response(new Uint8Array(object.data), {
    headers: {
      'Content-Type': object.contentType,
      'Content-Length': String(object.data.byteLength),
      // 宣传图可以给 CDN/浏览器缓存
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
