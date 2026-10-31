'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconClose, IconMenu, IconMoon, IconSearch, IconSun } from './icons';
import { applyBackground, applyTheme, migrateLegacyTheme } from '@/lib/theme-client';

/** 网页背景预设（维护者的「设置 → 设置用户个人的网页背景」） */
const BACKGROUNDS: Array<{ key: string; label: string }> = [
  { key: 'default', label: '默认' },
  { key: 'blue', label: '海蓝' },
  { key: 'dusk', label: '暮色' },
  { key: 'warm', label: '暖阳' },
];

type Props = {
  viewerName?: string | null;
  isGuest: boolean;
};

/**
 * 顶部：圆角搜索栏 + 菜单栏（≡）。
 * 菜单里是维护者定的「设置」：个人网页背景 + 日间/夜间。
 */
export default function TopBar({ viewerName, isGuest }: Props) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [background, setBackground] = useState('default');
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    migrateLegacyTheme();
    const root = document.documentElement;
    setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
    setBackground(root.dataset.bg || 'default');
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (popRef.current && !popRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const word = keyword.trim();
    if (!word) return;
    router.push(`/search?q=${encodeURIComponent(word)}`);
  }

  /** 菜单里的退出：方便维护者（和同学）一键切回登录页，再选"游客"或换账号 */
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setOpen(false);
    router.replace('/login');
    router.refresh();
  }

  function pickTheme(next: 'light' | 'dark') {
    applyTheme(next);
    setTheme(next);
  }

  function pickBackground(next: string) {
    applyBackground(next);
    setBackground(next);
  }

  return (
    <header className="topbar">
      <form className="search-pill" onSubmit={search} role="search">
        <span className="search-pill-icon">
          <IconSearch size={17} />
        </span>
        <input
          className="search-pill-input"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜作品、活动、同学…"
          aria-label="搜索"
          maxLength={40}
        />
        {keyword && (
          <button type="button" className="search-pill-clear" onClick={() => setKeyword('')}>
            <IconClose size={15} />
          </button>
        )}
      </form>

      <div className="menu-wrap" ref={popRef}>
        <button
          type="button"
          className={`menu-button${open ? ' open' : ''}`}
          onClick={() => setOpen((value) => !value)}
          aria-label="菜单"
          aria-expanded={open}
        >
          <IconMenu size={20} />
        </button>

        {open && (
          <div className="menu-pop">
            <div className="menu-head">
              <span>设置</span>
              <button type="button" className="menu-close" onClick={() => setOpen(false)}>
                <IconClose size={15} />
              </button>
            </div>

            <div className="menu-block">
              <div className="menu-label">显示模式</div>
              <div className="seg">
                <button
                  type="button"
                  className={theme === 'light' ? 'active' : ''}
                  onClick={() => pickTheme('light')}
                >
                  <IconSun size={15} /> 日间
                </button>
                <button
                  type="button"
                  className={theme === 'dark' ? 'active' : ''}
                  onClick={() => pickTheme('dark')}
                >
                  <IconMoon size={15} /> 夜间
                </button>
              </div>
            </div>

            <div className="menu-block">
              <div className="menu-label">我的网页背景</div>
              <div className="bg-row">
                {BACKGROUNDS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`bg-swatch bg-${item.key}${background === item.key ? ' active' : ''}`}
                    onClick={() => pickBackground(item.key)}
                    title={item.label}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-foot">
              {isGuest ? (
                <>
                  <span className="muted">你现在是游客，只能看</span>
                  <Link href="/login" className="btn btn-primary btn-sm">
                    去登录
                  </Link>
                </>
              ) : (
                <>
                  <span className="muted">{viewerName}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <Link href="/me" className="btn btn-sm">
                      我的
                    </Link>
                    <button type="button" className="btn btn-sm btn-danger" onClick={logout}>
                      退出登录
                    </button>
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
