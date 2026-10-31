-- ============================================================
-- 班级相册 · 数据库结构（PostgreSQL 14+）
-- 执行方式：npm run db:init   （会读取 .env.local 里的 DATABASE_URL）
-- 本文件可以重复执行，不会破坏已有数据
-- ============================================================

begin;

-- ---------- 成员 ----------
-- status: pending 待管理员审批 / active 正常 / disabled 被停用
create table if not exists users (
  id            bigserial primary key,
  student_no    text        not null unique,
  name          text        not null,
  password_hash text,
  role          text        not null default 'member' check (role in ('member', 'admin')),
  status        text        not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  approved_by   bigint references users(id) on delete set null,
  last_login_at timestamptz
);

-- ---------- 邀请码（只发给本班同学，一击即失效）----------
create table if not exists invites (
  id               bigserial primary key,
  code             text        not null unique,
  note             text,
  -- 指定给某个学号使用（留空表示通用码）
  bound_student_no text,
  expires_at       timestamptz,
  used_by          bigint references users(id) on delete set null,
  used_at          timestamptz,
  created_by       bigint references users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ---------- 登录会话（存在数据库里，方便"一键踢下线"）----------
create table if not exists sessions (
  id         text        primary key,
  user_id    bigint      not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);

-- ---------- 相册（一次活动 / 一个主题）----------
create table if not exists albums (
  id             bigserial primary key,
  name           text        not null,
  description    text,
  event_date     date,
  cover_photo_id bigint,
  created_by     bigint references users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- 照片 ----------
-- 一张照片在对象存储里存三份：原图 / 中图 thumb / 小图 micro
-- status: active 正常 / hidden 仅管理员可见 / deleted 软删除
create table if not exists photos (
  id          bigserial primary key,
  album_id    bigint references albums(id) on delete set null,
  uploader_id bigint references users(id) on delete set null,
  storage_key text        not null,
  thumb_key   text        not null,
  micro_key   text        not null,
  width       int,
  height      int,
  bytes       bigint,
  mime        text,
  taken_at    timestamptz,
  description text,
  status      text        not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  created_at  timestamptz not null default now()
);

-- ---------- 评论 ----------
create table if not exists comments (
  id         bigserial primary key,
  photo_id   bigint      not null references photos(id) on delete cascade,
  user_id    bigint      not null references users(id) on delete cascade,
  content    text        not null,
  created_at timestamptz not null default now()
);

-- ---------- 点赞 ----------
create table if not exists likes (
  photo_id   bigint      not null references photos(id) on delete cascade,
  user_id    bigint      not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- ---------- 操作日志（谁删了图、谁批了人，留个底）----------
create table if not exists audit_logs (
  id         bigserial primary key,
  actor_id   bigint references users(id) on delete set null,
  action     text        not null,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ---------- 索引 ----------
create index if not exists sessions_user_idx     on sessions (user_id);
create index if not exists sessions_expires_idx  on sessions (expires_at);
create index if not exists photos_created_idx    on photos (created_at desc);
create index if not exists photos_taken_idx      on photos (taken_at desc nulls last);
create index if not exists photos_album_idx      on photos (album_id);
create index if not exists photos_uploader_idx   on photos (uploader_id);
create index if not exists photos_status_idx     on photos (status);
create index if not exists comments_photo_idx    on comments (photo_id, created_at);
create index if not exists likes_photo_idx       on likes (photo_id);
create index if not exists invites_code_idx      on invites (code);

-- ---------- 相册封面指向照片（照片表建好之后才能加这个外键）----------
alter table albums drop constraint if exists albums_cover_fk;
alter table albums add  constraint albums_cover_fk
  foreign key (cover_photo_id) references photos(id) on delete set null;

commit;

-- ============================================================
-- 归档相关（2026-09-27 新增）
-- 分层：7 天内正常 → 7~14 天低频 → 14 天以上进「待归档」
-- ============================================================
begin;

-- 1. status 增加 archived（归档后从网站上完全消失）
alter table photos drop constraint if exists photos_status_check;
alter table photos add  constraint photos_status_check
  check (status in ('active', 'hidden', 'archived', 'deleted'));

-- 2. 照片上记录归档信息
alter table photos add column if not exists archived_at   timestamptz;
alter table photos add column if not exists archive_batch bigint;

-- 3. 归档批次
create table if not exists archives (
  id           bigserial primary key,
  created_by   bigint references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  photo_count  int         not null default 0,
  total_bytes  bigint      not null default 0,
  -- 打包好的 zip 在服务器上的路径
  file_path    text,
  file_bytes   bigint,
  -- 管理员确认「已经保存到本地」之后才会删服务器上的原文件
  confirmed_at timestamptz,
  note         text
);

alter table photos drop constraint if exists photos_archive_batch_fk;
alter table photos add  constraint photos_archive_batch_fk
  foreign key (archive_batch) references archives(id) on delete set null;

create index if not exists photos_archive_batch_idx on photos (archive_batch);
create index if not exists photos_archived_idx      on photos (archived_at);

commit;

-- ============================================================
-- 头像（2026-09-27 新增）
-- ============================================================
begin;
alter table users add column if not exists avatar_key text;
commit;

-- ============================================================
-- 通知（2026-10-05 新增）
-- 场景：有人点评了你的作品 → 你的「我的」页铃铛上出现红点
-- ============================================================
begin;
create table if not exists notifications (
  id         bigserial primary key,
  -- 收通知的人 = 作品作者（照片的上传者）
  user_id    bigint      not null references users(id) on delete cascade,
  -- 谁点评的
  actor_id   bigint      references users(id) on delete set null,
  photo_id   bigint      references photos(id) on delete cascade,
  comment_id bigint      references comments(id) on delete cascade,
  -- 目前只有 photo_comment，留着以后加"点赞""审批通过"之类
  type       text        not null default 'photo_comment',
  -- 读过就写上时间；null = 未读（红点）
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx   on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;
commit;

-- ============================================================
-- 平台化（2026-10-05 晚 · 维护者 SSS 需求）
--  ① 管理员等级：0 = 维护者（全权）／1 = 发活动 + 审核作品／2 = 只能发活动
--  ② 活动 + 参加人员
--  ③ 个人网页背景
-- ============================================================
begin;

alter table users add column if not exists admin_level    smallint;
alter table users add column if not exists background_key text;

-- 老数据补一下：原来的管理员（维护者）就是 0 级
update users set admin_level = 0 where role = 'admin' and admin_level is null;

create table if not exists activities (
  id           bigserial primary key,
  title        text        not null,
  description  text,
  cover_key    text,
  created_by   bigint      references users(id) on delete set null,
  -- 发布时间：北京时间的"当天"，由服务端写死，发布者不能改
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  status       text        not null default 'active' check (status in ('active', 'hidden', 'deleted'))
);

create index if not exists activities_published_idx on activities (published_at desc);

create table if not exists activity_participants (
  activity_id bigint not null references activities(id) on delete cascade,
  user_id     bigint not null references users(id) on delete cascade,
  primary key (activity_id, user_id)
);

commit;


-- ============================================================
-- 宣传栏（2026-10-05 深夜 · 维护者要求，创作者只能是他本人）
--   slot = 'login' 登录页顶部那条宣传图 + 标题
--   slot = 'home'  主页顶部横幅（可多条，自动轮播）
-- ============================================================
begin;

create table if not exists promos (
  id         bigserial primary key,
  slot       text        not null check (slot in ('login', 'home')),
  title      text        not null,
  subtitle   text,
  image_key  text,
  link_url   text,
  sort_order int         not null default 0,
  created_by bigint      references users(id) on delete set null,
  created_at timestamptz not null default now(),
  status     text        not null default 'active' check (status in ('active', 'hidden'))
);

create index if not exists promos_slot_idx on promos (slot, sort_order, created_at desc);

commit;

-- ============================================================
-- 举报 + 评论软删除（2026-10-08 · 公安联网备案《安全评估报告》要求建立举报机制）
-- ============================================================
begin;

alter table comments add column if not exists deleted_at timestamptz;
alter table comments add column if not exists deleted_by bigint references users(id) on delete set null;

create table if not exists reports (
  id          bigserial primary key,
  reporter_id bigint      not null references users(id) on delete cascade,
  target_type text        not null check (target_type in ('photo', 'comment')),
  target_id   bigint      not null,
  reason      text        not null,
  detail      text,
  status      text        not null default 'pending' check (status in ('pending', 'handled', 'dismissed')),
  handled_by  bigint      references users(id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists reports_status_idx on reports (status, created_at desc);

commit;
