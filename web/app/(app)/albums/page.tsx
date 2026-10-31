import Link from 'next/link';
import CreateAlbumForm from '@/components/CreateAlbumForm';
import { AlbumCard } from '@/components/PhotoCard';
import { listAlbums } from '@/lib/queries';
import { canManage, getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '相册' };

export default async function AlbumsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const user = viewer.kind === 'user' ? viewer.user : null;
  const viewerId = viewer.kind === 'user' ? viewer.user.id : 0;

  const albums = await listAlbums();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">相册</h1>
          <p className="page-sub">按活动、按主题分好的照片合集</p>
        </div>
        <span className="spacer" />
        {canManage(user) && <CreateAlbumForm />}
      </div>

      {albums.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🗂️</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有相册</div>
          <p style={{ marginTop: 6 }}>
            {canManage(user)
              ? '点右上角「新建相册」，比如先建一个「秋季运动会」。'
              : '等班长建好相册，照片就可以归档进来了。'}
          </p>
        </div>
      ) : (
        <div className="album-grid">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      )}

      <p className="form-hint" style={{ marginTop: 20 }}>
        照片不进相册也没关系，时间轴里一样能看到。{' '}
        <Link href="/upload" style={{ color: 'var(--accent)' }}>
          去上传
        </Link>
      </p>
    </>
  );
}
