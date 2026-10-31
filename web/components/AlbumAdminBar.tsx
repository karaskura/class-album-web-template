'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconTrash, IconX } from './icons';

/** 相册详情页的管理条（仅管理员可见）：改名、改日期、改说明、删相册 */
export default function AlbumAdminBar({
  albumId,
  albumName,
  photoCount,
  initialDescription,
  initialEventDate,
}: {
  albumId: number;
  albumName: string;
  photoCount: number;
  initialDescription: string | null;
  initialEventDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(albumName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [eventDate, setEventDate] = useState(initialEventDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          eventDate: eventDate || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '保存失败');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const hint =
      photoCount > 0
        ? `相册「${albumName}」里有 ${photoCount} 张照片。\n\n删掉相册后，这些照片不会消失，只是变成"未归类"，还能在时间轴里看到。`
        : `确定删除空相册「${albumName}」吗？`;
    if (!window.confirm(`${hint}\n\n确定要删这个相册吗？`)) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/albums/${albumId}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '删除失败');
      router.replace('/albums');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
          编辑相册
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
          <IconTrash size={15} />
          删相册
        </button>
        {error && (
          <span style={{ color: 'var(--danger)', fontSize: 13, width: '100%' }}>{error}</span>
        )}
      </>
    );
  }

  return (
    <form className="card card-pad" onSubmit={save} style={{ width: '100%', maxWidth: 460 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14.5 }}>编辑相册</b>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setName(albumName);
            setDescription(initialDescription ?? '');
            setEventDate(initialEventDate ?? '');
            setError('');
            setOpen(false);
          }}
          aria-label="收起"
        >
          <IconX size={15} />
        </button>
      </div>

      <div className="field">
        <label htmlFor="album-edit-name">相册名</label>
        <input
          id="album-edit-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="album-edit-date">活动日期</label>
        <input
          id="album-edit-date"
          className="input"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="album-edit-desc">一句话说明</label>
        <input
          id="album-edit-desc"
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={120}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
        {busy ? '保存中…' : '保存'}
      </button>
    </form>
  );
}
