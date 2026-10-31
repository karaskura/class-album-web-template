/**
 * 站点页脚：备案号展示位（默认空）。
 *
 * 在中国大陆部署的站点，法规要求在首页底部展示 ICP 备案号并链接到工信部备案系统
 * （公安联网备案同理）。这个开源模板默认**不填任何号码**——你自己的部署要备案，
 * 把号码填进下面的 FILINGS 就行，全站页脚都读这一份。
 *
 * 用的是 <a> 而不是 next/link：备案系统是站外链接，要整页跳走。
 */
export const FILINGS: Array<{ text: string; href: string }> = [
  // { text: '某ICP备00000000号-1', href: 'https://beian.miit.gov.cn/' },
];

export default function SiteFooter({ fixed = false }: { fixed?: boolean }) {
  if (FILINGS.length === 0) return null;
  return (
    <footer className={fixed ? 'site-footer site-footer-fixed' : 'site-footer'}>
      {FILINGS.map((filing) => (
        <a key={filing.href} href={filing.href} target="_blank" rel="noopener noreferrer">
          {filing.text}
        </a>
      ))}
    </footer>
  );
}
