import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import LoginPanel from '@/components/LoginPanel';
import { getLoginPromo } from '@/lib/queries';
import { getCurrentUser } from '@/lib/session';
import { promoImageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '登录' };

/** 登录页：宣传图 + 宣传标题，两个入口（账号 / 游客） */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string; bootstrap?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');

  const { applied, bootstrap } = await searchParams;

  // 宣传栏由维护者在「我的 → 主页宣传」里配；没配就用自带的静态图
  // （登录页谁都能打开，所以这张图必须走公开出口，不能挂班里的真实照片）
  const promo = await getLoginPromo();
  const bannerUrl = promoImageUrl(promo?.image_key) || '/login-banner.svg';

  return (
    <Suspense fallback={null}>
      <LoginPanel
        bannerUrl={bannerUrl}
        bannerTitle={promo?.title || '班级相册'}
        bannerSubtitle={promo?.subtitle || '我们班的照片和活动，都在这里'}
        justApplied={applied === '1'}
        bootstrap={bootstrap === '1'}
      />
    </Suspense>
  );
}
