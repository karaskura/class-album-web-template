/**
 * 初始化数据库：建表 + 可选创建第一个管理员
 *
 * 用法：
 *   npm run db:init
 *
 * 会优先读取环境变量 DATABASE_URL；没有的话尝试读 .env.local。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** 极简 .env 读取，避免为了一个脚本引入 dotenv 依赖 */
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉外层引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, '.env.local'));
loadEnvFile(resolve(root, '.env'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('✗ 没有找到 DATABASE_URL，请先复制 .env.example 为 .env.local 并填写数据库连接串。');
  process.exit(1);
}

/** 与 lib/auth.ts 保持一致的口令哈希格式 */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

const schema = readFileSync(resolve(root, 'db/schema.sql'), 'utf8');

// 把目标地址打出来，省得连错库排查半天（密码打码）
console.log(`→ 目标数据库：${connectionString.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@')}`);

/**
 * 首次启动时数据库可能还没准备好，重试几次再放弃。
 * 注意：pg 的 Client 连过之后就不能复用，所以每次重试都要新建一个。
 */
async function connectWithRetry(attempts = 10, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const candidate = new pg.Client({ connectionString });
    try {
      await candidate.connect();
      return candidate;
    } catch (err) {
      lastError = err;
      await candidate.end().catch(() => {});
      if (attempt === attempts) break;
      console.log(
        `• 数据库还没就绪（${err.code ?? err.message}），${delayMs / 1000} 秒后重试（${attempt}/${attempts}）…`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

let client;
try {
  client = await connectWithRetry();
  console.log('→ 已连接数据库，开始建表…');
  await client.query(schema);
  console.log('✓ 表结构就绪');

  const studentNo = process.env.BOOTSTRAP_ADMIN_STUDENT_NO?.trim();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (studentNo && name && password) {
    const existing = await client.query('select id from users where student_no = $1', [studentNo]);
    if (existing.rowCount > 0) {
      console.log(`• 管理员 ${studentNo} 已存在，跳过创建`);
    } else {
      await client.query(
        `insert into users (student_no, name, password_hash, role, status, approved_at)
         values ($1, $2, $3, 'admin', 'active', now())`,
        [studentNo, name, hashPassword(password)],
      );
      console.log(`✓ 已创建管理员：${name}（学号 ${studentNo}）`);
    }
  } else {
    console.log('• 未配置 BOOTSTRAP_ADMIN_*，跳过管理员创建');
    console.log('  提示：第一个同学注册后需要有人审批，建议先在 .env.local 里配好管理员再跑一次。');
  }
} catch (err) {
  console.error('✗ 初始化失败：', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
