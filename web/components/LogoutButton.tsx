'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button type="button" className="btn btn-danger btn-block" onClick={logout} disabled={busy}>
      {busy ? '正在退出…' : '退出登录'}
    </button>
  );
}
