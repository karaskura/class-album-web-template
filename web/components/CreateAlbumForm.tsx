'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconPlus, IconX } from './icons';

/** 新建相册（管理员） */
export default function CreateAlbumForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          eventDate: eventDate || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '创建失败');
      setName('');
      setDescription('');
      setEventDate('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        <IconPlus size={16} />
        新建相册
      </button>
    );
  }

  return (
    <form className="card card-pad" onSubmit={submit} style={{ width: '100%', maxWidth: 420 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <b>新建相册</b>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setOpen(false)}
          aria-label="收起"
        >
          <IconX size={15} />
        </button>
      </div>

      <div className="field">
        <label htmlFor="album-name">相册名</label>
        <input
          id="album-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：秋季运动会"
          maxLength={60}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="album-date">活动日期（选填）</label>
        <input
          id="album-date"
          className="input"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="album-desc">一句话说明（选填）</label>
        <input
          id="album-desc"
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：三天的比赛，我们班拿了团体第二"
          maxLength={120}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
        {busy ? '创建中…' : '创建'}
      </button>
    </form>
  );
}
