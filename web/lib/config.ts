/** 集中读取环境变量，避免到处散落 process.env */
import { resolve } from 'node:path';

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const config = {
  siteName: str('NEXT_PUBLIC_SITE_NAME', '班级相册'),

  databaseUrl: str('DATABASE_URL'),
  sessionSecret: str('SESSION_SECRET', 'insecure-dev-secret-please-change'),

  storageDriver: (str('STORAGE_DRIVER', 'local') === 'oss' ? 'oss' : 'local') as 'local' | 'oss',
  // 注释里的 turbopackIgnore 是给打包器的提示，让它别为了这个动态路径把整个项目都打进产物
  localStorageDir: resolve(/* turbopackIgnore: true */ process.cwd(), str('LOCAL_STORAGE_DIR', './.data/media')),

  oss: {
    region: str('OSS_REGION', 'oss-cn-hangzhou'),
    endpoint: str('OSS_ENDPOINT'),
    bucket: str('OSS_BUCKET'),
    accessKeyId: str('OSS_ACCESS_KEY_ID'),
    accessKeySecret: str('OSS_ACCESS_KEY_SECRET'),
    signedUrlTtl: num('OSS_SIGNED_URL_TTL', 3600),
    get publicEndpoint() {
      if (this.endpoint) return this.endpoint;
      // 阿里云的地域有两种写法：`oss-cn-guangzhou` 和 `cn-guangzhou`，
      // 都得能推导出正确域名，不然会拼成 oss-oss-cn-guangzhou.aliyuncs.com 这种鬼东西
      const region = this.region.trim();
      return region.startsWith('oss-') ? `${region}.aliyuncs.com` : `oss-${region}.aliyuncs.com`;
    },
  },

  maxUploadMb: num('MAX_UPLOAD_MB', 25),
} as const;

/** 允许上传的图片类型 */
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export function isAllowedMime(mime: string): boolean {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}
