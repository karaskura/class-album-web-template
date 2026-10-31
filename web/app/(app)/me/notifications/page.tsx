import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { IconBell } from '@/components/icons';
import { relativeTime } from '@/lib/format';
import { listNotifications, markNotificationsRead } from '@/lib/queries';
import { mediaUrl } from '@/lib/storage';
import { getViewer } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: '通知' };

/**
 * 通知页（2026-10-05 新增）。
 * 场景：别人点评了你的作品 → 这里列出来，文案是维护者定的原话。
 * 顺序：先读、再全部标成已读 —— 这样"这次进来哪几条是新的"还看得出来（加粗），
 * 而「我的」页那个红点在下次回去时就灭了。
 */
export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (viewer?.kind !== 'user') redirect('/login');
  const user = viewer.user;

  const items = await listNotifications(user.id);
  const unreadCount = items.filter((item) => !item.read_at).length;
  if (unreadCount > 0) await markNotificationsRead(user.id);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">通知</h1>
          <p className="page-sub">
            {unreadCount > 0 ? `${unreadCount} 条新提醒` : '有人点评你的作品时会在这里提醒你'}
          </p>
        </div>
      </div>

      <div className="card card-pad">
        {items.length === 0 ? (
          <div className="empty-block">
            <span className="notify-bell" style={{ fontSize: 0 }}>
              <IconBell size={30} />
            </span>
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 13.5 }}>
              还没有通知。等有人来点评你的作品，铃铛就会亮。
            </p>
          </div>
        ) : (
          <div className="notify-list">
            {items.map((item) => {
              const title = item.photo_desc?.trim() || '未命名照片';
              const actor = item.actor_name ?? '某位同学';
              const href = item.photo_id ? `/photos/${item.photo_id}` : '/';
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={item.read_at ? 'notify-item' : 'notify-item unread'}
                >
                  <Avatar name={actor} src={mediaUrl(item.actor_avatar)} />
                  <span className="grow">
                    <span className="notify-text">
                      你的作品「{title}」被「{actor}」点评了，快来看看吧
                    </span>
                    <span className="muted notify-time">{relativeTime(item.created_at)}</span>
                  </span>
                  {item.photo_thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="notify-thumb" src={mediaUrl(item.photo_thumb)} alt={title} />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <p className="form-hint" style={{ marginTop: 18 }}>
        通知只留最近的 50 条。作品删掉之后，相关的通知也会跟着消失。
      </p>
    </>
  );
}
