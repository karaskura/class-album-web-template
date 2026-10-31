import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReportAdminList from '@/components/ReportAdminList';
import { listReports } from '@/lib/queries';
import { canManage, getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '举报处理' };

export default async function AdminReportsPage() {
  const viewer = await getViewer();
  if (viewer?.kind !== 'user') redirect('/login');
  if (!canManage(viewer.user)) redirect('/');

  const reports = await listReports();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">举报处理</h1>
          <p className="page-sub">同学举报的照片 / 评论都在这里；处理动作会记进审计日志</p>
        </div>
        <Link className="btn btn-sm" href="/admin">
          ← 回管理后台
        </Link>
      </div>

      <ReportAdminList reports={reports} />
    </>
  );
}
