import Link from 'next/link';
import { MasonryPhoto } from '@/components/PhotoCard';
import SearchBox from '@/components/SearchBox';
import { searchPhotos, searchSummary } from '@/lib/queries';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '搜索' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const user = viewer.kind === 'user' ? viewer.user : null;
  const viewerId = viewer.kind === 'user' ? viewer.user.id : 0;

  const { q } = await searchParams;
  const keyword = (q ?? '').trim();

  const photos = keyword ? await searchPhotos(viewerId, keyword) : [];
  const summary = keyword ? await searchSummary(keyword) : null;

  return (
    <>
      <div className="page-head">
        <div style={{ width: '100%' }}>
          <h1 className="page-title">搜索</h1>
          <p className="page-sub">
            {keyword
              ? `「${keyword}」找到 ${photos.length} 张照片`
              : '搜照片描述、上传的人、相册名'}
          </p>
          <div style={{ marginTop: 12 }}>
            <SearchBox initialQuery={keyword} autoFocus={!keyword} />
          </div>
        </div>
      </div>

      {keyword && summary && summary.uploaders.length > 0 && (
        <p className="form-hint" style={{ marginTop: -8 }}>
          相关的人：{summary.uploaders.join('、')}
          {summary.albums > 0 ? `　·　涉及 ${summary.albums} 个相册` : ''}
        </p>
      )}

      {!keyword ? (
        <div className="card empty">
          <div className="empty-icon">🔍</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>输入点什么试试</div>
          <p style={{ marginTop: 6 }}>
            比如同学的名字、活动的名字（秋季运动会）、或者你写过的照片描述。
          </p>
        </div>
      ) : photos.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🙈</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>没有找到「{keyword}」</div>
          <p style={{ marginTop: 6 }}>
            换个词试试？或者
            <Link href="/" style={{ color: 'var(--accent)' }}>
              回时间轴
            </Link>
            翻翻看。
          </p>
        </div>
      ) : (
        <div className="masonry">
          {photos.map((photo) => (
            <MasonryPhoto key={photo.id} photo={photo} />
          ))}
        </div>
      )}
    </>
  );
}
