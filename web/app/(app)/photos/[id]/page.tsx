import Link from 'next/link';
import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import CommentSection from '@/components/CommentSection';
import DeletePhotoButton from '@/components/DeletePhotoButton';
import PhotoEditForm from '@/components/PhotoEditForm';
import LikeButton from '@/components/LikeButton';
import ReportButton from '@/components/ReportButton';
import { formatBytes, formatDateTime, relativeTime } from '@/lib/format';
import { getPhoto, listAlbums, listComments } from '@/lib/queries';
import { canManage, getViewer } from '@/lib/session';
import { mediaUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const user = viewer.kind === 'user' ? viewer.user : null;
  const viewerId = user?.id ?? 0;
  const canWrite = !!user;

  const { id } = await params;
  const photoId = Number(id);
  if (!Number.isInteger(photoId) || photoId <= 0) notFound();

  const photo = await getPhoto(photoId, viewerId);
  if (!photo) notFound();

  const [rawComments, albums] = await Promise.all([listComments(photoId), listAlbums()]);
  // 客户端组件不能 import 存储模块，所以这里把头像 URL 先拼好
  const comments = rawComments.map((c) => ({ ...c, avatarUrl: mediaUrl(c.author_avatar) }));
  const bigSrc = mediaUrl(photo.thumb_key);
  // 原图（storage_key）不再下发给页面——下载功能已取消（2026-10-05）
  const takenLabel = photo.taken_at ? formatDateTime(photo.taken_at) : null;

  // 上传者能删自己的，管理员能删任何一张
  const canDelete = !!user && (photo.uploader_id === user.id || canManage(user));

  return (
    <>
      {photo.album_id && (
        <p className="page-sub" style={{ marginBottom: 12 }}>
          <Link href={`/albums/${photo.album_id}`} style={{ color: 'var(--accent)' }}>
            ← {photo.album_name ?? '返回相册'}
          </Link>
        </p>
      )}

      <div className="photo-detail">
        <div className="photo-stage">
          {bigSrc ? (
            <img src={bigSrc} alt={photo.description ?? '照片'} />
          ) : (
            <div className="muted" style={{ padding: 40 }}>
              图片暂时读不到
            </div>
          )}
        </div>

        <div className="detail-side">
          <div className="card card-pad">
            <div className="row" style={{ marginBottom: 14 }}>
              <Avatar name={photo.uploader_name ?? '?'} src={mediaUrl(photo.uploader_avatar)} />
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{photo.uploader_name ?? '已注销的同学'}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {relativeTime(photo.created_at)}上传
                </div>
              </div>
            </div>

            <div className="meta-list">
              {takenLabel && (
                <div className="meta-row">
                  <span className="meta-key">拍摄于</span>
                  <span title="来自照片自带的 EXIF 信息">
                    {takenLabel}
                    <span className="muted">（照片自带的信息）</span>
                  </span>
                </div>
              )}
              <div className="meta-row">
                <span className="meta-key">相册</span>
                <span>{photo.album_name ?? '未归类'}</span>
              </div>
              {photo.width && photo.height && (
                <div className="meta-row">
                  <span className="meta-key">尺寸</span>
                  <span>
                    {photo.width} × {photo.height}
                    {photo.bytes ? ` · ${formatBytes(photo.bytes)}` : ''}
                  </span>
                </div>
              )}
              <div className="meta-row">
                <span className="meta-key">可见范围</span>
                <span>仅本班成员</span>
              </div>
            </div>

            {photo.description && (
              <>
                <hr className="divider" />
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{photo.description}</p>
              </>
            )}
          </div>

          <div className="action-bar">
            {canWrite ? (
              <LikeButton
                photoId={photo.id}
                initialLiked={photo.liked_by_me}
                initialCount={photo.like_count}
              />
            ) : (
              <span className="btn" style={{ cursor: 'default' }}>
                游客只能看
              </span>
            )}
            {/* 原图下载已取消（维护者 2026-10-05：防图片被盗用），不要再加回来 */}
            {photo.album_id && (
              <Link className="btn" href={`/albums/${photo.album_id}`}>
                看同相册
              </Link>
            )}
            {canDelete && (
              <PhotoEditForm
                photoId={photo.id}
                initialDescription={photo.description}
                initialAlbumId={photo.album_id}
                albums={albums.map((item) => ({ id: item.id, name: item.name }))}
              />
            )}
            {canDelete && (
              <DeletePhotoButton
                photoId={photo.id}
                isOwner={photo.uploader_id === user.id}
              />
            )}
            {/* 举报（2026-10-08 · 安全评估要求建立举报机制）：不是自己传的才能举报 */}
            {user && photo.uploader_id !== user.id && (
              <ReportButton targetType="photo" targetId={photo.id} />
            )}
          </div>

          <div className="card card-pad">
            <CommentSection
              photoId={photo.id}
              initialComments={comments}
              currentUserName={user?.name ?? '游客'}
              currentUserAvatarUrl={user ? mediaUrl(user.avatar_key) : ''}
              currentUserId={user?.id ?? null}
              canModerate={!!user && canManage(user)}
              canComment={canWrite}
            />
          </div>
        </div>
      </div>
    </>
  );
}
