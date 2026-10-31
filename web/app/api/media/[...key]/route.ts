import { HttpError, handler } from '@/lib/http';
import { getViewer } from '@/lib/session';
import { sanitizeKey, storage } from '@/lib/storage';

/** 高分辨率「原图」的文件名规则：photos/年/月/随机串/orig.webp */
const ORIGINAL_KEY = /(^|\/)orig\.[a-z0-9]+$/i;

/**
 * 图片出口。
 * 关键点：
 *  ① **必须先有身份**（登录账号 或 从游客入口进来的只读通行证）—— 匿名拿不到图，
 *     链接转发给外人也没用，这是"私密相册"的核心。
 *  ② **游客照样能看图**（维护者 2026-10-05：游客能看不能做），所以这里放行 guest，
 *     但不放行"什么都没带"的匿名请求。
 *  ③ **高分辨率原图不给普通成员**（维护者 2026-10-05：取消下载功能，防图片被盗用）。
 *     详情页只发 thumb，这里再堵一次"把 thumb 的 URL 改成 orig"的路：原图只给管理员。
 */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ key: string[] }> }) => {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError(401, '请先登录，或从游客入口进来看看');

  const { key } = await ctx.params;
  const joined = (key ?? []).join('/');
  if (!joined) throw new HttpError(400, '缺少图片路径');

  let safe: string;
  try {
    safe = sanitizeKey(joined);
  } catch {
    throw new HttpError(400, '图片路径不合法');
  }

  const isAdmin = viewer.kind === 'user' && viewer.user.role === 'admin';
  if (ORIGINAL_KEY.test(safe) && !isAdmin) {
    throw new HttpError(403, '原图不对外开放');
  }

  const object = await storage.readObject(safe);
  if (!object) return new Response('Not Found', { status: 404 });

  return new Response(new Uint8Array(object.data), {
    headers: {
      'Content-Type': object.contentType,
      'Content-Length': String(object.data.byteLength),
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
