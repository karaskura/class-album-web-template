'use client';

import { useState } from 'react';
import { IconHeart } from './icons';

/** 点赞按钮：先乐观更新，请求失败再回滚 */
export default function LikeButton({
  photoId,
  initialLiked,
  initialCount,
}: {
  photoId: number;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

    try {
      const res = await fetch(`/api/photos/${photoId}/like`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as { liked?: boolean; likeCount?: number };
      if (typeof data.likeCount === 'number') setCount(data.likeCount);
      if (typeof data.liked === 'boolean') setLiked(data.liked);
    } catch {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`like-btn${liked ? ' liked' : ''}`}
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? '取消点赞' : '点赞'}
    >
      <IconHeart size={17} filled={liked} />
      {liked ? '已赞' : '点赞'}
      <span className="muted" style={{ marginLeft: 2 }}>
        {count}
      </span>
    </button>
  );
}
