import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import './platform-ui.css';

export const metadata: Metadata = {
  title: { default: '班级相册', template: '%s · 班级相册' },
  description: '我们班的专属空间：相册、活动，以后还会有更多',
  applicationName: '班级相册',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '班级相册' },
  icons: {
    // .ico 给老浏览器和 Windows 任务栏用，svg 给现代浏览器
    icon: [
      { url: '/icons/album.ico', sizes: 'any' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1115' },
  ],
};

/**
 * 主题和网页背景由**服务端直接读 cookie 写进 <html>**，不用任何内联脚本。
 *
 * 为什么不用脚本（2026-10-18 踩过三个坑，别再走回头路）：
 *   1. 直接在组件树里写 <script>：React 19 报
 *      「Encountered a script tag while rendering React component」，
 *      开发模式弹红框（维护者截图反馈的就是这个）。
 *   2. 换成 next/script 的 beforeInteractive：App Router 下它只是把代码
 *      push 进 self.__next_s 队列，运行时才执行 → 首屏先闪一下浅色，主题晚到。
 *   3. 服务端读 cookie、把 data-theme 直接写进 <html>：无脚本、无闪烁、无报错。
 *
 * 代价：cookie 里没有值时按浅色渲染（不再跟随系统）。
 * 用户点一次日间/夜间就会写 cookie，之后一直是他的选择。
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const savedTheme = store.get('album-theme')?.value;
  const theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light';
  const savedBg = store.get('album-bg')?.value;
  const bg = savedBg && /^[a-z]+$/.test(savedBg) ? savedBg : 'default';

  return (
    <html lang="zh-CN" data-theme={theme} data-bg={bg} suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
