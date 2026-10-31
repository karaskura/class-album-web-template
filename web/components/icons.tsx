/**
 * 图标集合：全部是内联 SVG，不依赖任何图标库，也不用外部字体。
 */
type IconProps = { size?: number; className?: string };

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export function IconTimeline({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 4v5" />
    </svg>
  );
}

export function IconAlbums({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="5" width="14" height="14" rx="2.5" />
      <path d="M21 8v9a3 3 0 0 1-3 3h-9" />
      <circle cx="8" cy="10" r="1.4" />
      <path d="M3 16.5l3.6-3.2a2 2 0 0 1 2.7 0L17 19" />
    </svg>
  );
}

export function IconUpload({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 16V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function IconUser({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function IconShield({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
      <path d="M9.2 12.2l2 2 3.6-3.8" />
    </svg>
  );
}

export function IconHeart({ size = 18, className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size, className)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.6c0 5-7 9.4-7 9.4z" />
    </svg>
  );
}

export function IconComment({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.1A7.5 7.5 0 1 1 20 12z" />
    </svg>
  );
}

/** 铃铛：通知用（维护者 2026-10-05 亲自挑的图标） */
export function IconBell({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M18 16.2H6l1.4-2V10a4.6 4.6 0 0 1 9.2 0v4.2z" />
      <path d="M10.4 19.2a1.9 1.9 0 0 0 3.2 0" />
    </svg>
  );
}

export function IconDownload({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function IconSearch({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function IconMap({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="2.4" />
    </svg>
  );
}

export function IconSparkles({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

export function IconPlus({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export function IconX({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconTrash({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </svg>
  );
}

export function IconSun({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export function IconAlbumLogo({ size = 28, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="5" width="15" height="14" rx="3" fill="currentColor" opacity="0.28" />
      <rect x="6" y="3.5" width="15" height="14" rx="3" fill="currentColor" opacity="0.55" />
      <circle cx="10.5" cy="8.5" r="1.6" fill="#fff" />
      <path d="M7 16.6l4-3.6a2 2 0 0 1 2.6 0l3.9 3.6z" fill="#fff" />
    </svg>
  );
}

/** 主页（底部中间那个凸起的） */
export function IconHome({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.8 10.6 12 4l8.2 6.6" />
      <path d="M6.2 9.6V20h11.6V9.6" />
      <path d="M10 20v-5.2h4V20" />
    </svg>
  );
}

/** 活动（日历） */
export function IconCalendar({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="3.2" />
      <path d="M3.6 9.8h16.8" />
      <path d="M8.2 3.6v3.2M15.8 3.6v3.2" />
      <path d="M7.6 13.4h3.2M7.6 16.8h6.4" />
    </svg>
  );
}

/** 测试中（烧瓶） */
export function IconFlask({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9.2 3.6h5.6" />
      <path d="M10.2 3.6v5.3l-4.5 8.4A2.4 2.4 0 0 0 7.8 20.8h8.4a2.4 2.4 0 0 0 2.1-3.5l-4.5-8.4V3.6" />
      <path d="M7.4 15.4h9.2" />
    </svg>
  );
}

/** 菜单栏（≡） */
export function IconMenu({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** 关掉（活动发布页右上角） */
export function IconClose({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />
    </svg>
  );
}

/** 图片（活动封面占位） */
export function IconImage({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3.6" y="4.8" width="16.8" height="14.4" rx="3.2" />
      <circle cx="9" cy="10.2" r="1.6" />
      <path d="M4.4 17.4 9.8 12l3.2 3 2.6-2.2 4 4.6" />
    </svg>
  );
}
