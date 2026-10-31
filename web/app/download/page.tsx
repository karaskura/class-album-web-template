import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter, { FILINGS } from '@/components/SiteFooter';
import './download.css';

/**
 * 客户端下载页（可选功能）。
 *
 * 为什么要有这一页：在 QQ / 微信里点 .apk / .exe 文件时，它们自己决定是「下载」还是
 * 「预览」，安装包内部改不了这个行为（没有哪个 manifest 字段能影响）。所以改的是分发路径 ——
 * 把包放到站上，发一条链接出去，让系统浏览器去下载。
 *
 * 页面会自动扫 public/download/ 里最新的 .apk / .exe：把文件丢进去、删掉旧的就行，
 * 版本号 / 大小 / SHA-256 都从文件本身算，不用改代码。一个包都没有也能正常渲染。
 *
 * 为什么顺手解释「显示不安全」：那是**安装包没买代码签名证书**，不是站点的问题 ——
 * Windows SmartScreen 对没有签名、下载量又小的新程序一律先拦一次。
 * 所以这一页给出 SHA-256 与文件大小，用户可对自己下到的包核对一次。
 *
 * 链接是纯静态页 + 纯静态文件（public/download/），不碰数据库、不需要登录，
 * 这样谁点都能下，也不会因为 cookie 失效让人卡在登录页。
 */
export const dynamic = 'force-static';

/** 站点地址：优先读 NEXT_PUBLIC_SITE_URL，没配就用示例域名 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com').replace(/\/+$/, '');
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
const PAGE_URL = `${SITE_URL}/download`;

/** public/download/ 下有没有这张图（没有就整块不渲染，模板里不放班级专属素材） */
const HAS_ICON = fs.existsSync(path.join(process.cwd(), 'public', 'download', 'icon.png'));
const HAS_QR = fs.existsSync(path.join(process.cwd(), 'public', 'download', 'qr.png'));

type Pkg = {
  file: string;
  version: string;
  size: string;
  bytes: number;
  sha256: string;
};

function humanSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * 版本号/大小不写死：构建时扫 public/download/ 里最新的那个包。
 * 以后出新包只要把文件丢进去、删掉旧的就行，页面自动跟上（不用改代码）。
 * sha256 也在这里从文件本身算，构建产物里带的是真实指纹，不是手抄的。
 */
function readPkg(ext: '.apk' | '.exe', pattern: RegExp): Pkg | null {
  const dir = path.join(process.cwd(), 'public', 'download');
  if (!fs.existsSync(dir)) return null;
  const found = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (found.length === 0) return null;
  const file = found[0].f;
  const full = path.join(dir, file);
  const bytes = fs.statSync(full).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  const m = pattern.exec(file);
  return { file, version: m ? m[1] : '—', size: humanSize(bytes), bytes, sha256 };
}

const APK = readPkg('.apk', /-(\d+\.\d+\.\d+)\.apk$/i) ?? {
  file: 'ClassAlbum-1.1.0.apk',
  version: '1.1.0',
  size: '—',
  bytes: 0,
  sha256: '—',
};
const EXE = readPkg('.exe', /-(\d+\.\d+\.\d+)\.exe$/i);

export const metadata: Metadata = {
  title: '下载客户端',
  description: `ClassAlbum ${APK.version} 安卓安装包（${APK.size}）${
    EXE ? ` · 电脑版 ${EXE.version}（${EXE.size}）` : ''
  }，网页版的安装包`,
};

/**
 * 每个版本一句话说明。新包只要版本号对得上就会自动出现在卡片底部；
 * 没登记的版本就不显示这行，不会瞎编。
 */
const NOTES: Record<string, string> = {
  '1.0.0': '第一个公开版',
  '1.0.1': '修窄屏顶栏、补 404 页',
  '1.1.0': '电脑版与安卓版版本号对齐 1.1.0，界面和功能不变',
};

