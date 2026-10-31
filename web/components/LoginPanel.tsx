'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LaceFrame from './LaceFrame';
import LoginForm from './LoginForm';

type Props = {
  bannerUrl: string;
  bannerTitle: string;
  bannerSubtitle: string;
  justApplied: boolean;
  bootstrap: boolean;
};

/**
 * 登录页（维护者的图7 / 图8）：
 * 左边（手机上是上面）是宣传图片 + 宣传标题，
 * 右边两个入口：「账号」走老流程，「游客」直接进去看（只读）。
 */
export default function LoginPanel({
  bannerUrl,
  bannerTitle,
  bannerSubtitle,
  justApplied,
  bootstrap,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'choice' | 'account'>('choice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function enterAsGuest() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' });
      if (!res.ok) throw new Error('游客入口开不了，稍后再试');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '进不去');
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-hero">
        <LaceFrame withBow />
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" />
        ) : (
          <span className="login-hero-fallback" />
        )}
        <div className="login-hero-text">
          <h1>{bannerTitle}</h1>
          <p>{bannerSubtitle}</p>
        </div>
      </div>

      <div className="login-choices">
        {mode === 'choice' ? (
          <>
            <button type="button" className="login-choice" onClick={() => setMode('account')}>
              <span className="login-choice-main">账号</span>
              <span className="login-choice-sub">我有账号，用学号和密码进</span>
            </button>

            <button
              type="button"
              className="login-choice login-choice-guest"
              onClick={enterAsGuest}
              disabled={busy}
            >
              <span className="login-choice-main">{busy ? '正在进入…' : '游客'}</span>
              <span className="login-choice-sub">我就来看看（能看，不能评论和发布）</span>
            </button>

            {error && <div className="form-error">{error}</div>}

            <div className="login-foot">
              <span className="login-foot-hint">本平台仅限本班同学，不开放注册</span>
              有邀请码？<a href="/join">申请加入</a>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="login-back" onClick={() => setMode('choice')}>
              ← 换个方式
            </button>
            <LoginForm justApplied={justApplied} bootstrap={bootstrap} />
          </>
        )}
      </div>
    </div>
  );
}
