/* 班级相册 · Service Worker
 *
 * 策略刻意保守：
 *   - 照片(/api/media) 和接口一律不缓存 —— 这是私密相册，绝不能把别人的照片
 *     留在浏览器缓存里，共用电脑时会出问题
 *   - 只缓存静态资源（JS/CSS/图标），让再次打开更快
 *   - 页面导航走"网络优先"，断网时给一个离线提示页
 */

const STATIC_CACHE = 'album-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(['/icons/icon.svg', '/offline.html']).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 接口和照片：完全交给网络，不碰缓存
  if (url.pathname.startsWith('/api/')) return;

  // 静态资源：缓存优先
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      })(),
    );
    return;
  }

  // 页面：网络优先，断网给提示页
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const offline = await caches.match('/offline.html');
          return (
            offline ??
            new Response('<h1>现在没有网络</h1>', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        }
      })(),
    );
  }
});
