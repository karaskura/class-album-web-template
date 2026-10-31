import { randomBytes } from 'node:crypto';
import { isAllowedMime } from '@/lib/config';
import { HttpError, handler } from '@/lib/http';
import { requireActivityPublisher } from '@/lib/session';
import { storage } from '@/lib/storage';

type Body = { mime?: string };

/**
 * 活动封面：先跟服务器要一个「直传地址」，浏览器压缩完自己 PUT 上去。
 * 走的是和照片一样的那套签名直传，图片不经过我们的小服务器。
 */
export const POST = handler(async (req: Request) => {
  await requireActivityPublisher();

  const body = (await req.json().catch(() => ({}))) as Body;
  const mime = body.mime ?? '';
  if (!isAllowedMime(mime)) throw new HttpError(400, '封面只收 jpg / png / webp / gif');

  const ext =
    mime === 'image/jpeg' ? '.jpg' : mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : '.webp';
  const now = new Date();
  const key = `activities/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomBytes(
    8,
  ).toString('hex')}/cover${ext}`;

  const target = await storage.createUploadTarget(key, mime);
  return Response.json({ target });
});
