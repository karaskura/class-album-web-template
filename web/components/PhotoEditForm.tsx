'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconCheck, IconX } from './icons';

/** 照片详情页的「编辑说明 / 换相册」 */
export default function PhotoEditForm({
  photoId,
  initialDescription,
  initialAlbumId,
  albums,
}: {
  photoId: number;
  initialDescription: string | null;
  initialAlbumId: number | null;
  albums: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [albumId, setAlbumId] = useState(initialAlbumId ? String(initialAlbumId) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          albumId: albumId ? Number(albumId) : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '保存失败');

      setDone(true);
      setOpen(false);
      router.refresh();
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          编辑说明
        </button>
        {done && (
          <span className="row" style={{ color: 'var(--success)', fontSize: 13, gap: 4 }}>
            <IconCheck size={14} />
            已保存
          </span>
        )}
      </>
    );
  }

  return (
    <form
      onSubmit={save}
      className="card card-pad"
      style={{ width: '100%', marginBottom: 4 }}
    >
      <div className="row-between" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14.5 }}>编辑这张照片</b>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setDescription(initialDescription ?? '');
            setAlbumId(initialAlbumId ? String(initialAlbumId) : '');
            setError('');
            setOpen(false);
          }}
          aria-label="收起"
        >
          <IconX size={15} />
        </button>
      </div>

      <div className="field">
        <label htmlFor="photo-desc">照片说明</label>
        <textarea
          id="photo-desc"
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="比如：运动会 800 米决赛，我们在终点等他"
          maxLength={500}
          rows={3}
        />
        <span className="form-hint">
          写了说明之后，同学搜「800 米」就能搜到这张。现在 {description.length}/500 字
        </span>
      </div>

      <div className="field">
        <label htmlFor="photo-album">归到哪个相册</label>
        <select
          id="photo-album"
          className="select"
          value={albumId}
          onChange={(e) => setAlbumId(e.target.value)}
        >
          <option value="">不放进相册（只在时间轴里）</option>
          {albums.map((album) => (
            <option key={album.id} value={String(album.id)}>
              {album.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? '保存中…' : '保存'}
      </button>
    </form>
  );
}
