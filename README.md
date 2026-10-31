# 班级相册应用（Web）模板 · 可打包桌面版

一个**班级/小团体内部使用**的相册站点：时间轴、相册、照片点赞评论、活动与回忆、管理员审批、邀请码加入，照片在浏览器里压缩后再上传。自带 PWA，可加到手机主屏幕；另附一个 Electron 壳，可以打成 Windows 桌面 App。

> 这个仓库来自一个真实上线过的班级站源码（2026 年上线、同年下架）。开源前已经把**备案号、域名、服务器 IP、班级与同学的真实信息、全部真实照片、以及与本站无关的另一个子系统**去掉，剩下的就是一套可以直接改成自己班级用的模板。
>
> 没有放任何真实照片——截图里的照片是占位色块。

---

## 功能

**成员侧**

- **时间轴**：最近的照片、活动、通知流
- **相册**：按相册浏览，相册详情页网格
- **照片详情**：大图、点赞、评论、EXIF 信息、删除自己的照片
- **上传**：浏览器内压缩（可带水印）、多选、进度、失败重试
- **活动**：发布活动、报名、活动相册
- **回忆**：按年月回顾
- **搜索**：照片标题/描述、活动、成员
- **我的**：头像、改密码、通知、我的照片

**管理侧**（管理员 / 班长）

- **审批**：新成员加入申请、邀请码
- **名单导入**：从 Excel 整列粘学号（可带姓名）批量通过
- **相册/活动管理**：新建、排序、封面、删除
- **推广位（promos）**：登录页轮播图
- **举报处理**：成员举报照片/评论，管理员处置
- **审计日志**：谁在什么时候改了什么

**其它**

- 邀请码 + 学号注册，管理员审批；未登录只能看到登录页，游客只读
- 深色/浅色主题、四种网页背景，cookie 记忆、首屏不闪
- PWA：manifest + service worker + 离线页
- 客户端下载页（可选）：自动扫 `public/download/` 里最新的 `.apk`/`.exe`，自动算大小与 SHA-256
- 全站 404 页、错误兜底
- 存储驱动可切：本地磁盘 / 阿里云 OSS 预签名直传

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript | `output: 'standalone'`，低配云主机也跑得动 |
| 数据库 | PostgreSQL 14+（`pg`，手写 SQL） | 没有 ORM，表结构就是 `db/schema.sql` |
| 存储 | 本地磁盘 / 阿里云 OSS | 接口在 `lib/storage.ts`，两种驱动同一套调用 |
| 样式 | 手写 CSS（`app/globals.css` + `app/platform-ui.css`） | 没有 Tailwind / UI 组件库 |
| 图片 | 浏览器内 canvas 压缩、EXIF 方向修正、可选水印 | 服务器只收压缩后的小图 |
| 桌面版 | Electron 41 + electron-builder（NSIS） | `desktop/` |

## 目录结构

```
.
├── web/                    # Next.js 应用（主程序）
│   ├── app/
│   │   ├── (app)/          # 登录后的页面外壳：时间轴/相册/上传/活动/回忆/搜索/我的/管理后台
│   │   ├── (auth)/         # 登录、申请加入
│   │   ├── api/            # REST 接口：auth / photos / albums / comments / upload / admin …
│   │   ├── download/       # 客户端下载页（可选，纯静态）
│   │   ├── layout.tsx      # 根布局：主题/背景 cookie → <html data-*>
│   │   └── globals.css
│   ├── components/         # 客户端组件（Nav / TopBar / 上传 / 评论 / 管理面板 …）
│   ├── lib/                # db、session、storage、图片压缩、敏感词、查询
│   ├── db/schema.sql       # 全部表结构（幂等，可重复执行）
│   ├── scripts/            # init-db / dev-db(PGlite) / start-local / 图标生成
│   ├── public/             # 图标、装饰 SVG、离线页、service worker
│   └── Dockerfile
├── desktop/                # Electron 壳（把网页版装进一个窗口）
├── docs/设计说明.md         # 为什么这么设计：取舍、踩坑记录
├── preview/index.html      # 单文件设计稿（不连数据库，双击即可看）
├── docker-compose.yml      # db + web + caddy 一键起
├── Caddyfile               # 反向代理 + 自动 HTTPS
├── 本地启动.bat             # Windows 双击起本地开发环境
└── README.md
```

## 快速开始（本机）

需要 **Node.js 22+**、**PostgreSQL 14+**（或者用内置的 PGlite，见下）。

```bash
cd web
cp .env.example .env.local      # 然后改 DATABASE_URL / SESSION_SECRET
npm install
npm run db:init                 # 建表（幂等）+ 可选创建第一个管理员
npm run dev                     # http://localhost:3000
```

