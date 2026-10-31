import { one, query } from './db';
import { formatDay } from './format';
import type {
  ActivityRow,
  AlbumRow,
  CommentRow,
  InviteRow,
  ManagerRow,
  MemberRow,
  NotificationRow,
  PhotoRow,
  PromoRow,
  ReportRow,
} from './types';

/** 照片查询的公共字段（$1 固定是"当前查看者 id"，用于算 liked_by_me） */
const PHOTO_FIELDS = `
  p.id, p.album_id, a.name as album_name, p.uploader_id, u.name as uploader_name,
  u.avatar_key as uploader_avatar,
  p.storage_key, p.thumb_key, p.micro_key, p.width, p.height,
  p.bytes::int as bytes, p.mime, p.taken_at, p.description, p.created_at,
  (select count(*)::int from likes l where l.photo_id = p.id) as like_count,
  (select count(*)::int from comments c where c.photo_id = p.id and c.deleted_at is null) as comment_count,
  exists(select 1 from likes lm where lm.photo_id = p.id and lm.user_id = $1) as liked_by_me
`;

const PHOTO_FROM = `
  from photos p
  left join albums a on a.id = p.album_id
  left join users u on u.id = p.uploader_id
`;

export type ListPhotosOptions = {
  albumId?: number | null;
  uploaderId?: number | null;
  likedBy?: number | null;
  limit?: number;
  offset?: number;
};

export async function listPhotos(
  viewerId: number,
  opts: ListPhotosOptions = {},
): Promise<PhotoRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const params: unknown[] = [viewerId];
  const where: string[] = [`p.status = 'active'`];

  if (opts.albumId) {
    params.push(opts.albumId);
    where.push(`p.album_id = $${params.length}`);
  }
  if (opts.uploaderId) {
    params.push(opts.uploaderId);
    where.push(`p.uploader_id = $${params.length}`);
  }
  if (opts.likedBy) {
    params.push(opts.likedBy);
    where.push(`exists (select 1 from likes lx where lx.photo_id = p.id and lx.user_id = $${params.length})`);
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  return query<PhotoRow>(
    `select ${PHOTO_FIELDS} ${PHOTO_FROM}
      where ${where.join(' and ')}
      order by p.created_at desc, p.id desc
      limit $${limitIdx} offset $${offsetIdx}`,
    params,
  );
}

export async function getPhoto(photoId: number, viewerId: number): Promise<PhotoRow | null> {
  return one<PhotoRow>(
    `select ${PHOTO_FIELDS} ${PHOTO_FROM}
      where p.id = $2 and p.status = 'active'`,
    [viewerId, photoId],
  );
}

/**
 * 全文搜索：在「照片描述 / 上传者姓名 / 相册名」里找。
 * 用户输入的 % 和 _ 要转义，不然会被当成通配符。
 */
export async function searchPhotos(
  viewerId: number,
  keyword: string,
  limit = 120,
): Promise<PhotoRow[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const escaped = trimmed.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const like = `%${escaped}%`;

  return query<PhotoRow>(
    `select ${PHOTO_FIELDS} ${PHOTO_FROM}
      where p.status = 'active'
        and (p.description ilike $2 or u.name ilike $2 or a.name ilike $2)
      order by p.created_at desc, p.id desc
      limit $3`,
    [viewerId, like, limit],
  );
}

/** 搜索时顺便告诉用户命中了些什么（相册、人物） */
export async function searchSummary(
  keyword: string,
): Promise<{ albums: number; uploaders: string[] }> {
  const trimmed = keyword.trim();
  if (!trimmed) return { albums: 0, uploaders: [] };
  const escaped = trimmed.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const like = `%${escaped}%`;

  const albumRow = await one<{ n: number }>(
    `select count(distinct p.album_id)::int as n
       from photos p left join albums a on a.id = p.album_id
      where p.status = 'active' and p.album_id is not null
        and (a.name ilike $1 or p.description ilike $1)`,
    [like],
  );
  const people = await query<{ name: string }>(
    `select distinct u.name
       from photos p join users u on u.id = p.uploader_id
      where p.status = 'active'
        and (u.name ilike $1 or p.description ilike $1)
      order by u.name
      limit 8`,
    [like],
  );

  return { albums: albumRow?.n ?? 0, uploaders: people.map((r) => r.name) };
}

