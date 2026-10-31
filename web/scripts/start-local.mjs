/**
 * 班级相册 · 本机一键启动
 *
 * 把「起数据库 → 建表 → 起网站 → 开浏览器」串成一条龙，只开一个窗口。
 *
 * 为什么不让 .bat 直接干这些：
 *   cmd.exe 是按系统代码页逐字节解析批处理文件的，UTF-8 里的中文会被拆散，
 *   把后面几行的 echo 前缀都吃掉，导致一堆 "不是内部或外部命令"。
 *   所以 .bat 只留纯 ASCII，所有中文和编排都放到这里。
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, '.data/pglite');
const dbPort = Number(process.env.DEV_DB_PORT ?? 5433);
const appPort = Number(process.env.PORT ?? 3000);
const appUrl = `http://localhost:${appPort}`;

const cyan = (s) => `\u001b[36m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;

let db;
let dbServer;
let dev;
let shuttingDown = false;

console.log('');
console.log(cyan('  ╔════════════════════════════════════════╗'));
console.log(cyan('  ║        班级相册 · 本机启动              ║'));
console.log(cyan('  ╚════════════════════════════════════════╝'));
console.log('');

/* ---------------- 0. 前置检查 ---------------- */
if (!existsSync(resolve(root, 'node_modules'))) {
  console.error(red('  ✗ 没有找到 node_modules，请先在 web 目录执行 npm install'));
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });

// 上次如果没关干净（比如直接点了窗口右上角的 ×），进程会赖在端口上，
// 这次就会 EADDRINUSE 起不来。先把自己留的摊子收掉。
await freeStalePort(dbPort, '数据库');
await freeStalePort(appPort, '网站');

/* ---------------- 1. 数据库 ---------------- */
try {
  db = await PGlite.create({ dataDir });
  // 默认只允许 1 个连接，页面里并发查三次就会 ECONNRESET，所以放大一点
  dbServer = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 20 });
  await dbServer.start();
  console.log(green(`        ✔ 数据库就绪  postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres`));
} catch (err) {
  console.error('');
  console.error(
    red(
      `  ✗ 数据库起不来：${
        err?.code === 'EADDRINUSE' ? `端口 ${dbPort} 被别的程序占用了` : (err?.message ?? err)
      }`,
    ),
  );
  console.error(dim(`    排查：PowerShell 里跑 Get-NetTCPConnection -LocalPort ${dbPort}`));
  console.error(dim('    看 OwningProcess 是哪个 PID，再 Stop-Process -Id 那个PID -Force'));
  console.error('');
  process.exit(1);
}

/* ---------------- 2. 建表 ---------------- */
console.log(dim('  [2/3] 初始化数据表…'));
const initCode = await run(process.execPath, ['scripts/init-db.mjs']);
if (initCode !== 0) {
  console.error(red('  ✗ 建表失败，先解决上面的报错再启动。'));
  await shutdown(1);
}

