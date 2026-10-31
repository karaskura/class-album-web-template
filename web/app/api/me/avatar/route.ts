import { audit, one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { storage } from '@/lib/storage';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB 足够放一个 256×256 的头像
const ALLOWED = ['image/webp', 'image/jpeg', 'image/png'];

/**
 * 上传 / 更换头像。
 * 前端已经用 canvas 裁成正方形并压到 256×256，这里只管存。
 * 头像很小，直接收二进制体，不用走对象存储直传那一套。
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();

  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!ALLOWED.includes(contentType)) {
    throw new HttpError(400, '头像只收 WebP / JPEG / PNG');
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.byteLength === 0) throw new HttpError(400, '收到空文件');
  if (buffer.byteLength > MAX_AVATAR_BYTES) {
    throw new HttpError(413, '头像太大了（压缩后应该只有几十 KB）');
  }

  const ext = contentType === 'image/png' ? '.png' : contentType === 'image/jpeg' ? '.jpg' : '.webp';
  // key 里带随机串：换了头像地址就变，浏览器缓存不会串
  const key = `avatars/${user.id}-${Date.now().toString(36)}${ext}`;

  await storage.putObject(key, buffer, contentType);

  // 先查旧的，写成功了再删，免得中途失败连旧头像都没了
  const previous = await one<{ avatar_key: string | null }>(
    'select avatar_key from users where id = $1',
    [user.id],
  );
  await query('update users set avatar_key = $1 where id = $2', [key, user.id]);

  if (previous?.avatar_key && previous.avatar_key !== key) {
    await storage.deleteObject(previous.avatar_key).catch(() => {});
  }

  await audit(user.id, 'user.avatar', null, { bytes: buffer.byteLength });
  return Response.json({ ok: true, avatarKey: key });
});

/** 恢复成默认的「名字首字」头像 */
export const DELETE = handler(async () => {
  const user = await requireUser();

  const previous = await one<{ avatar_key: string | null }>(
    'select avatar_key from users where id = $1',
    [user.id],
  );
  await query('update users set avatar_key = null where id = $1', [user.id]);
  if (previous?.avatar_key) {
    await storage.deleteObject(previous.avatar_key).catch(() => {});
  }

  await audit(user.id, 'user.avatar.remove', null, null);
  return Response.json({ ok: true });
});
