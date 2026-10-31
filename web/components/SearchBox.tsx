'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconSearch } from './icons';

/** 搜索框：回车或点按钮跳到 /search?q=... */
export default function SearchBox({
  initialQuery = '',
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const keyword = value.trim();
    if (!keyword) return;
    router.push(`/search?q=${encodeURIComponent(keyword)}`);
  }

  return (
    <form className="search-box" onSubmit={submit} role="search">
      <span className="search-icon">
        <IconSearch size={17} />
      </span>
      <input
        className="search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜描述、人物、相册名…"
        aria-label="搜索照片"
        autoFocus={autoFocus}
        maxLength={40}
      />
      <button type="submit" className="btn btn-sm btn-primary" disabled={!value.trim()}>
        搜索
      </button>
    </form>
  );
}