export async function deletePhoto(photoId: number): Promise<PhotoRow | null> {
  return one<PhotoRow>(
    `update photos set status = 'deleted' where id = $1 returning *`,
    [photoId],
  );
}

export async function listAlbums(): Promise<AlbumRow[]> {
  return query<AlbumRow>(
    `select al.id, al.name, al.description, al.event_date, al.created_at,
            (select count(*)::int from photos p where p.album_id = al.id and p.status = 'active') as photo_count,
            coalesce(
              (select p.micro_key from photos p where p.id = al.cover_photo_id and p.status = 'active'),
              (select p.micro_key from photos p
                where p.album_id = al.id and p.status = 'active'
                order by p.created_at desc limit 1)
            ) as cover_key,
            u.name as created_by_name
       from albums al
       left join users u on u.id = al.created_by
      order by coalesce(al.event_date::timestamptz, al.created_at) desc, al.id desc`,
  );
}

export async function getAlbum(albumId: number): Promise<AlbumRow | null> {
  return one<AlbumRow>(
    `select al.id, al.name, al.description, al.event_date, al.created_at,
            (select count(*)::int from photos p where p.album_id = al.id and p.status = 'active') as photo_count,
            coalesce(
              (select p.micro_key from photos p where p.id = al.cover_photo_id and p.status = 'active'),
              (select p.micro_key from photos p
                where p.album_id = al.id and p.status = 'active'
                order by p.created_at desc limit 1)
            ) as cover_key,
            u.name as created_by_name
       from albums al
       left join users u on u.id = al.created_by
      where al.id = $1`,
    [albumId],
  );
}

export async function listComments(photoId: number): Promise<CommentRow[]> {
  return query<CommentRow>(
    `select c.id, c.user_id, c.content, c.created_at,
            u.name as author_name, u.student_no as author_no, u.avatar_key as author_avatar
       from comments c
       join users u on u.id = c.user_id
      where c.photo_id = $1
        and c.deleted_at is null
      order by c.created_at asc
      limit 200`,
    [photoId],
  );
}

/* ---------------- 活动（2026-10-05 晚 · 平台化新增） ---------------- */

const ACTIVITY_FIELDS = `
  a.id, a.title, a.description, a.cover_key, a.created_by,
  u.name as creator_name, a.published_at, a.created_at,
  (select count(*)::int from activity_participants ap where ap.activity_id = a.id) as participant_count,
  (select array_agg(pu.name order by pu.name)
     from activity_participants ap join users pu on pu.id = ap.user_id
    where ap.activity_id = a.id) as participants
`;

export async function listActivities(limit = 30): Promise<ActivityRow[]> {
  return query<ActivityRow>(
    `select ${ACTIVITY_FIELDS}
       from activities a
       left join users u on u.id = a.created_by
      where a.status = 'active'
      order by a.published_at desc
      limit $1`,
    [limit],
  );
}

export async function getActivity(id: number): Promise<ActivityRow | null> {
  const rows = await query<ActivityRow>(
    `select ${ACTIVITY_FIELDS}
       from activities a
       left join users u on u.id = a.created_by
      where a.id = $1 and a.status = 'active'`,
    [id],
  );
  return rows[0] ?? null;
}

/** 活动发布页的人员清单：所有能用账号登录的人 */
export async function listParticipantOptions(): Promise<
  Array<{ id: number; name: string; student_no: string; avatar_key: string | null }>
> {
  return query(
    `select id, name, student_no, avatar_key
       from users
      where status = 'active'
      order by student_no`,
  );
}

/* ---------------- 宣传栏（2026-10-05 深夜） ---------------- */

const PROMO_FIELDS = `id, slot, title, subtitle, image_key, link_url, sort_order, created_at`;

export async function listPromos(slot?: 'login' | 'home'): Promise<PromoRow[]> {
  if (slot) {
    return query<PromoRow>(
      `select ${PROMO_FIELDS} from promos
        where status = 'active' and slot = $1
        order by sort_order asc, created_at desc`,
      [slot],
    );
  }
  return query<PromoRow>(
    `select ${PROMO_FIELDS} from promos
      where status = 'active'
      order by slot, sort_order asc, created_at desc`,
  );
}

