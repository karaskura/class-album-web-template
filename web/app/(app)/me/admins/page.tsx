import Link from 'next/link';
import { redirect } from 'next/navigation';
import ManagerAdmin from '@/components/ManagerAdmin';
import { query } from '@/lib/db';
import { listParticipantOptions } from '@/lib/queries';
import { getViewer, isOwner } from '@/lib/session';
import type { ManagerRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: '管理员账号管理' };

/** 「我的 → 管理员账号管理」：只有维护者能进（2026-10-05 晚） */
export default async function AdminsPage() {
  const viewer = await getViewer();
  if (viewer?.kind !== 'user') redirect('/login');
  if (!isOwner(viewer.user)) redirect('/me');

  const [managers, people] = await Promise.all([
    query<ManagerRow>(
      `select id, name, student_no, admin_level, avatar_key
         from users
        where role = 'admin'
        order by admin_level, student_no`,
    ),
    listParticipantOptions(),
  ]);

  const adminIds = new Set(managers.map((manager) => manager.id));
  const candidates = people
    .filter((person) => !adminIds.has(person.id))
    .map((person) => ({ id: person.id, name: person.name, student_no: person.student_no }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">管理员账号管理</h1>
          <p className="page-sub">添加时挑等级；撤销之后就恢复成普通同学</p>
        </div>
        <span className="spacer" />
        <Link href="/me" className="btn btn-sm">
          回我的
        </Link>
      </div>

      <ManagerAdmin
        managers={managers.map((manager) => ({
          id: manager.id,
          name: manager.name,
          student_no: manager.student_no,
          admin_level: manager.admin_level ?? 2,
        }))}
        candidates={candidates}
      />
    </>
  );
}