想完全不用装 PostgreSQL，可以用内置的 PGlite（WASM 版 Postgres，数据落在 `web/.data/`）：

```bash
cd web
npm run dev:db      # 另开一个终端，5433 端口
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres npm run dev
```

第一次进来：

1. 在 `.env.local` 里填 `BOOTSTRAP_ADMIN_STUDENT_NO` / `BOOTSTRAP_ADMIN_NAME` / `BOOTSTRAP_ADMIN_PASSWORD`，再跑一次 `npm run db:init`，就有了第一个管理员；
2. 管理员登录 → 管理后台 → 生成邀请码；
3. 同学用「邀请码 + 学号」申请加入 → 管理员审批 → 通过后可以上传。

Windows 用户也可以直接双击根目录的 `本地启动.bat`（会自动 `npm install` 并拉起本地环境）。

## 环境变量

完整清单见 `web/.env.example`，最关键的几项：

| 变量 | 作用 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `SESSION_SECRET` | 会话签名密钥，务必改成随机串（`openssl rand -hex 32`） |
| `NEXT_PUBLIC_SITE_NAME` | 站点名（登录页、页面标题） |
| `NEXT_PUBLIC_WATERMARK` | 照片水印文字，留空则不打水印；改完要重新构建 |
| `STORAGE_DRIVER` | `local` 或 `oss` |
| `LOCAL_STORAGE_DIR` | `local` 驱动的图片目录 |
| `OSS_*` | 阿里云 OSS 的 bucket / AK / 预签名有效期 |
| `MAX_UPLOAD_MB` | 单张照片上限（默认 25） |
| `COOKIE_SECURE` | 用 HTTPS 时留空（自动 true）；纯 HTTP / 局域网必须设 `false` |
| `NEXT_PUBLIC_SITE_URL` | 站点根地址，下载页用来显示域名、生成二维码链接 |

## 部署

### 方式一：Docker Compose（推荐）

```bash
cp web/.env.example .env       # 填 SESSION_SECRET、POSTGRES_PASSWORD、SITE_ADDRESS
docker compose up -d --build
docker compose exec web node scripts/init-db.mjs
```

`docker-compose.yml` 会起三个容器：`db`（PostgreSQL 16）、`web`（Next.js）、`caddy`（反向代理 + 自动申请 HTTPS 证书）。`SITE_ADDRESS` 填域名就走 HTTPS，填 `:80` 就纯 HTTP。

### 方式二：裸机 systemd

```bash
cd web
npm ci
npm run build
npm run db:init
# 用 output: 'standalone' 的产物启动（.next/standalone + .next/static + public）
node .next/standalone/server.js      # 默认 3000 端口
```

前面套一层 nginx/Caddy 反代到 `127.0.0.1:3000` 即可。注意 `COOKIE_SECURE`、`client_max_body_size`（上传）和静态目录要一起配。

## 桌面版

```bash
cd desktop
npm install
npm start                                   # 默认连 http://localhost:3000
CLASSALBUM_URL=https://你的域名 npm start    # 指向线上站
npm run dist                                # 打 Windows 安装包 → dist/
```

壳负责：单实例、记住窗口大小、外链交给系统浏览器、开场动画、断网重试页。图标在 `desktop/build/`，换图后重新 `npm run dist`。

网页端如果也想分发安装包：把 `.apk` / `.exe` 丢进 `web/public/download/`，下载页会自动识别最新版本并算好 SHA-256，`qr.png` 可选（没有就不显示二维码）。

## 这个模板做了什么取舍

- **图片在浏览器压缩**：服务器不碰原图，低配机器也能扛；代价是原图不再保留，`orig` 不对普通成员开放。
- **没有 ORM**：SQL 全写在 `lib/queries.ts` 和各个 `route.ts` 里，改表就改 SQL，省一层抽象。
- **登录态用签名 cookie + 数据库 sessions 表**：换设备、强制下线都简单。
- **邀请码 + 人工审批**：班级场景里比开放注册省心得多。
- **没有引入 UI 库**：样式全手写，改起来直观，代价是没有现成组件。

更多「为什么这么做」写在 [`docs/设计说明.md`](docs/设计说明.md)。

## 许可

MIT，见 [LICENSE](LICENSE)。拿去改成自己班级的站点、商用、二次分发都可以，保留版权声明即可。

## 致谢

写这套东西的过程、踩过的坑、以及每个决定背后的理由，都记在 `docs/设计说明.md` 和代码注释里。如果它对你的班级也有用，那就够了。
