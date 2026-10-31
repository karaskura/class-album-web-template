import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { config } from './config';

export type UploadTarget = {
  key: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
};

export interface StorageDriver {
  readonly name: 'local' | 'oss';
  /** 生成一个"直传"目标：前端拿到 URL 后自己 PUT 上去，图片不流经我们的服务器 */
  createUploadTarget(key: string, contentType: string): Promise<UploadTarget>;
  /** 服务端直接写对象（local 驱动的中转上传会用到） */
  putObject(key: string, data: Buffer, contentType?: string): Promise<void>;
  readObject(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  deleteObject(key: string): Promise<void>;
  /** 前端 <img src> 可以直接用的地址 */
  url(key: string): string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  // 允许 PDF：浏览器必须收到 application/pdf 才会内嵌预览，
  // 给成 octet-stream 就会变成「下载」
  '.pdf': 'application/pdf',
};

function mimeOf(key: string): string {
  return MIME_BY_EXT[extname(key).toLowerCase()] ?? 'application/octet-stream';
}

/** 只允许白名单前缀（photos/ avatars/ activities/ promos/），挡掉 ../ 之类的越权 */
export function sanitizeKey(key: string): string {
  const cleaned = String(key).replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    !cleaned.startsWith('photos/') &&
    !cleaned.startsWith('avatars/') &&
    !cleaned.startsWith('activities/') &&
    !cleaned.startsWith('promos/')
  ) {
    throw new Error('非法的存储路径');
  }
  if (cleaned.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new Error('非法的存储路径');
  }
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* local 驱动的上传令牌：key + 过期时间 做 HMAC，前端改不了路径          */
/* ------------------------------------------------------------------ */

export function signUploadToken(key: string, expires: number): string {
  return createHmac('sha256', config.sessionSecret).update(`${key}|${expires}`).digest('hex');
}

export function verifyUploadToken(key: string, expires: number, token: string): boolean {
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  try {
    const expected = Buffer.from(signUploadToken(key, expires), 'utf8');
    const actual = Buffer.from(String(token), 'utf8');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 本地磁盘驱动：零成本，开发 / 局域网部署直接用                          */
/* ------------------------------------------------------------------ */

class LocalStorage implements StorageDriver {
  readonly name = 'local' as const;
  private readonly root = config.localStorageDir;

  /** 把存储 key 换成磁盘绝对路径（归档时硬链接要用） */
  resolvePath(key: string): string {
    const safe = sanitizeKey(key);
    const full = resolve(this.root, safe);
    if (full !== resolve(this.root) && !full.startsWith(resolve(this.root) + sep)) {
      throw new Error('非法的存储路径');
    }
    return full;
  }

  async createUploadTarget(key: string, contentType: string): Promise<UploadTarget> {
    const safe = sanitizeKey(key);
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const qs = new URLSearchParams({
      key: safe,
      expires: String(expires),
      token: signUploadToken(safe, expires),
    });
    return {
      key: safe,
      url: `/api/storage/put?${qs.toString()}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    };
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    const full = this.resolvePath(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async readObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const data = await readFile(this.resolvePath(key));
      return { data, contentType: mimeOf(key) };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await unlink(this.resolvePath(key)).catch(() => {});
  }

  url(key: string): string {
    return `/api/media/${sanitizeKey(key).split('/').map(encodeURIComponent).join('/')}`;
  }
}

/* ------------------------------------------------------------------ */
/* 阿里云 OSS 驱动：预签名直传，出网流量不经过我们的小服务器             */
/* ------------------------------------------------------------------ */

class OssStorage implements StorageDriver {
  readonly name = 'oss' as const;

  private get bucket() {
    return config.oss.bucket;
  }

  private objectUrl(key: string): string {
    return `https://${this.bucket}.${config.oss.publicEndpoint}/${key}`;
  }

  /** OSS V1 签名 */
  private sign(method: string, key: string, expires: number, contentType = ''): string {
    const stringToSign = [method, '', contentType, String(expires), `/${this.bucket}/${key}`].join('\n');
    return createHmac('sha1', config.oss.accessKeySecret).update(stringToSign, 'utf8').digest('base64');
  }

  private signedUrl(
    method: 'GET' | 'PUT',
    key: string,
    ttlSeconds: number,
    contentType = '',
  ): string {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const qs = new URLSearchParams({
      OSSAccessKeyId: config.oss.accessKeyId,
      Expires: String(expires),
      Signature: this.sign(method, key, expires, contentType),
    });
    return `${this.objectUrl(key)}?${qs.toString()}`;
  }

  private assertConfigured(): void {
    if (!config.oss.bucket || !config.oss.accessKeyId || !config.oss.accessKeySecret) {
      throw new Error('OSS 未配置完整：请检查 OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET');
    }
  }

  async createUploadTarget(key: string, contentType: string): Promise<UploadTarget> {
    this.assertConfigured();
    const safe = sanitizeKey(key);
    return {
      key: safe,
      url: this.signedUrl('PUT', safe, 3600, contentType),
      method: 'PUT',
      // 必须和签名里用到的 Content-Type 完全一致，否则 OSS 会报 SignatureDoesNotMatch
      headers: { 'Content-Type': contentType },
    };
  }

  async readObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const res = await fetch(this.url(key));
      if (!res.ok) return null;
      return {
        data: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') ?? mimeOf(key),
      };
    } catch {
      return null;
    }
  }

  async putObject(key: string, data: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    this.assertConfigured();
    const safe = sanitizeKey(key);
    const res = await fetch(this.signedUrl('PUT', safe, 600, contentType), {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`写入 OSS 失败（HTTP ${res.status}）`);
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    const safe = sanitizeKey(key);
    const date = new Date().toUTCString();
    const stringToSign = ['DELETE', '', '', date, `/${this.bucket}/${safe}`].join('\n');
    const signature = createHmac('sha1', config.oss.accessKeySecret)
      .update(stringToSign, 'utf8')
      .digest('base64');
    await fetch(this.objectUrl(safe), {
      method: 'DELETE',
      headers: { Date: date, Authorization: `OSS ${config.oss.accessKeyId}:${signature}` },
    }).catch(() => {});
  }

  url(key: string): string {
    this.assertConfigured();
    // 短时签名地址：即使被转发出去，过一会儿也失效
    return this.signedUrl('GET', sanitizeKey(key), config.oss.signedUrlTtl);
  }
}

export const storage: StorageDriver =
  config.storageDriver === 'oss' ? new OssStorage() : new LocalStorage();

/** 给页面用的图片地址 */
/**
 * 宣传图地址：宣传栏的图是"给所有人看"的（包括还没登录的人），
 * 所以走专门的公开出口 /api/promo-image，不能让它们撞在需要登录的 /api/media 上。
 */
export function promoImageUrl(key: string | null | undefined): string {
  if (!key) return '';
  try {
    const safe = sanitizeKey(key);
    if (!safe.startsWith('promos/')) return '';
    return `/api/promo-image/${safe.split('/').map(encodeURIComponent).join('/')}`;
  } catch {
    return '';
  }
}

export function mediaUrl(key: string | null | undefined): string {
  if (!key) return '';
  try {
    return storage.url(key);
  } catch {
    // OSS 没配置好时不要让页面直接崩
    return '';
  }
}

/**
 * 本地驱动才能拿到磁盘路径。
 * 归档时用它做硬链接（不占额外空间）；OSS 驱动返回 null，只能下载后再打包。
 */
export function localStoragePath(key: string): string | null {
  if (storage.name !== 'local') return null;
  try {
    return (storage as unknown as { resolvePath(k: string): string }).resolvePath(key);
  } catch {
    return null;
  }
}
