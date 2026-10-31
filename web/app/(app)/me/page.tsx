import Link from 'next/link';
import { redirect } from 'next/navigation';
import Avatar from '@/components/Avatar';
import AvatarUpload from '@/components/AvatarUpload';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import LogoutButton from '@/components/LogoutButton';
import { GridPhoto } from '@/components/PhotoCard';
import { IconBell, IconImage, IconShield, IconUpload, IconUser } from '@/components/icons';
import { countUnreadNotifications, listPhotos } from '@/lib/queries';
import { mediaUrl } from '@/lib/storage';
import { canManage, getViewer, isOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '我的' };

export default async function MePage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  // 游客点「我的」：不把他弹回登录页，给他一个自己的卡片和入口
  if (viewer.kind === 'guest') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">我的</h1>
            <p className="page-sub">你现在是游客</p>
          </div>
        </div>

        <div className="card card-pad">
          <div className="row" style={{ gap: 12 }}>
            <Avatar name="游" />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 16 }}>游客</div>
              <div className="muted" style={{ fontSize: 13 }}>
                能看照片和活动；不能评论、点赞、发布作品或活动
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary">
              去登录 / 申请加入
            </Link>
            <Link href="/album" className="btn">
              继续随便看看
            </Link>
          </div>
        </div>

        <p className="form-hint" style={{ marginTop: 18 }}>
          登录之后，这里才有你的作品、通知和管理入口。
        </p>
      </>
    );
  }

  const user = viewer.user;

  const [mine, liked, unread] = await Promise.all([
    listPhotos(user.id, { uploaderId: user.id, limit: 24 }),
    listPhotos(user.id, { likedBy: user.id, limit: 24 }),
    countUnreadNotifications(user.id),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">我的</h1>
          <p className="page-sub">你上传和赞过的照片</p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <AvatarUpload name={user.name} avatarUrl={mediaUrl(user.avatar_key)} />
          <div className="grow" style={{ minWidth: 140 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{user.name}</div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              学号 {user.student_no}
              {user.role === 'admin'
                ? ` · ${
                    user.admin_level === 0
                      ? '超级管理员'
                      : user.admin_level === 1
                        ? '一级管理员'
                        : '二级管理员'
                  }`
                : ''}
            </div>
          </div>
          <Link href="/upload" className="btn btn-primary btn-sm">
            <IconUpload size={16} />
            上传
          </Link>
        </div>

        {/* 通知（2026-10-05 新增）：有人点评你的作品时，铃铛右上角亮红点 */}
        <div style={{ marginTop: 14 }}>
          <Link href="/me/notifications" className="notify-entry">
            <span className="notify-bell">
              <IconBell size={20} />
              {unread > 0 && <span className="notify-dot" aria-hidden />}
            </span>
            <span className="grow">
              <span style={{ display: 'block', fontWeight: 600, fontSize: 14.5 }}>通知</span>
              <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                {unread > 0 ? `${unread} 条新提醒` : '还没有新提醒'}
              </span>
            </span>
          </Link>
        </div>

        {canManage(user) && (
          <div style={{ marginTop: 14 }}>
            <Link href="/admin" className="btn btn-block">
              <IconShield size={16} />
              进入管理后台
            </Link>
          </div>
        )}

        {/* 管理员账号管理：只有维护者（0 级）能看见、能进 */}
        {isOwner(user) && (
          <div style={{ marginTop: 10 }}>
            <Link href="/me/admins" className="btn btn-block">
              <IconUser size={16} />
              管理员账号管理
            </Link>
          </div>
        )}

        {/* 主页宣传：登录页宣传栏 + 主页横幅，只有维护者能发 */}
        {isOwner(user) && (
          <div style={{ marginTop: 10 }}>
            <Link href="/me/promos" className="btn btn-block">
              <IconImage size={16} />
              主页宣传
            </Link>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <ChangePasswordForm />
        </div>

        <div style={{ marginTop: 10 }}>
          <LogoutButton />
        </div>
      </div>

      <section>
        <div className="section-title">
          我上传的
          <span className="count">{mine.length > 0 ? `最近 ${mine.length} 张` : ''}</span>
        </div>
        {mine.length === 0 ? (
          <p className="muted" style={{ fontSize: 13.5 }}>
            还没上传过照片。
          </p>
        ) : (
          <div className="photo-grid">
            {mine.map((photo) => (
              <GridPhoto key={photo.id} photo={photo} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-title">我赞过的</div>
        {liked.length === 0 ? (
          <p className="muted" style={{ fontSize: 13.5 }}>
            还没有点赞过。去时间轴逛逛？
          </p>
        ) : (
          <div className="photo-grid">
            {liked.map((photo) => (
              <GridPhoto key={photo.id} photo={photo} />
            ))}
          </div>
        )}
      </section>

      <p className="form-hint" style={{ marginTop: 26 }}>
        忘记密码的话，找班长帮你重置（我们没有接短信服务，做不了自助找回）。
      </p>
    </>
  );
}
