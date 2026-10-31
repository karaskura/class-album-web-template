import type { MetadataRoute } from 'next';

/**
 * PWA 的应用清单，会被 Next 自动输出到 /manifest.webmanifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '班级相册',
    short_name: '相册',
    description: '我们班的专属相册',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6f7f9',
    theme_color: '#2f6feb',
    lang: 'zh-CN',
    categories: ['photo', 'social'],
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
