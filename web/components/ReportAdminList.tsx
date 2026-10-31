'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { relativeTime } from '@/lib/format';
import type { ReportRow } from '@/lib/types';

/** 管理员处理举报（2026-10-08 · 安全评估要求建立举报机制） */
export default function ReportAdminList({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function act(id: number, action: 'handled' | 'dismissed') {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '操作失败');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }

  const pending = reports.filter((item) => item.status === 'pending');
  const done = reports.filter((item) => item.status !== 'pending');

  return (
    <div className="stack" style={{ gap: 14 }}>
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>
            待处理
            <span className="count">{pending.length}</span>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="empty">没有待处理的举报，挺好</div>
        ) : (
          <div className="report-list">
            {pending.map((report) => (
              <div className="report-item" key={report.id}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="chip active">{report.reason}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {report.target_type === 'photo' ? '照片' : '评论'} · {report.reporter_name} 举报于{' '}
                    {relativeTime(report.created_at)}
                  </span>
                </div>

                <div style={{ fontSize: 13.5, marginTop: 6 }}>
                  {report.target_preview ? `「${report.target_preview}」` : '（内容已被删除，或没有文字）'}
                </div>

                {report.detail && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    补充说明：{report.detail}
                  </div>
                )}

                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {report.target_type === 'photo' && (
                    <a className="btn btn-sm" href={`/photos/${report.target_id}`}>
                      去看看这条内容
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busyId === report.id}
                    onClick={() => act(report.id, 'handled')}
                  >
                    处理完了
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busyId === report.id}
                    onClick={() => act(report.id, 'dismissed')}
                  >
                    忽略
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="card card-pad">
          <div className="section-title" style={{ margin: 0 }}>
            已处理
            <span className="count">{done.length}</span>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.9 }}>
            {done.map((report) => (
              <div key={report.id}>
                {report.target_type === 'photo' ? '照片' : '评论'}#{report.target_id} · {report.reason} ·{' '}
                {report.status === 'handled' ? '已处理' : '已忽略'}
                {report.handled_by_name ? `（${report.handled_by_name}）` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
