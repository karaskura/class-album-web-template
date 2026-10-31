import Link from 'next/link';
import { notFound } from 'next/navigation';
import AlbumAdminBar from '@/components/AlbumAdminBar';
import { GridPhoto } from '@/components/PhotoCard';
import { IconUpload } from '@/components/icons';
import { formatDay } from '@/lib/format';
import { getAlbum, listPhotos } from '@/lib/queries';
import { canManage, getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 120;

export default async function AlbumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const user = viewer.kind === 'user' ? viewer.user : null;
  const viewerId = viewer.kind === 'user' ? viewer.user.id : 0;

  const { id } = await params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId <= 0) notFound();

  const album = await getAlbum(albumId);
  if (!album) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const photos = await listPhotos(viewerId, {
    albumId,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasMore = photos.length > PAGE_SIZE;
  const visible = hasMore ? photos.slice(0, PAGE_SIZE) : photos;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{album.name}</h1>
          <p className="page-sub">
            {album.photo_count} 张照片
            {album.event_date ? ` · ${formatDay(album.event_date)}` : ''}
            {album.created_by_name ? ` · 由 ${album.created_by_name} 创建` : ''}
          </p>
          {album.description && (
            <p className="page-sub" style={{ marginTop: 4 }}>
              {album.description}
            </p>
          )}
        </div>
        <span className="spacer" />
        <Link href={`/upload?album=${album.id}`} className="btn btn-primary btn-sm">
          <IconUpload size={16} />
          上传到这里
        </Link>
        {canManage(user) && (
          <AlbumAdminBar
            albumId={album.id}
            albumName={album.name}
            photoCount={album.photo_count}
            initialDescription={album.description}
            initialEventDate={album.event_date}
          />
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🖼️</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>这个相册还没有照片</div>
          <Link href={`/upload?album=${album.id}`} className="btn btn-primary" style={{ marginTop: 14 }}>
            上传第一张
          </Link>
        </div>
      ) : (
        <div className="photo-grid">
          {visible.map((photo) => (
            <GridPhoto key={photo.id} photo={photo} />
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 22, gap: 10 }}>
          {page > 1 && (
            <Link href={`/albums/${album.id}?page=${page - 1}`} className="btn">
              上一页
            </Link>
          )}
          {hasMore && (
            <Link href={`/albums/${album.id}?page=${page + 1}`} className="btn btn-primary">
              看更多
            </Link>
          )}
        </div>
      )}

      <p className="form-hint" style={{ marginTop: 22 }}>
        <Link href="/albums" style={{ color: 'var(--accent)' }}>
          ← 回到相册列表
        </Link>
      </p>
    </>
  );
}
