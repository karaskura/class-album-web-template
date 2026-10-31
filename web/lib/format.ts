/** 前端也能用的格式化工具（不要在这里引入任何 node 模块） */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 2026-09-15 */
export function formatDay(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 2026-09-15 14:30 */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 刚刚 / 5 分钟前 / 3 天前 / 2026-09-15 */
export function relativeTime(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDay(d);
}

/** 1.2 MB */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** 给瀑布流用的宽高比，避免加载时页面跳动 */
export function aspectRatio(width: number | null, height: number | null): string {
  if (!width || !height) return '4 / 3';
  return `${width} / ${height}`;
}
