import Link from 'next/link';
import LaceFrame from '@/components/LaceFrame';
import { IconCalendar, IconComment, IconFlask, IconHeart } from '@/components/icons';
import { formatDay, relativeTime } from '@/lib/format';
import PromoCarousel from '@/components/PromoCarousel';
import { listActivities, listPhotos, listHomePromos } from '@/lib/queries';
import { getViewer } from '@/lib/session';
import { mediaUrl, promoImageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '主页' };

const HOME_WORKS = 6;

/**
 * 主页（维护者 2026-10-05 的 SSS 设计）：
 *  上面一条活动横幅，下面两列六个小方格 —— 用户发布的作品，
 *  现在只有「班级相册」的照片，以后会混进别的形式（所以每格带一个类型角标）。
 */
export default async function HomePage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const viewerId = viewer.kind === 'user' ? viewer.user.id : 0;
  const canWrite = viewer.kind === 'user';

  const [works, activities, promoRows] = await Promise.all([
    listPhotos(viewerId, { limit: HOME_WORKS }),
    listActivities(1),
    listHomePromos(8),
  ]);
  const banner = activities[0];
  const promos = promoRows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: promoImageUrl(row.image_key),
    linkUrl: row.link_url,
  }));

  return (
    <>
      {promos.length > 0 ? (
        <PromoCarousel promos={promos} />
      ) : banner ? (
        <Link href={`/activities/${banner.id}`} className="home-banner">
          <LaceFrame withBow />
          {banner.cover_key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(banner.cover_key)} alt={banner.title} />
          ) : (
            <span className="home-banner-fallback">
              <IconCalendar size={30} />
            </span>
          )}
          <span className="home-banner-caption">
            <span className="home-banner-tag">最新活动</span>
            <span className="home-banner-title">{banner.title}</span>
            <span className="home-banner-sub">
              {banner.creator_name ? `${banner.creator_name} · ` : ''}
              {formatDay(banner.published_at)} · {banner.participant_count} 人参加
            </span>
          </span>
        </Link>
      ) : (
        <div className="home-banner home-banner-empty">
          <LaceFrame withBow />
          <IconCalendar size={28} />
          <div>
            <div style={{ fontWeight: 600 }}>还没有活动</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              等管理员发第一个活动，这里就会热闹起来
            </div>
          </div>
        </div>
      )}

      <div className="section-title">
        大家的作品
        <span className="count">{works.length > 0 ? `最新 ${works.length} 件` : ''}</span>
        <span className="spacer" />
        {canWrite && (
          <Link href="/upload" className="btn btn-sm">
            发布作品
          </Link>
        )}
      </div>

      {works.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon" style={{ fontSize: 30 }}>
            <IconFlask size={30} />
          </span>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有作品</div>
          <p style={{ marginTop: 6 }}>
            班级相册里的照片会出现在这里，
            <br />
            以后还会有别的形式。
          </p>
        </div>
      ) : (
        <div className="work-grid">
          {works.map((photo) => {
            const title = photo.description?.trim() || '未命名作品';
            return (
              <Link key={photo.id} href={`/photos/${photo.id}`} className="work-card">
                <span className="work-cover">
                  {mediaUrl(photo.micro_key) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(photo.micro_key)} alt={title} loading="lazy" />
                  ) : (
                    <span className="skeleton" style={{ width: '100%', height: '100%' }} />
                  )}
                  <span className="work-badge">照片</span>
                </span>
                <span className="work-body">
                  <span className="work-title">{title}</span>
                  <span className="work-meta">
                    <span className="work-author">{photo.uploader_name ?? '同学'}</span>
                    <span className="work-stats">
                      <span className="row" style={{ gap: 3 }}>
                        <IconHeart size={12} filled={photo.liked_by_me} />
                        {photo.like_count}
                      </span>
                      <span className="row" style={{ gap: 3 }}>
                        <IconComment size={12} />
                        {photo.comment_count}
                      </span>
                    </span>
                  </span>
                  <span className="work-time">{relativeTime(photo.created_at)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
