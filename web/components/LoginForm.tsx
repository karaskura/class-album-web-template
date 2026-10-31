'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  justApplied?: boolean;
  bootstrap?: boolean;
};

/** 账号登录（老的学号 + 密码流程，2026-10-05 晚换到新的登录页里） */
export default function LoginForm({ justApplied = false, bootstrap = false }: Props) {
  const router = useRouter();

  const [studentNo, setStudentNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNo: studentNo.trim(), password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '登录失败');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      setBusy(false);
    }
  }

  return (
    <div className="auth-card login-card">
      <h1 className="auth-title">账号登录</h1>
      <p className="auth-sub">用学号和密码进来</p>

      {justApplied && <div className="form-ok">申请已提交，等管理员通过后就能登录了。</div>}
      {bootstrap && <div className="form-ok">你是第一个注册的，已经是管理员了，登录后去后台审批同学吧。</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="student-no">学号</label>
          <input
            id="student-no"
            className="input"
            value={studentNo}
            onChange={(event) => setStudentNo(event.target.value)}
            autoComplete="username"
            inputMode="numeric"
            maxLength={20}
            placeholder="例如 20260001"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="自己设的密码"
            required
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>

      <div className="auth-foot">
        有邀请码？<a href="/join">申请加入</a>
      </div>
    </div>
  );
}
