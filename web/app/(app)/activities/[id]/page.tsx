import Link from 'next/link';
import { notFound } from 'next/navigation';
import LaceFrame from '@/components/LaceFrame';
import { IconCalendar } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import { getActivity } from '@/lib/queries';
import { getViewer } from '@/lib/session';
import { mediaUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return null;

  const { id } = await params;
  const activityId = Number(id);
  if (!Number.isInteger(activityId) || activityId <= 0) notFound();

  const activity = await getActivity(activityId);
  if (!activity) notFound();

  const cover = mediaUrl(activity.cover_key);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{activity.title}</h1>
          <p className="page-sub">
            {activity.creator_name ?? '管理员'} 发布 · {formatDateTime(activity.published_at)} ·{' '}
            {activity.participant_count} 人参加
          </p>
        </div>
        <span className="spacer" />
        <Link href="/activities" className="btn btn-sm">
          回活动列表
        </Link>
      </div>

      {cover ? (
        <div className="activity-hero">
          <LaceFrame withBow />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={activity.title} />
        </div>
      ) : (
        <div className="activity-hero activity-hero-empty">
          <LaceFrame />
          <IconCalendar size={34} />
          <span className="muted">这个活动没有封面</span>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          活动内容
        </div>
        {activity.description ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{activity.description}</p>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            发布者没有写详细内容。
          </p>
        )}
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          参加人员
          <span className="count">{activity.participant_count} 人</span>
        </div>
        {activity.participants && activity.participants.length > 0 ? (
          <div className="chip-row">
            {activity.participants.map((name) => (
              <span key={name} className="chip">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            这次没有指定参加人员。
          </p>
        )}
      </div>
    </>
  );
}
