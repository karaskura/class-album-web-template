export type Role = 'member' | 'admin';
export type UserStatus = 'pending' | 'active' | 'disabled';

/** 登录后放在 session 里的用户信息（不含密码） */
export type SessionUser = {
  id: number;
  student_no: string;
  name: string;
  role: Role;
  status: UserStatus;
  avatar_key: string | null;
  /** 管理员等级：0 = 维护者全权；1 = 发活动+审核；2 = 只能发活动；非管理员为 null */
  admin_level: number | null;
};

/** 活动 */
export type ActivityRow = {
  id: number;
  title: string;
  description: string | null;
  cover_key: string | null;
  created_by: number | null;
  creator_name: string | null;
  published_at: string | Date;
  created_at: string | Date;
  participant_count: number;
  participants: string[] | null;
};

/** 宣传栏（登录页 / 主页横幅），只由维护者发布 */
export type PromoRow = {
  id: number;
  slot: 'login' | 'home';
  title: string;
  subtitle: string | null;
  image_key: string | null;
  link_url: string | null;
  sort_order: number;
  created_at: string | Date;
};

export type ManagerRow = {
  id: number;
  name: string;
  student_no: string;
  admin_level: number;
  avatar_key: string | null;
};

/** 照片列表里用到的行（带上传者、点赞数等聚合信息） */
export type PhotoRow = {
  id: number;
  album_id: number | null;
  album_name: string | null;
  uploader_id: number | null;
  uploader_name: string | null;
  uploader_avatar: string | null;
  storage_key: string;
  thumb_key: string;
  micro_key: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string | null;
  taken_at: string | null;
  description: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export type CommentRow = {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  author_name: string;
  author_no: string;
  author_avatar: string | null;
};

/** 「我的 → 通知」里的一条：谁点评了哪件作品 */
export type NotificationRow = {
  id: number;
  type: string;
  created_at: string;
  read_at: string | null;
  photo_id: number | null;
  photo_desc: string | null;
  photo_thumb: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  comment_content: string | null;
};

export type AlbumRow = {
  id: number;
  name: string;
  description: string | null;
  event_date: string | null;
  created_at: string;
  photo_count: number;
  cover_key: string | null;
  created_by_name: string | null;
};

export type MemberRow = {
  id: number;
  student_no: string;
  name: string;
  avatar_key: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
  approved_at: string | null;
  last_login_at: string | null;
  photo_count: number;
};

export type InviteRow = {
  id: number;
  code: string;
  note: string | null;
  bound_student_no: string | null;
  expires_at: string | null;
  used_by: number | null;
  used_at: string | null;
  created_at: string;
  used_by_name: string | null;
};

/** 举报（2026-10-08 · 安全评估要求建立举报机制） */
export type ReportRow = {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_type: 'photo' | 'comment';
  target_id: number;
  reason: string;
  detail: string | null;
  status: 'pending' | 'handled' | 'dismissed';
  created_at: string;
  handled_at: string | null;
  handled_by_name: string | null;
  /** 被举报内容的一小段预览（照片描述 / 评论正文） */
  target_preview: string | null;
};
