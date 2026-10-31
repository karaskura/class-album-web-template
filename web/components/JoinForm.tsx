'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconAlbumLogo, IconCheck } from './icons';

export default function JoinForm() {
  const router = useRouter();
  const [studentNo, setStudentNo] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'pending' | 'bootstrap' | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNo: studentNo.trim(),
          name: name.trim(),
          inviteCode: inviteCode.trim().toUpperCase(),
          password,
        }),
      });
      const data = (await res.json()) as { error?: string; status?: string; bootstrap?: boolean };
      if (!res.ok) throw new Error(data.error ?? '申请失败');

      if (data.bootstrap || data.status === 'active') {
        setDone('bootstrap');
        setTimeout(() => router.replace('/login?bootstrap=1'), 1200);
      } else {
        setDone('pending');
        setTimeout(() => router.replace('/login?applied=1'), 1600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '申请失败');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo" style={{ margin: '0 auto 16px' }}>
          <IconCheck size={28} />
        </div>
        <h1 className="auth-title">{done === 'pending' ? '申请已提交' : '注册成功'}</h1>
        <p className="auth-sub">
          {done === 'pending'
            ? '管理员通过之后，你就能用学号和密码登录了。'
            : '你是班里第一个注册的人，已经自动成为管理员，正在跳转登录…'}
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <IconAlbumLogo size={30} />
      </div>
      <h1 className="auth-title">加入班级相册</h1>
      <p className="auth-sub">用管理员给你的邀请码注册，只限本班同学</p>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="student-no">学号</label>
          <input
            id="student-no"
            className="input"
            value={studentNo}
            onChange={(e) => setStudentNo(e.target.value)}
            inputMode="numeric"
            maxLength={20}
            placeholder="例如 20260001"
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="name">姓名</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="真名，方便同学认出你"
            maxLength={20}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="invite">邀请码</label>
          <input
            id="invite"
            className="input"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="CA-XXXX-XXXX"
            autoComplete="off"
            required
          />
          <span className="form-hint">找班长要，一个码只能用一次</span>
        </div>

        <div className="field">
          <label htmlFor="password">设置密码</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="至少 6 位"
            minLength={6}
            required
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? '提交中…' : '提交申请'}
        </button>
      </form>

      <div className="auth-foot">
        已经有账号了？<Link href="/login">去登录</Link>
      </div>
    </div>
  );
}
