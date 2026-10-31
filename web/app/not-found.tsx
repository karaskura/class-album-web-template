import Link from 'next/link';

/**
 * 全站 404。
 *
 * 给三个出口：回首页、去下载页、回登录页。模板里没有备案号页脚，
 * 需要的话在 components/SiteFooter.tsx 的 FILINGS 里填。
 */
const btn: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 10,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 14,
  textDecoration: 'none',
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '32px 20px',
        background: 'var(--bg)',
        color: 'var(--text)',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: 44, fontWeight: 700, letterSpacing: '-1px' }}>404</p>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>这个页面不存在</h1>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>
        可能是链接敲错了一个字母，也可能是这一页已经挪走或删掉了。
        <br />
        从下面回去就行。
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>
        <Link
          href="/"
          style={{ ...btn, background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 600 }}
        >
          回到首页
        </Link>
        <Link href="/download" style={btn}>
          下载客户端
        </Link>
        <Link href="/login" style={btn}>
          去登录 / 加入
        </Link>
      </div>
    </main>
  );
}
