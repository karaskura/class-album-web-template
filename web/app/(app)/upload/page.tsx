import UploadClient from '@/components/UploadClient';
import { ALLOWED_MIME, config } from '@/lib/config';
import { listAlbums } from '@/lib/queries';
import { getViewer } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: '上传照片' };

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string }>;
}) {
  const viewer = await getViewer();
  // 上传是账号才能干的事，游客先去登录
  if (viewer?.kind !== 'user') redirect('/login');
  const user = viewer.user;

  const { album } = await searchParams;
  const albumId = Number(album);
  const albums = await listAlbums();
  const options = albums.map((item) => ({ id: item.id, name: item.name }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">上传照片</h1>
          <p className="page-sub">可以一次选很多张，传之前会自动压缩</p>
        </div>
      </div>

      <UploadClient
        albums={options}
        defaultAlbumId={Number.isInteger(albumId) && albumId > 0 ? albumId : null}
        allowedTypes={Array.from(ALLOWED_MIME)}
        maxUploadMb={config.maxUploadMb}
      />
    </>
  );
}
