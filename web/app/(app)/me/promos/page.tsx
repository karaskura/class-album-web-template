import Link from 'next/link';
import { redirect } from 'next/navigation';
import PromoAdmin, { type PromoItem } from '@/components/PromoAdmin';
import { listPromos } from '@/lib/queries';
import { getViewer, isOwner } from '@/lib/session';
import { promoImageUrl } from '@/lib/storage';
import type { PromoRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: '主页宣传' };

function toItem(row: PromoRow): PromoItem {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageKey: row.image_key,
    imageUrl: promoImageUrl(row.image_key),
    linkUrl: row.link_url,
  };
}

/** 「我的 → 主页宣传」：登录页宣传栏 + 主页横幅的编辑处（只有维护者能进） */
export default async function PromosPage() {
  const viewer = await getViewer();
  if (viewer?.kind !== 'user') redirect('/login');
  // 宣传内容只能维护者发（他本人的要求）
  if (!isOwner(viewer.user)) redirect('/me');

  const all = await listPromos();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">主页宣传</h1>
          <p className="page-sub">登录页的宣传栏、主页的横幅，都在这儿改；只有你能发</p>
        </div>
        <span className="spacer" />
        <Link href="/me" className="btn btn-sm">
          回我的
        </Link>
      </div>

      <PromoAdmin
        loginPromos={all.filter((row) => row.slot === 'login').map(toItem)}
        homePromos={all.filter((row) => row.slot === 'home').map(toItem)}
      />
    </>
  );
}
