'use client';

import { useState } from 'react';
import { REPORT_REASONS } from '@/lib/reports';

type Props = {
  targetType: 'photo' | 'comment';
  targetId: number;
  /** 评论下面那行小字用紧凑样式 */
  compact?: boolean;
};

/**
 * 举报按钮（2026-10-08）
 *
 * 点开是个小表单（原因 + 可选补充说明），提交到 /api/reports，
 * 管理员在「管理后台 → 举报」里处理。
 */
export default function ReportButton({ targetType, targetId, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, detail }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '提交失败');
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="muted" style={{ fontSize: 12.5 }}>
        举报已提交，管理员会处理
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={compact ? 'report-link' : 'btn btn-sm btn-ghost'}
        onClick={() => setOpen(true)}
      >
        举报
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="report-form">
      <select
        className="input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="举报原因"
      >
        {REPORT_REASONS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <input
        className="input"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="补充说明（可不填，200 字以内）"
        maxLength={200}
        aria-label="补充说明"
      />
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? '提交中' : '提交举报'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
        >
          取消
        </button>
      </div>
      {error && (
        <span className="muted" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
          {error}
        </span>
      )}
    </form>
  );
}
