import { randomBytes } from 'node:crypto';
import { isAllowedMime } from '@/lib/config';
import { HttpError, handler } from '@/lib/http';
import { requireOwner } from '@/lib/session';
import { storage } from '@/lib/storage';

type Body = { mime?: string };

/** 宣传图直传地址：只有维护者能拿（宣传内容只能他发布） */
export const POST = handler(async (req: Request) => {
  await requireOwner();

  const body = (await req.json().catch(() => ({}))) as Body;
  const mime = body.mime ?? '';
  if (!isAllowedMime(mime)) throw new HttpError(400, '宣传图只收 jpg / png / webp / gif');

  const ext =
    mime === 'image/jpeg' ? '.jpg' : mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : '.webp';
  const now = new Date();
  const key = `promos/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomBytes(
    8,
  ).toString('hex')}/image${ext}`;

  const target = await storage.createUploadTarget(key, mime);
  return Response.json({ target });
});
