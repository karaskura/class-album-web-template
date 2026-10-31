'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconCalendar } from './icons';
import LaceFrame from './LaceFrame';

export type HomePromo = {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
};

const ROTATE_MS = 5200;

/**
 * 主页横幅：维护者可以放多条宣传，这里自动轮播（手机电脑都一样，点下面小圆点切换）。
 * 一条都没有的时候，主页会回落到"最新活动"那张横幅。
 */
export default function PromoCarousel({ promos }: { promos: HomePromo[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (promos.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % promos.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [promos.length]);

  if (promos.length === 0) return null;
  const active = Math.min(index, promos.length - 1);
  const promo = promos[active];

  const inner = (
    <>
      <LaceFrame withBow />
      {promo.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={promo.imageUrl} alt={promo.title} />
      ) : (
        <span className="home-banner-fallback">
          <IconCalendar size={30} />
        </span>
      )}
      <span className="home-banner-caption">
        <span className="home-banner-tag">宣传</span>
        <span className="home-banner-title">{promo.title}</span>
        {promo.subtitle && <span className="home-banner-sub">{promo.subtitle}</span>}
        {promos.length > 1 && (
          <span className="home-banner-sub">
            第 {active + 1} / {promos.length} 条
          </span>
        )}
      </span>
    </>
  );

  return (
    <div className="promo-carousel">
      {promo.linkUrl ? (
        promo.linkUrl.startsWith('/') ? (
          <Link href={promo.linkUrl} className="home-banner">
            {inner}
          </Link>
        ) : (
          <a href={promo.linkUrl} className="home-banner" target="_blank" rel="noreferrer">
            {inner}
          </a>
        )
      ) : (
        <div className="home-banner">{inner}</div>
      )}

      {promos.length > 1 && (
        <div className="promo-dots">
          {promos.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              className={dotIndex === active ? 'active' : ''}
              onClick={() => setIndex(dotIndex)}
              aria-label={`看第 ${dotIndex + 1} 条宣传`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
