import Link from 'next/link';
import SearchBox from '@/components/SearchBox';
import { IconSparkles } from '@/components/icons';
import { listYears } from '@/lib/queries';
import { getViewer } from '@/lib/session';
import { mediaUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '年度回忆' };

export default async function MemoriesPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const years = await listYears();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">年度回忆</h1>
          <p className="page-sub">按年份看看我们班这一年都干了什么</p>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SearchBox />
      </div>

      {years.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">✨</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有照片</div>
          <p style={{ marginTop: 6 }}>
            等你们传了照片，这里会自动按年份整理出来。
          </p>
          <Link href="/upload" className="btn btn-primary" style={{ marginTop: 14 }}>
            去上传
          </Link>
        </div>
      ) : (
        <div className="year-grid">
          {years.map((item) => (
            <Link key={item.year} href={`/memories/${item.year}`} className="year-card">
              <div className="year-cover">
                {[0, 1, 2].map((index) => {
                  const key = item.covers[index];
                  const src = key ? mediaUrl(key) : '';
                  return src ? (
                    <img key={index} src={src} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div key={index} className="skeleton" />
                  );
                })}
              </div>
              <div className="year-body">
                <div className="row-between">
                  <span className="year-title">{item.year} 年</span>
                  <span className="badge badge-accent">
                    <IconSparkles size={13} />
                    {item.photoCount} 张
                  </span>
                </div>
                <div className="year-sub">
                  {item.uploaderCount} 位同学上传
                  {item.albumCount > 0 ? ` · ${item.albumCount} 个相册` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