/** 登录页只展示第一条（没配置就回落到自带的静态宣传图） */
export async function getLoginPromo(): Promise<PromoRow | null> {
  const rows = await listPromos('login');
  return rows[0] ?? null;
}

export async function listHomePromos(limit = 8): Promise<PromoRow[]> {
  const rows = await listPromos('home');
  return rows.slice(0, limit);
}

/* ---------------- 通知（2026-10-05：有人点评你的作品） ---------------- */

/** 「我的」页铃铛红点用：还有几条没看过 */
export async function countUnreadNotifications(userId: number): Promise<number> {
  const row = await one<{ count: number }>(
    'select count(*)::int as count from notifications where user_id = $1 and read_at is null',
    [userId],
  );
  return row?.count ?? 0;
}

export async function listNotifications(userId: number, limit = 50): Promise<NotificationRow[]> {
  return query<NotificationRow>(
    `select n.id, n.type, n.created_at, n.read_at, n.photo_id,
            p.description as photo_desc, p.thumb_key as photo_thumb,
            u.name as actor_name, u.avatar_key as actor_avatar,
            c.content as comment_content
       from notifications n
       left join photos   p on p.id = n.photo_id
       left join users    u on u.id = n.actor_id
       left join comments c on c.id = n.comment_id and c.deleted_at is null
      where n.user_id = $1
      order by n.created_at desc
      limit $2`,
    [userId, limit],
  );
}

/** 打开通知页就全部标为已读（铃铛上的红点随之消失） */
export async function markNotificationsRead(userId: number): Promise<void> {
  await query('update notifications set read_at = now() where user_id = $1 and read_at is null', [
    userId,
  ]);
}

export async function listMembers(): Promise<MemberRow[]> {
  return query<MemberRow>(
    `select u.id, u.student_no, u.name, u.avatar_key, u.role, u.status,
            u.created_at, u.approved_at, u.last_login_at,
            (select count(*)::int from photos p where p.uploader_id = u.id and p.status = 'active') as photo_count
       from users u
      order by case u.status when 'pending' then 0 when 'active' then 1 else 2 end,
               u.student_no`,
  );
}

export async function listInvites(): Promise<InviteRow[]> {
  return query<InviteRow>(
    `select i.id, i.code, i.note, i.bound_student_no, i.expires_at,
            i.used_by, i.used_at, i.created_at,
            u.name as used_by_name
       from invites i
       left join users u on u.id = i.used_by
      order by i.created_at desc
      limit 100`,
  );
}

export type Stats = {
  memberCount: number;
  photoCount: number;
  pendingCount: number;
  albumCount: number;
  totalBytes: number;
};

export async function getStats(): Promise<Stats> {
  const row = await one<Stats>(
    `select
       (select count(*)::int from users where status <> 'disabled') as "memberCount",
       (select count(*)::int from photos where status = 'active')  as "photoCount",
       (select count(*)::int from users where status = 'pending')  as "pendingCount",
       (select count(*)::int from albums)                          as "albumCount",
       (select coalesce(sum(bytes), 0)::bigint::int from photos where status = 'active') as "totalBytes"`,
  );
  return (
    row ?? { memberCount: 0, photoCount: 0, pendingCount: 0, albumCount: 0, totalBytes: 0 }
  );
}

export type DayGroup = { day: string; label: string; photos: PhotoRow[] };

/** 把照片按"拍摄日"分组，供时间轴展示 */
export function groupPhotosByDay(photos: PhotoRow[]): DayGroup[] {
  const map = new Map<string, PhotoRow[]>();
  for (const photo of photos) {
    // 时间轴按「发布时间」分组（不是照片的 EXIF 拍摄时间）
    const day = formatDay(photo.created_at) || '未知日期';
    const list = map.get(day);
    if (list) list.push(photo);
    else map.set(day, [photo]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, list]) => ({ day, label: humanDay(day), photos: list }));
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function humanDay(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (day === todayKey) return `今天 · ${day}`;
  return `${day} · ${WEEKDAYS[d.getDay()]}`;
}

