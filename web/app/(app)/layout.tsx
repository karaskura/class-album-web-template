import Link from 'next/link';
import { redirect } from 'next/navigation';
import ImageGuard from '@/components/ImageGuard';
import LaceFrame from '@/components/LaceFrame';
import { BottomTabs, SidebarNav, type NavViewer } from '@/components/Nav';
import PwaInstallTip from '@/components/PwaInstallTip';
import SiteFooter from '@/components/SiteFooter';
import TopBar from '@/components/TopBar';
import { canManage, getViewer } from '@/lib/session';
import { mediaUrl } from '@/lib/storage';

// 每个请求都要读 cookie / 数据库，不做静态化
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  // 既没登录、也不是游客 → 回登录页选一个身份
  if (!viewer) redirect('/login');

  const navViewer: NavViewer =
    viewer.kind === 'user'
      ? {
          kind: 'user',
          name: viewer.user.name,
          studentNo: viewer.user.student_no,
          canManage: canManage(viewer.user),
        }
      : { kind: 'guest' };

  const avatarUrl = viewer.kind === 'user' ? mediaUrl(viewer.user.avatar_key) : null;

  return (
    <div className="app-shell">
      <SidebarNav viewer={navViewer} avatarUrl={avatarUrl} />

      <div className="content-area">
        <LaceFrame />
        <TopBar
          viewerName={viewer.kind === 'user' ? viewer.user.name : null}
          isGuest={viewer.kind === 'guest'}
        />

        {viewer.kind === 'guest' && (
          <div className="guest-strip">
            <span>你是游客：只能看，评论 / 点赞 / 发布都要先登录</span>
            <Link href="/login" className="btn btn-primary btn-sm">
              登录 / 加入
            </Link>
          </div>
        )}

        <main className="main">{children}</main>
        <SiteFooter />
      </div>

      <BottomTabs />
      <PwaInstallTip />
      <ImageGuard />
    </div>
  );
}
