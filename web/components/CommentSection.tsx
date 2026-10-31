'use client';

import { useState } from 'react';
import { relativeTime } from '@/lib/format';
import Avatar from './Avatar';
import ReportButton from './ReportButton';
import type { CommentRow } from '@/lib/types';

type CommentWithAvatar = CommentRow & { avatarUrl?: string | null };

type Props = {
  photoId: number;
  initialComments: CommentWithAvatar[];
  currentUserName: string;
  currentUserAvatarUrl?: string | null;
  /** 当前登录用户 id（游客传 null）：决定能不能举报/删除 */
  currentUserId?: number | null;
  /** 管理员能删任何一条评论 */
  canModerate?: boolean;
  /** 游客没有评论权：只显示列表，不显示输入框 */
  canComment?: boolean;
};

/** 评论列表 + 发评论 + 举报/删除（举报机制 2026-10-08 加） */
export default function CommentSection({
  photoId,
  initialComments,
  currentUserName,
  currentUserAvatarUrl,
  currentUserId = null,
  canModerate = false,
  canComment = true,
}: Props) {
  const [comments, setComments] = useState<CommentWithAvatar[]>(initialComments);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content || busy) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { comment?: CommentRow; error?: string };
      if (!res.ok || !data.comment) throw new Error(data.error ?? '发送失败');
      setComments((list) => [
        ...list,
        { ...(data.comment as CommentRow), avatarUrl: currentUserAvatarUrl },
      ]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setBusy(false);
    }
  }

  /** 软删除：作者删自己的，管理员删任何一条 */
  async function removeComment(id: number) {
    if (busy) return;
    if (!window.confirm('删掉这条评论？')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '删除失败');
      setComments((list) => list.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="section-title" style={{ margin: 0 }}>
        评论
        <span className="count">{comments.length}</span>
      </div>

      {comments.length === 0 ? (
        <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
          还没有人说话，来抢个沙发吧。
        </p>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <Avatar name={comment.author_name} src={comment.avatarUrl} size="sm" />
              <div className="comment-body grow">
                <div className="comment-head">
                  <span className="comment-name">{comment.author_name}</span>
                  <span className="comment-time">{relativeTime(comment.created_at)}</span>
                </div>
                <div className="comment-text">{comment.content}</div>
                {currentUserId !== null && (
                  <div className="comment-actions">
                    {currentUserId !== null && comment.user_id !== currentUserId && (
                      <ReportButton targetType="comment" targetId={comment.id} compact />
                    )}
                    {(canModerate ||
                      (currentUserId !== null && comment.user_id === currentUserId)) && (
                      <button
                        type="button"
                        className="report-link"
                        onClick={() => removeComment(comment.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!canComment && (
        <p className="guest-hint">
          游客只能看，想评论就先 <a href="/login">登录</a>
        </p>
      )}

      {canComment && (
        <form onSubmit={submit} className="row" style={{ gap: 8 }}>
          <Avatar name={currentUserName} src={currentUserAvatarUrl} size="sm" />
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="说点什么…"
            maxLength={500}
            aria-label="写评论"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? '发送中' : '发送'}
          </button>
        </form>
      )}
      {error && (
        <p className="muted" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
