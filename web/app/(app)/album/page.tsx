import Link from 'next/link';
import { MasonryPhoto } from '@/components/PhotoCard';
import { IconUpload } from '@/components/icons';
import { groupPhotosByDay, listPhotos } from '@/lib/queries';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '时间轴' };

const PAGE_SIZE = 48;

/** 班级相册栏目 · 时间轴（原来的首页，2026-10-05 平台化后挪到 /album） */
export default async function AlbumTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) return null; // layout 已经重定向，这里只是类型兜底

  const viewerId = viewer.kind === 'user' ? viewer.user.id : 0;
  const canWrite = viewer.kind === 'user';

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const photos = await listPhotos(viewerId, { limit: PAGE_SIZE + 1, offset });
  const hasMore = photos.length > PAGE_SIZE;
  const visible = hasMore ? photos.slice(0, PAGE_SIZE) : photos;
  const groups = groupPhotosByDay(visible);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">班级相册</h1>
          <p className="page-sub">我们班的照片都在这里，按发布的时间排。</p>
        </div>
        <span className="spacer" />
        {canWrite && (
          <Link href="/upload" className="btn btn-primary btn-sm">
            <IconUpload size={16} />
            上传照片
          </Link>
        )}
      </div>

      <div className="seg-nav">
        <Link href="/album" className="seg-nav-item active">
          时间轴
        </Link>
        <Link href="/albums" className="seg-nav-item">
          相册
        </Link>
        <Link href="/memories" className="seg-nav-item">
          回忆
        </Link>
        <Link href="/search" className="seg-nav-item">
          搜索
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">📷</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>相册还是空的</div>
          <p style={{ marginTop: 6 }}>
            第一个上传照片的人，往往会被记很久。
            <br />
            {canWrite ? '点右上角「上传照片」开始吧。' : '登录之后就能上传了。'}
          </p>
          {canWrite ? (
            <Link href="/upload" className="btn btn-primary" style={{ marginTop: 14 }}>
              <IconUpload size={16} />
              上传第一张
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ marginTop: 14 }}>
              去登录
            </Link>
          )}
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <section key={group.day}>
              <div className="day-head">
                <span className="day-title">{group.label}</span>
                <span className="day-count">{group.photos.length} 张</span>
              </div>
              <div className="masonry">
                {group.photos.map((photo) => (
                  <MasonryPhoto key={photo.id} photo={photo} />
                ))}
              </div>
            </section>
          ))}

          <div className="row" style={{ justifyContent: 'center', marginTop: 28, gap: 10 }}>
            {page > 1 && (
              <Link href={`/album?page=${page - 1}`} className="btn">
                上一页
              </Link>
            )}
            {hasMore && (
              <Link href={`/album?page=${page + 1}`} className="btn btn-primary">
                看更早的照片
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
