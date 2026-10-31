import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GridPhoto, MasonryPhoto } from '@/components/PhotoCard';
import { groupPhotosByMonth, photosByYear, topLikedPhotos } from '@/lib/queries';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function MemoriesYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const user = viewer.kind === 'user' ? viewer.user : null;
  const viewerId = viewer.kind === 'user' ? viewer.user.id : 0;

  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();

  const [photos, top] = await Promise.all([
    photosByYear(viewerId, year),
    topLikedPhotos(viewerId, year, 3),
  ]);

  if (photos.length === 0) notFound();

  const months = groupPhotosByMonth(photos);
  const uploaders = new Set(photos.map((p) => p.uploader_id).filter(Boolean)).size;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{year} 年</h1>
          <p className="page-sub">
            {photos.length} 张照片 · {uploaders} 位同学上传 · 横跨 {months.length} 个月
          </p>
        </div>
        <span className="spacer" />
        <Link href="/memories" className="btn btn-sm">
          其它年份
        </Link>
      </div>

      {top.length > 0 && top[0].like_count > 0 && (
        <section style={{ marginBottom: 26 }}>
          <div className="section-title">
            这一年最受欢迎的
            <span className="count">按点赞数</span>
          </div>
          <div className="photo-grid">
            {top.map((photo) => (
              <GridPhoto key={photo.id} photo={photo} />
            ))}
          </div>
        </section>
      )}

      {months.map((group) => (
        <section key={group.month}>
          <div className="month-head">
            <span className="day-title">{group.month.replace('-', ' 年 ')} 月</span>
            <span className="day-count">{group.photos.length} 张</span>
          </div>
          <div className="masonry">
            {group.photos.map((photo) => (
              <MasonryPhoto key={photo.id} photo={photo} />
            ))}
          </div>
        </section>
      ))}

      <div className="row" style={{ justifyContent: 'center', marginTop: 30 }}>
        <Link href="/memories" className="btn">
          看看别的年份
        </Link>
      </div>
    </>
  );
}
