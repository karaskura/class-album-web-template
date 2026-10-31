'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { processImage, putBlob } from '@/lib/image-client';
import { IconCheck, IconClose, IconImage, IconPlus, IconTrash } from './icons';

export type PromoItem = {
  id: number;
  title: string;
  subtitle: string | null;
  imageKey: string | null;
  imageUrl: string;
  linkUrl: string | null;
};

type Slot = 'login' | 'home';

type FormState = {
  id: number | null;
  title: string;
  subtitle: string;
  linkUrl: string;
  imageKey: string | null;
  preview: string;
};

const EMPTY: FormState = { id: null, title: '', subtitle: '', linkUrl: '', imageKey: null, preview: '' };

/**
 * 宣传栏管理（只有维护者能用）。
 * 两个位置：登录页宣传栏（一条就够）、主页宣传（可以多条，自动轮播）。
 */
export default function PromoAdmin({
  loginPromos,
  homePromos,
}: {
  loginPromos: PromoItem[];
  homePromos: PromoItem[];
}) {
  return (
    <>
      <PromoBoard
        slot="login"
        heading="登录页宣传栏"
        hint="登录页右边那块宣传图 + 标题 + 一句话。谁都能看到（包括还没登录、只看不做的游客）。"
        items={loginPromos}
        withLink={false}
      />
      <PromoBoard
        slot="home"
        heading="主页宣传"
        hint="主页顶部的大横幅，可以放多条——同学们打开主页会轮播着看。一条都没有时就显示最新活动。"
        items={homePromos}
        withLink
      />
    </>
  );
}

function PromoBoard({
  slot,
  heading,
  hint,
  items,
  withLink,
}: {
  slot: Slot;
  heading: string;
  hint: string;
  items: PromoItem[];
  withLink: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  function reset() {
    setForm(EMPTY);
    setError('');
  }

  async function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const processed = await processImage(file);
      const res = await fetch('/api/promos/image', {
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
      setForm((current) => ({
        ...current,
        imageKey: data.target!.key,
        preview: URL.createObjectURL(processed.orig),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '宣传图上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!form.title.trim()) {
      setError('标题不能空着');
      return;
    }
    setBusy(true);
    setError('');
    setDone('');
    try {
      const payload = {
        slot,
        title: form.title,
        subtitle: form.subtitle,
        imageKey: form.imageKey,
        linkUrl: withLink ? form.linkUrl : null,
      };
      const res = await fetch('/api/promos', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '没存上');
      setDone(form.id ? '改好了' : '发布好了');
      setForm(EMPTY);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '没存上');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: PromoItem) {
    if (busy) return;
    if (!window.confirm(`删掉「${item.title}」？`)) return;
    setBusy(true);
    setDone('');
    try {
      const res = await fetch('/api/promos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      if (!res.ok) throw new Error('没删掉');
      setDone('删掉了');
      if (form.id === item.id) setForm(EMPTY);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '没删掉');
    } finally {
      setBusy(false);
    }
  }

  function edit(item: PromoItem) {
    setForm({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle ?? '',
      linkUrl: item.linkUrl ?? '',
      imageKey: item.imageKey,
      preview: item.imageUrl,
    });
    setDone('');
    setError('');
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        {heading}
        <span className="count">{items.length} 条</span>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>
        {hint}
      </p>

      <form onSubmit={submit}>
        <label className="promo-picker">
          {form.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.preview} alt="宣传图" />
          ) : (
            <span className="promo-picker-empty">
              {uploading ? '上传中…' : '选一张宣传图（可以不放图，只写文字）'}
            </span>
          )}
          <input type="file" accept="image/*" onChange={pickImage} hidden />
        </label>

        <div className="field">
          <label htmlFor={`promo-title-${slot}`}>宣传标题</label>
          <input
            id={`promo-title-${slot}`}
            className="input"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="例如：国庆峡谷采风 · 照片交换"
            maxLength={60}
            required
          />
        </div>

        <div className="field">
          <label htmlFor={`promo-sub-${slot}`}>一句说明（可空）</label>
          <input
            id={`promo-sub-${slot}`}
            className="input"
            value={form.subtitle}
            onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
            placeholder="例如：10 月 6 日之前把照片传上来"
            maxLength={120}
          />
        </div>

        {withLink && (
          <div className="field">
            <label htmlFor={`promo-link-${slot}`}>点它去哪（可空）</label>
            <input
              id={`promo-link-${slot}`}
              className="input"
              value={form.linkUrl}
              onChange={(event) => setForm((current) => ({ ...current, linkUrl: event.target.value }))}
              placeholder="/activities/1 或 https://…"
              maxLength={300}
            />
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {done && <div className="form-ok">{done}</div>}

        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
            <IconPlus size={16} />
            {form.id ? '保存修改' : '发布'}
          </button>
          {form.id && (
            <button type="button" className="btn" onClick={reset}>
              <IconClose size={15} />
              取消编辑
            </button>
          )}
          {uploading && <span className="muted" style={{ fontSize: 12.5 }}>宣传图在上传…</span>}
        </div>
      </form>

      {items.length > 0 && (
        <div className="promo-list">
          {items.map((item) => (
            <div key={item.id} className="promo-row">
              <span className="promo-thumb">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} />
                ) : (
                  <IconImage size={18} />
                )}
              </span>
              <span className="grow">
                <span className="promo-title">{item.title}</span>
                {item.subtitle && <span className="muted promo-sub">{item.subtitle}</span>}
              </span>
              <button type="button" className="btn btn-sm" onClick={() => edit(item)}>
                <IconCheck size={14} />
                编辑
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(item)}>
                <IconTrash size={14} />
                删
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