/* ---------------- 3. 网站 ---------------- */
console.log(dim('  [3/3] 启动网站…'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
dev = spawn(npm, ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: true });
dev.on('exit', (code) => shutdown(code ?? 0));

const ready = await waitForServer(`${appUrl}/login`, 60_000);
if (ready) {
  const lan = lanAddresses();

  console.log('');
  console.log(green(`  ✔ 网站已启动：${appUrl}`));
  console.log('');
  const adminNo = readEnvValue('BOOTSTRAP_ADMIN_STUDENT_NO');
  if (adminNo) {
    console.log(`    管理员学号：${cyan(adminNo)}`);
    console.log(dim('    密码在 web/.env.local 里的 BOOTSTRAP_ADMIN_PASSWORD'));
    console.log(dim('    改完记得删掉 web/.data 再启动一次，新密码才生效。'));
  } else {
    console.log(dim('    初始管理员见 web/.env.local 里的 BOOTSTRAP_ADMIN_STUDENT_NO'));
  }

  if (lan.length > 0) {
    console.log('');
    console.log(cyan('  ────────────── 手机上怎么看 ──────────────'));
    console.log('');
    for (const item of lan) {
      const phoneUrl = `http://${item.address}:${appPort}`;
      console.log('    手机连上同一个 WiFi，浏览器打开：');
      console.log(`    ${green(phoneUrl)}   ${dim(`(${item.name})`)}`);
      await printQr(phoneUrl);
    }
    console.log(dim('    打不开的话，按顺序排查：'));
    console.log(dim('      1. 确认手机和电脑连的是同一个 WiFi（不是手机流量）'));
    console.log(dim('      2. Windows 弹"是否允许 Node.js 访问网络"时要点"允许"，漏点了就跑一次'));
    console.log(dim('         （管理员 PowerShell）：'));
    console.log(dim('         New-NetFirewallRule -DisplayName "班级相册 3000" -Direction Inbound'));
    console.log(dim('           -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private'));
    console.log(dim('      3. 学校/公共 WiFi 常开"客户端隔离"，设备之间互相看不见 ——'));
    console.log(dim('         用手机热点让电脑连上，再试一次就能确认是不是这个原因'));
    console.log('');
    console.log(dim('    注意：局域网是 http，浏览和上传都正常，但"添加到主屏幕"'));
    console.log(dim('    （PWA 安装）要求 https，要等部署到域名之后才能用。'));
  }

  console.log('');
  console.log(dim('    按 Ctrl+C 停止。数据存在 web/.data 里，关掉不会丢。'));
  console.log('');
  openBrowser(appUrl);
} else {
  console.log('');
  console.log(red('  ⚠ 等了 60 秒网站还没起来，把上面的报错贴到仓库的 issue 里。'));
}

/* ================= 工具函数 ================= */

/**
 * 端口被占用时，判断是不是我们自己上次留下的 node 进程，是就清掉。
 * 只动 node.exe，别误伤别的软件。
 */
async function freeStalePort(port, label) {
  if (process.platform !== 'win32') return;
  let output = '';
  try {
    output = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes(`:${port} `) || !line.includes('LISTENING')) continue;
    const match = line.trim().match(/(\d+)$/);
    if (match) pids.add(match[1]);
  }
  if (pids.size === 0) return;

  for (const pid of pids) {
    let imageName = '';
    try {
      imageName = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: 'utf8',
        windowsHide: true,
      }).trim().split(',')[0].replace(/"/g, '').toLowerCase();
    } catch {
      continue;
    }
    if (imageName !== 'node.exe') {
      console.log(dim(`  • ${label}端口 ${port} 被 ${imageName} 占用，不认识它，先不动`));
      continue;
    }
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true });
      console.log(dim(`  • 清掉了上次残留的${label}进程（PID ${pid}）`));
    } catch {
      /* 杀不掉就算了，后面 bind 会报错 */
    }
  }
}

/** 从 .env.local 里读一个值，用来显示管理员学号之类的信息 */
function readEnvValue(key) {
  try {
    const text = readFileSync(resolve(root, '.env.local'), 'utf8');
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'));
    if (!match) return null;
    const value = match[1].trim().replace(/^["']|["']$/g, '');
    return value || null;
  } catch {
    return null;
  }
}

function run(command, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('exit', (code) => resolvePromise(code ?? 0));
    child.on('error', () => resolvePromise(1));
  });
}

/** 找出本机所有对外可用的 IPv4 地址（手机要访问的就是它们） */
function lanAddresses() {
  const result = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) {
        result.push({ name, address: item.address });
      }
    }
  }
  return result;
}

/** 打印终端二维码，省得在手机上敲 IP；没装包就跳过 */
async function printQr(text) {
  try {
    const mod = await import('qrcode-terminal');
    const qr = mod.default ?? mod;
    await new Promise((done) => {
      qr.generate(text, { small: true }, (code) => {
        console.log(code.split('\n').map((line) => `    ${line}`).join('\n'));
        done();
      });
    });
  } catch {
    /* 二维码只是锦上添花，失败不影响使用 */
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* 还没起来，继续等 */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    console.log(dim(`    浏览器没自动打开的话，手动访问 ${url}`));
  }
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('');
  console.log(dim('  正在关闭…'));
  try {
    dev?.kill();
  } catch {
    /* ignore */
  }
  await dbServer?.stop().catch(() => {});
  await db?.close().catch(() => {});
  console.log(dim('  已停止。下次双击「本地启动.bat」就能接着用。'));
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