/* ------------------------------------------------------------------ */
/* 年度回忆                                                            */
/* ------------------------------------------------------------------ */

export type YearStat = {
  year: number;
  photoCount: number;
  uploaderCount: number;
  albumCount: number;
  /** 最多 3 张缩略图 key，用来拼封面 */
  covers: string[];
};

/** 按年份统计（照片数 / 参与人数 / 相册数 + 几张封面） */
export async function listYears(): Promise<YearStat[]> {
  const years = await query<{
    year: number;
    photo_count: number;
    uploader_count: number;
    album_count: number;
  }>(
    `select extract(year from created_at)::int as year,
            count(*)::int                                as photo_count,
            count(distinct uploader_id)::int             as uploader_count,
            count(distinct album_id)::int                as album_count
       from photos
      where status = 'active'
      group by 1
      order by 1 desc`,
  );

  const stats: YearStat[] = [];
  for (const row of years) {
    const covers = await query<{ micro_key: string }>(
      `select micro_key
         from photos
        where status = 'active'
          and extract(year from created_at)::int = $1
        order by created_at desc
        limit 3`,
      [row.year],
    );
    stats.push({
      year: row.year,
      photoCount: row.photo_count,
      uploaderCount: row.uploader_count,
      albumCount: row.album_count,
      covers: covers.map((c) => c.micro_key),
    });
  }
  return stats;
}

/** 某一年的全部照片，按时间正序（像翻日记） */
export async function photosByYear(
  viewerId: number,
  year: number,
  limit = 400,
): Promise<PhotoRow[]> {
  return query<PhotoRow>(
    `select ${PHOTO_FIELDS} ${PHOTO_FROM}
      where p.status = 'active'
        and extract(year from p.created_at)::int = $2
      order by p.created_at asc, p.id asc
      limit $3`,
    [viewerId, year, limit],
  );
}

/** 某一年最受欢迎的照片（按点赞数） */
export async function topLikedPhotos(
  viewerId: number,
  year: number,
  limit = 3,
): Promise<PhotoRow[]> {
  return query<PhotoRow>(
    `select ${PHOTO_FIELDS} ${PHOTO_FROM}
      where p.status = 'active'
        and extract(year from p.created_at)::int = $2
      order by (select count(*) from likes l where l.photo_id = p.id) desc,
               p.created_at desc
      limit $3`,
    [viewerId, year, limit],
  );
}

/** 把照片按「年-月」分组 */
export function groupPhotosByMonth(photos: PhotoRow[]): Array<{ month: string; photos: PhotoRow[] }> {
  const map = new Map<string, PhotoRow[]>();
  for (const photo of photos) {
    const month = formatDay(photo.created_at).slice(0, 7) || '未知月份';
    const list = map.get(month);
    if (list) list.push(photo);
    else map.set(month, [photo]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, list]) => ({ month, photos: list }));
}

/* ------------------------------------------------------------------ */
/* 举报（2026-10-08 · 安全评估要求建立投诉举报机制）                    */
/* ------------------------------------------------------------------ */

/** 待处理举报条数（管理后台角标） */
export async function pendingReportCount(): Promise<number> {
  const row = await one<{ n: number }>(
    `select count(*)::int as n from reports where status = 'pending'`,
  );
  return row?.n ?? 0;
}

/** 举报列表：待处理排前面，最多 100 条 */
export async function listReports(): Promise<ReportRow[]> {
  return query<ReportRow>(
    `select r.id, r.reporter_id, ru.name as reporter_name,
            r.target_type, r.target_id, r.reason, r.detail, r.status,
            r.created_at, r.handled_at, hu.name as handled_by_name,
            case r.target_type
              when 'photo' then (select left(coalesce(p.description, ''), 60) from photos p where p.id = r.target_id)
              else              (select left(c.content, 60) from comments c where c.id = r.target_id)
            end as target_preview
       from reports r
       join users ru on ru.id = r.reporter_id
       left join users hu on hu.id = r.handled_by
      order by (r.status = 'pending') desc, r.created_at desc
      limit 100`,
  );
}
