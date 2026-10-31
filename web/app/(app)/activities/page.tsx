import Link from 'next/link';
import { IconCalendar, IconPlus } from '@/components/icons';
import { formatDay } from '@/lib/format';
import { listActivities } from '@/lib/queries';
import { canPublishActivity, getViewer } from '@/lib/session';
import { mediaUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '活动' };

/** 活动栏目：封面 + 标题的卡片列表；管理员右上角多一个「＋」 */
export default async function ActivitiesPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const canPublish = viewer.kind === 'user' && canPublishActivity(viewer.user);
  const activities = await listActivities(30);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">活动</h1>
          <p className="page-sub">我们班的活动都在这儿</p>
        </div>
        <span className="spacer" />
        {canPublish && (
          <Link href="/activities/new" className="fab-add" aria-label="发布活动" title="发布活动">
            <IconPlus size={22} />
          </Link>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon" style={{ fontSize: 30 }}>
            <IconCalendar size={30} />
          </span>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有活动</div>
          <p style={{ marginTop: 6 }}>
            {canPublish ? '点右上角的「＋」发第一个活动。' : '等管理员发第一个活动。'}
          </p>
          {canPublish && (
            <Link href="/activities/new" className="btn btn-primary" style={{ marginTop: 14 }}>
              <IconPlus size={16} />
              发布活动
            </Link>
          )}
        </div>
      ) : (
        <div className="activity-list">
          {activities.map((activity) => (
            <Link key={activity.id} href={`/activities/${activity.id}`} className="activity-card">
              <span className="activity-cover">
                {activity.cover_key ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(activity.cover_key)} alt={activity.title} loading="lazy" />
                ) : (
                  <span className="activity-cover-fallback">
                    <IconCalendar size={30} />
                  </span>
                )}
              </span>
              <span className="activity-caption">
                <span className="activity-title">{activity.title}</span>
                <span className="activity-sub">
                  {activity.creator_name ?? '管理员'} · {formatDay(activity.published_at)} ·{' '}
                  {activity.participant_count} 人参加
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
