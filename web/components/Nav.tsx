'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Avatar from './Avatar';
import LaceFrame from './LaceFrame';
import ThemeToggle from './ThemeToggle';
import {
  IconAlbumLogo,
  IconAlbums,
  IconCalendar,
  IconFlask,
  IconHome,
  IconShield,
  IconSparkles,
  IconTimeline,
  IconUpload,
  IconUser,
} from './icons';

export type NavViewer =
  | { kind: 'user'; name: string; studentNo: string; canManage: boolean }
  | { kind: 'guest' };

type Item = {
  href: string;
  label: string;
  Icon: (props: { size?: number }) => React.ReactElement;
};

/** 五个栏目（顺序照维护者的图：班级相册 / 活动 / 主页 / 测试中 / 我的，主页在正中） */
const SECTIONS: Item[] = [
  { href: '/album', label: '班级相册', Icon: IconAlbums },
  { href: '/activities', label: '活动', Icon: IconCalendar },
  { href: '/', label: '主页', Icon: IconHome },
  { href: '/testing', label: '测试中', Icon: IconFlask },
  { href: '/me', label: '我的', Icon: IconUser },
];

/** 班级相册栏目里的子页面（桌面侧边栏用） */
const ALBUM_LINKS: Item[] = [
  { href: '/album', label: '时间轴', Icon: IconTimeline },
  { href: '/albums', label: '相册', Icon: IconAlbums },
  { href: '/memories', label: '回忆', Icon: IconSparkles },
  { href: '/upload', label: '上传照片', Icon: IconUpload },
];

/** 哪个栏目算"当前"——班级相册要把它的子页面都算进去 */
function matches(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/album') {
    return ['/album', '/albums', '/photos', '/memories', '/upload', '/search'].some(
      (base) => pathname === base || pathname.startsWith(`${base}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => matches(href, pathname);
}

/** 桌面端：左侧固定侧边栏 */
export function SidebarNav({ viewer, avatarUrl }: { viewer: NavViewer; avatarUrl?: string | null }) {
  const isActive = useIsActive();

  return (
    <aside className="sidebar">
      <LaceFrame />
      <div className="brand">
        <IconAlbumLogo size={26} />
        <span>班级相册</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {SECTIONS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`nav-item${isActive(href) ? ' active' : ''}`}>
            <span className="nav-icon">
              <Icon size={19} />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-sub">
        <div className="sidebar-sub-title">班级相册</div>
        {ALBUM_LINKS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="sidebar-sub-item">
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>

      {viewer.kind === 'user' && viewer.canManage && (
        <div style={{ marginTop: 10 }}>
          <Link href="/admin" className={`nav-item${isActive('/admin') ? ' active' : ''}`}>
            <span className="nav-icon">
              <IconShield size={18} />
            </span>
            管理后台
          </Link>
        </div>
      )}


      <div className="sidebar-foot">
        <div className="row" style={{ padding: '4px 6px' }}>
          {viewer.kind === 'user' ? (
            <>
              <Avatar name={viewer.name} src={avatarUrl} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {viewer.name}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {viewer.studentNo}
                </div>
              </div>
            </>
          ) : (
            <>
              <Avatar name="游" />
              <div className="grow">
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>游客</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  只看看，不动手
                </div>
              </div>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** 手机端：底部 tab 栏（中间那格是凸起的「主页」） */
export function BottomTabs() {
  const isActive = useIsActive();

  return (
    <nav className="tabbar">
      {SECTIONS.map(({ href, label, Icon }) => {
        const center = href === '/';
        return (
          <Link
            key={href}
            href={href}
            className={`${isActive(href) ? 'active' : ''}${center ? ' tab-center' : ''}`}
          >
            <span className="tab-icon">
              {center ? (
                <span className="tab-center-circle">
                  <Icon size={24} />
                </span>
              ) : (
                <Icon size={22} />
              )}
            </span>
            <span className="tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
