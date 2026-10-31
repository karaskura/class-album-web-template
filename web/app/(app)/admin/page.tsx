import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminClient from '@/components/AdminClient';
import { archivableByUploader, listArchiveBatches, tierCounts } from '@/lib/archive';
import { getStats, listInvites, listMembers, pendingReportCount } from '@/lib/queries';
import { canManage, getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '管理后台' };

export default async function AdminPage() {
  const viewer = await getViewer();
  if (viewer?.kind !== 'user') redirect('/login');
  const user = viewer.user;
  if (!canManage(user)) redirect('/');

  const [members, invites, stats, tiers, uploaderGroups, batches, reports] = await Promise.all([
    listMembers(),
    listInvites(),
    getStats(),
    tierCounts(),
    archivableByUploader(),
    listArchiveBatches(),
    pendingReportCount(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">管理后台</h1>
          <p className="page-sub">审批同学、发邀请码、看看班里现在有多少照片</p>
        </div>
        <Link className="btn btn-sm" href="/admin/reports">
          举报{reports > 0 ? ` (${reports})` : ''}
        </Link>
      </div>

      <AdminClient
        members={members}
        invites={invites}
        stats={stats}
        currentUserId={user.id}
        tiers={tiers}
        uploaderGroups={uploaderGroups}
        batches={batches}
      />
    </>
  );
}
