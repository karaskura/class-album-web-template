'use client';

import { useEffect, useState } from 'react';
import { IconPlus, IconX } from './icons';

const DISMISS_KEY = 'album-install-tip-dismissed';

/**
 * 两件事：
 *  1. 注册 Service Worker（PWA 能离线打开、加载更快）
 *  2. 教同学怎么"添加到主屏幕"
 *     - Android/Chrome 有 beforeinstallprompt，可以直接弹安装
 *     - iOS Safari 没这个事件，只能给文字提示
 */
export default function PwaInstallTip() {
  const [tip, setTip] = useState<'none' | 'ios' | 'android'>('none');
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    // 1. Service Worker
    if ('serviceWorker' in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          /* 注册失败不影响正常使用 */
        });
      };
      if (document.readyState === 'complete') onLoad();
      else window.addEventListener('load', onLoad, { once: true });
    }

    // 2. 安装提示
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);

    if (isIOS) {
      setTip('ios');
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setTip('android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setTip('none');
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt as Event & { prompt?: () => Promise<void> };
    await prompt.prompt?.();
    setTip('none');
    setDeferredPrompt(null);
  }

  if (tip === 'none') return null;

  return (
    <div className="install-tip" role="dialog" aria-label="添加到主屏幕">
      <span style={{ fontSize: 18 }} aria-hidden>
        📲
      </span>
      <div className="grow">
        {tip === 'ios' ? (
          <>
            把相册装到桌面：点底部<b>分享</b>按钮 → <b>添加到主屏幕</b>
          </>
        ) : (
          <>把「班级相册」装到桌面，打开更方便</>
        )}
      </div>
      {tip === 'android' && (
        <button type="button" className="btn btn-primary btn-sm" onClick={install}>
          <IconPlus size={15} />
          安装
        </button>
      )}
      <button type="button" className="close" onClick={dismiss} aria-label="关闭提示">
        <IconX size={16} />
      </button>
    </div>
  );
}
