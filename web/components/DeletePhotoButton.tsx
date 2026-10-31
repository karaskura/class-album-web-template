'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconTrash } from './icons';

/** 照片详情页的「删除」按钮 */
export default function DeletePhotoButton({
  photoId,
  isOwner,
}: {
  photoId: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    const warning = isOwner
      ? '确定删除这张照片吗？'
      : '这是同学上传的照片，确定要以管理员身份删掉吗？';

    if (!window.confirm(`${warning}\n\n删掉之后照片会从网站上消失，而且不能恢复。`)) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '删除失败');

      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
        <IconTrash size={16} />
        {busy ? '删除中…' : '删除'}
      </button>
      {error && (
        <span style={{ color: 'var(--danger)', fontSize: 13, width: '100%' }}>{error}</span>
      )}
    </>
  );
}
