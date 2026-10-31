'use client';

import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './icons';
import { applyTheme, migrateLegacyTheme } from '@/lib/theme-client';

/** 浅色 / 深色切换，选择和系统默认都记在 localStorage 里 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 老用户 localStorage 里的选择搬进 cookie（服务端下次就能直接渲染对）
    migrateLegacyTheme();
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'dark' : 'light');
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={toggle}
      aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      style={{ padding: 8 }}
    >
      {/* 没挂载前渲染什么都可以，用 sun 避免布局跳动 */}
      {mounted && theme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
    </button>
  );
}
