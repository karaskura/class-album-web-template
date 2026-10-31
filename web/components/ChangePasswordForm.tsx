'use client';

import { useState } from 'react';

/** 「我的」页面里的自助修改密码 */
export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');

    if (next.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一样');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '修改失败');

      reset();
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 2600);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-block" onClick={() => setOpen(true)}>
        修改密码
      </button>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14.5 }}>修改密码</b>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          收起
        </button>
      </div>

      {done ? (
        <div className="form-ok" style={{ marginBottom: 0 }}>
          密码已改好。其它设备上的登录已经退掉了，这台还在。
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="current-password">当前密码</label>
            <input
              id="current-password"
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="new-password">新密码</label>
            <input
              id="new-password"
              className="input"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              placeholder="至少 6 位"
              minLength={6}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirm-password">再输一遍新密码</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy || !current || !next || !confirm}
          >
            {busy ? '提交中…' : '确认修改'}
          </button>

          <p className="form-hint" style={{ marginBottom: 0, marginTop: 8 }}>
            改完之后，其它设备上的登录会自动退掉，你这台不受影响。
          </p>
        </>
      )}
    </form>
  );
}
