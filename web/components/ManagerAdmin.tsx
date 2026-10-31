'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconCheck, IconPlus, IconShield } from './icons';

type Manager = { id: number; name: string; student_no: string; admin_level: number };
type Candidate = { id: number; name: string; student_no: string };

const LEVEL_TEXT: Record<number, string> = {
  0: '超级管理员（维护者 · 全权）',
  1: '一级管理员（发布活动 + 审核作品）',
  2: '二级管理员（只能发布活动）',
};

/** 管理员账号管理：只有维护者能进来 */
export default function ManagerAdmin({
  managers,
  candidates,
}: {
  managers: Manager[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [level, setLevel] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function addManager() {
    if (busy) return;
    if (!userId) {
      setError('先选一个人');
      return;
    }
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), level: Number(level) }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '添加失败');
      setDone('加好了');
      setUserId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeManager(id: number, name: string) {
    if (busy) return;
    if (!window.confirm(`撤销「${name}」的管理员权限？`)) return;
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '撤销失败');
      setDone('撤掉了');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '撤销失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          添加管理员
          <span className="count">权限由你给</span>
        </div>

        <div className="field">
          <label htmlFor="manager-user">选账号</label>
          <select
            id="manager-user"
            className="input"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            <option value="">— 选一个人 —</option>
            {candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}（{person.student_no}）
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="manager-level">权限等级</label>
          <select
            id="manager-level"
            className="input"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="1">一级：发布活动 + 审核作品</option>
            <option value="2">二级：只能发布活动</option>
          </select>
        </div>

        {error && <div className="form-error">{error}</div>}
        {done && <div className="form-ok">{done}</div>}

        <button type="button" className="btn btn-primary btn-block" onClick={addManager} disabled={busy}>
          <IconPlus size={16} />
          {busy ? '处理中…' : '添加管理员'}
        </button>
      </div>

      <div className="section-title">
        现在的管理员
        <span className="count">{managers.length} 人</span>
      </div>

      <div className="card card-pad">
        <div className="manager-list">
          {managers.map((manager) => (
            <div key={manager.id} className="manager-row">
              <span className="manager-icon">
                {manager.admin_level === 0 ? <IconShield size={18} /> : <IconCheck size={18} />}
              </span>
              <span className="grow">
                <span className="manager-name">
                  {manager.name}
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {' '}
                    {manager.student_no}
                  </span>
                </span>
                <span className="muted manager-level">
                  {LEVEL_TEXT[manager.admin_level] ?? '管理员'}
                </span>
              </span>
              {manager.admin_level !== 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => removeManager(manager.id, manager.name)}
                  disabled={busy}
                >
                  撤销管理员
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
