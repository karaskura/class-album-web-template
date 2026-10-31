'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { processImage, putBlob } from '@/lib/image-client';
import { IconCheck, IconClose, IconImage } from './icons';

type Person = { id: number; name: string; studentNo: string };

type Props = {
  publisherName: string;
  today: string;
  people: Person[];
  selfId: number;
};

/**
 * 活动发布（维护者的图6）。
 * 封面走和照片一样的「浏览器压缩 + 签名直传」；发布者与发布时间由服务端定死，这里只是显示。
 */
export default function ActivityForm({ publisherName, today, people, selfId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set([selfId]));
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const allPicked = people.length > 0 && people.every((person) => picked.has(person.id));

  function toggle(id: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(people.map((person) => person.id)));
  }

  async function pickCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const processed = await processImage(file);
      const res = await fetch('/api/activities/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mime: processed.orig.type }),
      });
      const data = (await res.json()) as {
        target?: { key: string; url: string; headers: Record<string, string> };
        error?: string;
      };
      if (!res.ok || !data.target) throw new Error(data.error ?? '拿上传地址失败');
      await putBlob(data.target.url, data.target.headers, processed.orig);
      setCoverKey(data.target.key);
      setCoverPreview(URL.createObjectURL(processed.orig));
    } catch (err) {
      setError(err instanceof Error ? err.message : '封面上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          coverKey,
          participantIds: Array.from(picked),
        }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? '发布失败');
      router.push(`/activities/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败');
      setBusy(false);
    }
  }

  return (
    <form className="activity-form" onSubmit={submit}>
      <div className="activity-form-head">
        <h1 className="page-title">发布活动</h1>
        <button
          type="button"
          className="menu-button"
          onClick={() => router.push('/activities')}
          aria-label="关闭"
        >
          <IconClose size={18} />
        </button>
      </div>

      <label className="cover-picker">
        {coverPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverPreview} alt="活动封面" />
        ) : (
          <span className="cover-picker-empty">
            <IconImage size={30} />
            <span>{uploading ? '封面上传中…' : '请添加活动封面'}</span>
          </span>
        )}
        <input type="file" accept="image/*" onChange={pickCover} hidden />
      </label>

      <div className="field">
        <label htmlFor="activity-title">标题</label>
        <input
          id="activity-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="请输入标题"
          maxLength={60}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="activity-desc">详细内容</label>
        <textarea
          id="activity-desc"
          className="input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="请详细描述活动内容"
          rows={6}
          maxLength={2000}
        />
      </div>

      <div className="card card-pad" style={{ marginTop: 4 }}>
        <div className="row-between">
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>参加活动人员</div>
          <button type="button" className={`chip-toggle${allPicked ? ' active' : ''}`} onClick={toggleAll}>
            <IconCheck size={14} />
            全选
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 10px' }}>
          勾上的人会出现在活动详情里（共 {people.length} 个账号，已选 {picked.size} 人）
        </p>
        <div className="pick-list">
          {people.map((person) => {
            const on = picked.has(person.id);
            return (
              <button
                key={person.id}
                type="button"
                className={`pick-item${on ? ' on' : ''}`}
                onClick={() => toggle(person.id)}
              >
                <span className="pick-box">{on && <IconCheck size={13} />}</span>
                <span className="pick-name">
                  {person.name}
                  {person.id === selfId ? '（我）' : ''}
                </span>
                <span className="pick-no">{person.studentNo}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="publish-meta">
        <span>
          发布者：<b>{publisherName}</b>
        </span>
        <span>
          发布时间：<b>{today}</b>
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 12px' }}>
        发布者和发布时间按北京时间和你的账号自动填，改不了。
      </p>

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || uploading}>
        {busy ? '发布中…' : '发布活动'}
      </button>
    </form>
  );
}
