# ---------- 班级相册 · 镜像构建 ----------
# 分三阶段：装依赖 / 构建 / 只留运行所需
# 国内拉不动 node 镜像的话，把下面两处 node:22-alpine 换成镜像站地址，例如
#   registry.cn-hangzhou.aliyuncs.com/library/node:22-alpine

# ---------- 1. 依赖 ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ---------- 2. 构建 ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建时不需要真实数据库，给个占位即可
ENV DATABASE_URL=postgres://placeholder:placeholder@127.0.0.1:5432/placeholder
ENV SESSION_SECRET=build-time-placeholder-secret
RUN npm run build

# ---------- 3. 运行 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# node:alpine 自带 node 用户（uid 1000），直接用它，少一层
USER node

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# 建表脚本，首次部署用得上
COPY --from=builder --chown=node:node /app/db ./db
COPY --from=builder --chown=node:node /app/scripts ./scripts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
