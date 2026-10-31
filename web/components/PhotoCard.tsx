import Link from 'next/link';
import { aspectRatio, formatDay } from '@/lib/format';
import { mediaUrl } from '@/lib/storage';
import type { AlbumRow, PhotoRow } from '@/lib/types';
import { IconComment, IconHeart } from './icons';

/** 时间轴的瀑布流卡片：整张图按比例铺开 */
export function MasonryPhoto({ photo }: { photo: PhotoRow }) {
  const src = mediaUrl(photo.thumb_key);
  const alt = photo.description?.trim() || `${photo.uploader_name ?? '同学'} 上传的照片`;

  return (
    <Link href={`/photos/${photo.id}`} className="photo-card" prefetch={false}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: aspectRatio(photo.width, photo.height) }}
        />
      ) : (
        <div className="skeleton" style={{ aspectRatio: aspectRatio(photo.width, photo.height) }} />
      )}
      <div className="photo-meta">
        <span className="name">{photo.uploader_name ?? '同学'}</span>
        <span className="likes">
          <span className="row" style={{ gap: 3 }}>
            <IconHeart size={12} filled={photo.liked_by_me} />
            {photo.like_count}
          </span>
          {photo.comment_count > 0 && (
            <span className="row" style={{ gap: 3 }}>
              <IconComment size={12} />
              {photo.comment_count}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}

/** 相册详情里的方格缩略图 */
export function GridPhoto({ photo }: { photo: PhotoRow }) {
  const src = mediaUrl(photo.micro_key);
  const alt = photo.description?.trim() || `${photo.uploader_name ?? '同学'} 上传的照片`;

  return (
    <Link href={`/photos/${photo.id}`} className="photo-cell" prefetch={false} title={alt}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <div className="skeleton" style={{ width: '100%', height: '100%' }} />
      )}
    </Link>
  );
}

/** 相册列表卡片 */
export function AlbumCard({ album }: { album: AlbumRow }) {
  const cover = mediaUrl(album.cover_key);

  return (
    <Link href={`/albums/${album.id}`} className="album-card" prefetch={false}>
      <div className="album-cover">
        {cover ? (
          <img src={cover} alt={album.name} loading="lazy" decoding="async" />
        ) : (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            还没有照片
          </div>
        )}
      </div>
      <div className="album-body">
        <div className="album-name">{album.name}</div>
        <div className="album-sub">
          {album.photo_count} 张
          {album.event_date ? ` · ${formatDay(album.event_date)}` : ''}
        </div>
      </div>
    </Link>
  );
}
