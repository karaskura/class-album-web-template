/**
 * 本机零依赖跑数据库：WASM 版 PostgreSQL（PGlite）
 *
 * 为什么需要它：你可能没装 PostgreSQL、也没有 Docker，但又想先看看真实效果。
 * 这个脚本会在 127.0.0.1:5433 起一个真的 Postgres（编译成 WebAssembly），
 * 数据存在 web/.data/pglite 里，重启不丢。
 *
 * 用法：npm run dev:db      （另开一个终端跑 npm run dev）
 *
 * ⚠️ 它只是为了本机预览。PGlite 是单连接数据库，用多路复用模拟并发，
 *    并发压力大时可能不稳。正式部署请用 docker compose 里那个真 Postgres。
 */
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, '.data/pglite');
const port = Number(process.env.DEV_DB_PORT ?? 5433);

mkdirSync(dataDir, { recursive: true });

const db = await PGlite.create({ dataDir });
// 默认只允许 1 个连接，页面里 Promise.all 并发查三次就会 ECONNRESET，所以放大一点
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });

await server.start();

console.log('');
console.log('  ✔ 本机数据库已启动');
console.log(`    连接串：postgres://postgres:postgres@127.0.0.1:${port}/postgres`);
console.log(`    数据目录：${dataDir}`);
console.log('');
console.log('  第一次跑的话，另开终端执行一次：npm run db:init');
console.log('  然后：npm run dev    →  http://localhost:3000');
console.log('');

async function shutdown() {
  console.log('\n正在关闭数据库…');
  await server.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
