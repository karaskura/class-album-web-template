import { randomBytes } from 'node:crypto';
import { config, isAllowedMime } from '@/lib/config';
import { HttpError, handler } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { storage } from '@/lib/storage';

type Body = {
  albumId?: number | null;
  outputMime?: string;
  files?: Array<{ name?: string; size?: number; type?: string }>;
};

const MAX_FILES_PER_REQUEST = 60;

/**
 * 上传第一步：后端只负责"发地址"和"发凭证"，图片本身不经过服务器。
 * 每张照片分配三个 key：原图 / thumb / micro。
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as Body;

  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) throw new HttpError(400, '没有要上传的照片');
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new HttpError(400, `一次最多上传 ${MAX_FILES_PER_REQUEST} 张，分批来吧`);
  }

  const maxBytes = config.maxUploadMb * 1024 * 1024;
  for (const file of files) {
    const label = file.name ?? '文件';
    if (!isAllowedMime(file.type ?? '')) throw new HttpError(400, `不支持的格式：${label}`);
    if (typeof file.size === 'number' && file.size > maxBytes) {
      throw new HttpError(413, `${label} 超过 ${config.maxUploadMb}MB，先压缩一下再传`);
    }
  }

  const outputMime = isAllowedMime(body.outputMime ?? '') ? (body.outputMime as string) : 'image/webp';
  const ext = outputMime === 'image/jpeg' ? '.jpg' : '.webp';

  const now = new Date();
  const prefix = `photos/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  const targets = [];
  for (let i = 0; i < files.length; i += 1) {
    const dir = `${prefix}/${randomBytes(8).toString('hex')}`;
    targets.push({
      orig: await storage.createUploadTarget(`${dir}/orig${ext}`, outputMime),
      thumb: await storage.createUploadTarget(`${dir}/thumb${ext}`, outputMime),
      micro: await storage.createUploadTarget(`${dir}/micro${ext}`, outputMime),
    });
  }

  return Response.json({ targets, driver: storage.name, uploader: user.id });
});
