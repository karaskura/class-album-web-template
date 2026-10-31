import { Pool, types, type PoolClient } from 'pg';

/**
 * node-postgres 默认把 bigint(int8) 转成字符串（怕超出 JS 安全整数）。
 * 我们的 id 和计数不可能到 2^53，转回 number，跟类型声明一致。
 */
types.setTypeParser(types.builtins.INT8, (value: string) => Number(value));

/**
 * 单例连接池。
 * 开发模式下 Next 会热重载模块，挂到 globalThis 上防止连接数爆炸。
 */
const globalForPg = globalThis as unknown as { __albumPool?: Pool };

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

let pool: Pool = globalForPg.__albumPool ?? createPool();

if (!globalForPg.__albumPool) globalForPg.__albumPool = pool;

/**
 * 重建连接池。
 *
 * 为什么需要这个：本机的 PGlite 代理（scripts/dev-db.mjs）会把空闲连接偷偷掐掉，
 * 坏连接留在池子里会被反复取出复用 —— 光「重试一次」没用，实测会连续两次报
 * Connection terminated unexpectedly（整页 500）。所以出错时先把整个池换掉再重试。
 * 并发时只重建一次，其余请求等同一个 promise，避免反复开关池子。
 */
let rebuilding: Promise<void> | null = null;

function rebuildPool(): Promise<void> {
  if (!rebuilding) {
    rebuilding = (async () => {
      const dead = pool;
      const next = createPool();
      next.on('error', onIdleError);
      pool = next;
      globalForPg.__albumPool = next;
      await dead.end().catch(() => undefined);
    })().finally(() => {
      rebuilding = null;
    });
  }
  return rebuilding;
}

/**
 * 空闲连接被对端掐断时，pg 会把错误抛到连接池上。
 * 没有这个监听就会变成进程级未捕获异常（dev 里表现为整页 500 + 红框）。
 */
function onIdleError(err: Error) {
  console.warn('[db] 空闲连接出错（已忽略，下次查询会重连）：', err.message);
}

pool.on('error', onIdleError);

/**
 * 「连接被对端掐断」的错误特征：本机 PGlite 代理偶尔会 reset 空闲连接，
 * 真库也会遇到网络抖动。这类错误发生在语句真正执行之前，重试一次是安全的。
 */
const TRANSIENT_DB_ERROR =
  /Connection terminated|ECONNRESET|EPIPE|socket hang up|Client has encountered a connection error|Connection reset/i;

/** 查询，返回行数组 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const res = await pool.query(text, params);
    return res.rows as T[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!TRANSIENT_DB_ERROR.test(message)) throw err;
    // 坏连接会一直留在池子里，换一个新池再试（见 rebuildPool 的注释）
    await rebuildPool();
    const res = await pool.query(text, params);
    return res.rows as T[];
  }
}

/** 查询，返回第一行或 null */
export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/** 事务包装 */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** 写一条操作日志，失败不影响主流程 */
export async function audit(
  actorId: number | null,
  action: string,
  target?: string | null,
  detail?: unknown,
): Promise<void> {
  try {
    await query(
      'insert into audit_logs (actor_id, action, target, detail) values ($1, $2, $3, $4)',
      [actorId, action, target ?? null, detail ? JSON.stringify(detail) : null],
    );
  } catch {
    /* 日志失败就算了 */
  }
}