/** 一包一张「凭证卡」：版本 / 大小 / SHA-256，同学能自己核对 */
function PkgFacts({ pkg, label }: { pkg: Pkg; label: string }) {
  return (
    <div className="dl-factblock">
      <p className="dl-factblock-name">{label}</p>
      <dl className="dl-facts">
        <div>
          <dt>版本</dt>
          <dd>{pkg.version}</dd>
        </div>
        <div>
          <dt>大小</dt>
          <dd>{pkg.size}</dd>
        </div>
        <div className="dl-facts-wide">
          <dt>SHA-256</dt>
          <dd>
            <code>{pkg.sha256}</code>
          </dd>
        </div>
      </dl>
      {NOTES[pkg.version] ? <p className="dl-facts-note">{NOTES[pkg.version]}</p> : null}
    </div>
  );
}

export default function DownloadPage() {
  return (
    <main className="dl-page">
      <section className="dl-card dl-hero">
        {HAS_ICON ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="dl-icon" src="/download/icon.png" alt="ClassAlbum 图标" width={88} height={88} />
        ) : null}
        <h1 className="dl-name">ClassAlbum</h1>
        <p className="dl-tag">客户端下载</p>
        <div className="dl-chips">
          <span className="dl-chip">官方域名 {SITE_HOST}</span>
          <span className="dl-chip">与网页版同源</span>
          <span className="dl-chip">同一个站、同一个账号</span>
        </div>

        <div className="dl-platforms">
          <div className="dl-platform">
            <div className="dl-platform-head">
              <span className="dl-platform-name">安卓手机版</span>
              <span className="dl-platform-meta">
                {APK.version} · {APK.size} · Android 7.0+
              </span>
            </div>
            <a className="dl-btn" href={`/download/${APK.file}`} download>
              下载 APK
            </a>
          </div>

          <div className="dl-platform">
            <div className="dl-platform-head">
              <span className="dl-platform-name">电脑版（Windows）</span>
              <span className="dl-platform-meta">
                {EXE ? `${EXE.version} · ${EXE.size} · Win10/11 64 位` : '正在准备，先用网页版'}
              </span>
            </div>
            {EXE ? (
              <a className="dl-btn dl-btn-alt" href={`/download/${EXE.file}`} download>
                下载安装包
              </a>
            ) : (
              <Link className="dl-btn dl-btn-alt" href="/">
                用浏览器打开
              </Link>
            )}
          </div>
        </div>

        <p className="dl-hint">
          在 <b>QQ / 微信</b> 里点开这一页时，如果点了没反应、或者提示「非官方网页可能不安全」，
          点右上角的 <b>「···」→ 在浏览器打开</b>，再从浏览器里点下载。它们的内置浏览器经常不给下安装包。
        </p>
      </section>

      {/* 这一段是 2026-10-27 专为「显示不安全 / 没有备案」加的：把凭证摊开给人看 */}
      <section className="dl-card" id="trust">
        <h2 className="dl-h2">为什么可能提示「不安全」？</h2>
        <div className="dl-faq">
          <details open>
            <summary>先说结论：站点是 https，弹警告的是装的时候</summary>
            <p>
              我们自己的站是 <b>{SITE_URL}</b>，用 http 打开会自动跳到 https，
              地址栏不会标「不安全」。会弹窗的是<b>安装的时候</b>：Windows 对「没有代码签名、下载量又小
              的新程序」一律先拦一次，提示「Windows 已保护你的电脑」或「未知发布者」。这不是病毒，
              是 Windows 不认识这个包。
            </p>
          </details>
          <details>
            <summary>怎么装（Windows）</summary>
            <p>
              双击安装包 → 出现蓝色窗口时点<b>「更多信息」</b> → 点<b>「仍要运行」</b> → 按向导装完。
              装完桌面和开始菜单会有 ClassAlbum 图标。
            </p>
          </details>
          <details>
            <summary>怎么确认你下到的是官方包</summary>
            <p>
              对本页给出的 <b>SHA-256</b> 核对一次就行。Windows 上在安装包所在文件夹按住 Shift 右键 →
              「在此处打开 PowerShell」→ 输入
              <code> Get-FileHash .\ClassAlbum-Setup-*.exe -Algorithm SHA256 </code>
              对一眼；手机上用任意文件管理器的「校验」功能。对不上就是没下完或者下到了别处的包，
              删掉回这一页重下。
            </p>
          </details>
          <details>
            <summary>为什么不去买代码签名证书</summary>
            <p>
              买了能把这个弹窗彻底去掉，但国内的代码签名证书要企业主体、每年几千块。这个模板的维护者
              自己出钱，所以选了「把指纹公开、让用户核对」这条更便宜的路。
            </p>
          </details>
        </div>

        <h2 className="dl-h2" style={{ marginTop: 18 }}>
          安装包指纹
        </h2>
        <PkgFacts pkg={APK} label="安卓手机版" />
        {EXE ? <PkgFacts pkg={EXE} label="电脑版（Windows）" /> : null}
        <p className="dl-facts-note">
          指纹是构建时从文件本身算出来的，和包一一对应。版本、大小、指纹三项都对得上，就是官方包。
        </p>
      </section>

      {/* 备案号：模板默认不填；把号码写进 components/SiteFooter.tsx 的 FILINGS 就会出现 */}
      {FILINGS.length > 0 ? (
        <section className="dl-card">
          <h2 className="dl-h2">备案信息</h2>
          <p className="dl-facts-note" style={{ marginTop: 0 }}>
            本站 {SITE_HOST} 已完成 ICP 备案与公安联网备案，点下面的号可以到官方系统查：
          </p>
          <ul className="dl-filings">
            {FILINGS.map((filing) => (
              <li key={filing.href}>
                <a href={filing.href} target="_blank" rel="noopener noreferrer">
                  {filing.text}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {HAS_QR ? (
        <section className="dl-card">
          <h2 className="dl-h2">扫码在浏览器里打开</h2>
          <div className="dl-qrbox">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="dl-qr" src="/download/qr.png" alt={`二维码：${PAGE_URL}`} width={120} height={120} />
            <p className="dl-qrtext">
              用手机相机或微信扫这个码，选「在浏览器打开」，然后点上面的下载按钮。
              <br />
              <br />
              网址：<b>{SITE_HOST}/download</b>
            </p>
          </div>
        </section>
      ) : null}

      <section className="dl-card">
        <h2 className="dl-h2">装到手机上（三步）</h2>
        <ol className="dl-steps">
          <li>点「下载 APK」，下完在通知栏或「下载」里点开这个文件。</li>
          <li>
            系统会问一次是否允许安装未知来源应用 —— 选<b>允许</b>（只针对浏览器/文件管理器这一次）。
          </li>
          <li>点「安装」，装完在桌面找到 ClassAlbum（圆形猫耳女孩图标）。</li>
        </ol>
      </section>

      <section className="dl-card">
        <h2 className="dl-h2">几条说明</h2>
        <div className="dl-faq">
          <details>
            <summary>装过的旧版本要不要先卸载？</summary>
            <p>不用。新包和旧包用的是同一个签名，直接覆盖安装，登录状态和缓存都还在。</p>
          </details>
          <details>
            <summary>打开后看不到照片 / 一直转圈？</summary>
            <p>先确认网络；连不上时 App 会显示一张「暂时连不上服务器」的页面，点上面的「重新加载」即可。</p>
          </details>
          <details>
            <summary>安装时提示「解析包错误」或「应用未安装」？</summary>
            <p>
              多半是下载过程被中断（内置浏览器常见）。换个浏览器重新下一遍，或者对比一下文件大小是否为{' '}
              {APK.size}。
            </p>
          </details>
          <details>
            <summary>手机版、电脑版和网页版是什么关系？</summary>
            <p>
              同一个站点、同一个账号，只是外壳不同：手机版是安卓 App，电脑版是一个窗口里装网页，
              网页版直接用浏览器打开 {SITE_HOST}，看到的是同一份内容。
            </p>
          </details>
          <details>
            <summary>为什么只要两个权限？</summary>
            <p>只申请了联网和查看网络状态，没有相册、位置、通讯录这些。传照片走的是网页的文件选择框。</p>
          </details>
        </div>
      </section>

      <p className="dl-foot">
        {SITE_HOST} · <Link href="/">回到首页</Link>
      </p>
      <SiteFooter />
    </main>
  );
}
