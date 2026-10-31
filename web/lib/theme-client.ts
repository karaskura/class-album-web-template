/**
 * 主题 / 网页背景的客户端读写。
 *
 * 2026-10-18：主题从「localStorage + 内联脚本」改成「cookie + 服务端渲染」，
 * 因为内联脚本在 React 19 里会报 Console Error（开发模式弹红框）。
 * 这里负责两件事：
 *   1. 用户切换主题时同时写 cookie（服务端下次就能直接渲染出正确的属性）；
 *   2. 把老用户 localStorage 里的选择搬进 cookie，别让人家的设置丢了。
 */

export const THEME_COOKIE = 'album-theme';
export const BG_COOKIE = 'album-bg';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** 切换主题：页面属性 + cookie + 老版本 localStorage 一并更新 */
export function applyTheme(next: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = next;
  writeCookie(THEME_COOKIE, next);
  try {
    localStorage.setItem(THEME_COOKIE, next);
  } catch {
    /* 隐私模式写不了就算了 */
  }
}

export function applyBackground(next: string): void {
  document.documentElement.dataset.bg = next;
  writeCookie(BG_COOKIE, next);
  try {
    localStorage.setItem(BG_COOKIE, next);
  } catch {
    /* 同上 */
  }
}

/** 把老用户存在 localStorage 里的选择搬进 cookie（只补缺，不覆盖） */
export function migrateLegacyTheme(): void {
  if (typeof document === 'undefined') return;
  try {
    if (!readCookie(THEME_COOKIE)) {
      const legacy = localStorage.getItem(THEME_COOKIE);
      if (legacy === 'light' || legacy === 'dark') writeCookie(THEME_COOKIE, legacy);
    }
    if (!readCookie(BG_COOKIE)) {
      const legacyBg = localStorage.getItem(BG_COOKIE);
      if (legacyBg) writeCookie(BG_COOKIE, legacyBg);
    }
  } catch {
    /* 忽略 */
  }
}
