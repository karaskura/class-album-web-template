'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { processAvatar } from '@/lib/image-client';
import Avatar from './Avatar';

/** 「我的」页面里可点击换头像 */
export default function AvatarUpload({
  name,
  avatarUrl,
}: {
  name: string;
  /** 已经拼好的头像 URL（客户端组件不能 import lib/storage） */
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError('');
    // 先本地预览，上传慢的时候也有反馈
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    try {
      const blob = await processAvatar(file);
      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '上传失败');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!window.confirm('把头像换回默认的（名字第一个字）？')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error('操作失败');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      <button
        type="button"
        className="avatar-editable"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="点一下换头像"
        aria-label="更换头像"
      >
        {localPreview ? (
          <span className="avatar avatar-img avatar-lg">
            <img src={localPreview} alt="" />
          </span>
        ) : (
          <Avatar name={name} src={avatarUrl} size="lg" />
        )}
      </button>

      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
          {busy ? '处理中…' : '点头像换一张'}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          自动从中间裁成圆形
        </div>
        {avatarUrl && !busy && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: '2px 6px', fontSize: 12, marginTop: 2 }}
            onClick={removeAvatar}
          >
            用回默认头像
          </button>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 4 }}>{error}</div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="选择头像图片"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
