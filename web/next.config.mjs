/** @type {import('next').NextConfig} */
const nextConfig = {
  // 打包成 standalone，Docker 镜像更小，适合低配云主机
  output: 'standalone',
  // pg 是原生依赖，不要被打包器处理
  serverExternalPackages: ['pg'],
  // 图片走我们自己的缩略图（本地驱动或 OSS），不用 Next 的图片优化服务
  images: { unoptimized: true },
  poweredByHeader: false,
  // 本机用 127.0.0.1:3000 打开时，dev 默认会把 /_next 的 dev 资源当跨源请求拦掉，
  // 页面看着能开、按钮却全没反应（客户端根本没水合）。把本机两个地址显式放行。
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  // 本机 dev 的样式表文件名不随内容变（app_rsc-pages_xxx.css 是固定的），
  // 浏览器缓存一份就再也不更新，表现为「刚打开没边框没光标，Ctrl+F5 才好」。
  // dev 下让 /_next/static 全程不走缓存；正式构建的文件名带内容指纹，不受影响。
  async headers() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' }],
      },
    ];
  },
  experimental: {
    // 表单可以直接带图片附件，提交走 Server Action。默认上限只有 1MB，
    // 一张手机照片就超了，这里放到 30MB；单个文件的实际限制在 lib/storage.ts 里按 MAX_UPLOAD_MB 再收一道。
    serverActions: { bodySizeLimit: '30mb' },
  },
};

export default nextConfig;
