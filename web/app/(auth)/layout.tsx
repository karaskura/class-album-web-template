import SiteFooter from '@/components/SiteFooter';
import ThemeToggle from '@/components/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      {children}
      {/* 首页底部必须挂备案号；审核员打开域名先看到的就是这一页，所以固定在底部 */}
      <SiteFooter fixed />
    </div>
  );
}
