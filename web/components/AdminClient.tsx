'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDay, formatBytes, relativeTime } from '@/lib/format';
import type { InviteRow, MemberRow } from '@/lib/types';
import { IconCheck, IconPlus, IconX } from './icons';

type Props = {
  members: MemberRow[];
  invites: InviteRow[];
  stats: { memberCount: number; photoCount: number; pendingCount: number; albumCount: number; totalBytes: number };
  currentUserId: number;
  tiers: { fresh: number; cold: number; archivable: number; archivableBytes: number; totalActive: number };
  uploaderGroups: Array<{ uploader_id: number | null; name: string; count: number; bytes: number }>;
  batches: Array<{
    id: number;
    created_at: string;
    photo_count: number;
    total_bytes: number;
    file_bytes: number | null;
    confirmed_at: string | null;
    note: string | null;
    creator_name: string | null;
    remaining: number;
  }>;
};

type Tab = 'pending' | 'members' | 'invites' | 'archive';

/** 名单导入接口的返回 */
type RosterResult = {
  created: Array<{ studentNo: string; name: string | null; code: string }>;
  skipped: Array<{ studentNo: string; name: string | null; reason: string }>;
  errors: string[];
};

export default function AdminClient({
  members,
  invites,
  stats,
  currentUserId,
  tiers,
  uploaderGroups,
  batches,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(stats.pendingCount > 0 ? 'pending' : 'members');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteBound, setInviteBound] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rosterText, setRosterText] = useState('');
  const [importing, setImporting] = useState(false);
  const [rosterResult, setRosterResult] = useState<RosterResult | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState('');
  const [batchBusy, setBatchBusy] = useState<number | null>(null);

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status !== 'pending');
  const unusedInvites = invites.filter((i) => !i.used_by);

  async function call<T = { error?: string }>(url: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? '操作失败');
    return data as T;
  }

  async function importRoster() {
    setImporting(true);
    setError('');
    setRosterResult(null);
    try {
      const data = await call<RosterResult>('/api/admin/roster', 'POST', { text: rosterText });
      setRosterResult({
        created: data.created ?? [],
        skipped: data.skipped ?? [],
        errors: data.errors ?? [],
      });
      setRosterText('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  async function act(memberId: number, action: 'approve' | 'disable' | 'enable' | 'promote') {
    setBusyId(memberId);
    setError('');
    try {
      await call(`/api/admin/members/${memberId}`, 'PATCH', { action });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }

  async function runArchive() {
    if (tiers.archivable === 0) return;
    const ok = window.confirm(
      `要把 ${tiers.archivable} 张（超过 14 天）的照片归档吗？\n\n` +
        `归档后会做两件事：\n` +
        `① 这些照片立刻从网站上下来，同学看不到了\n` +
        `② 服务器把它们打包成一个 zip 等你下载\n\n` +
        `注意：这一步不会删服务器上的照片，你下载并确认保存之后才会删。`,
    );
    if (!ok) return;

    setArchiving(true);
    setArchiveMsg('');
    setError('');
    try {
      const data = await call<{ batchId?: number; count?: number; zipBytes?: number; error?: string }>(
        '/api/admin/archive',
        'POST',
        {},
      );
      setArchiveMsg(
        `归档完成：${data.count} 张照片已下架，打包 ${formatBytes(data.zipBytes ?? 0)}。往下翻，点「下载归档包」。`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '归档失败');
    } finally {
      setArchiving(false);
    }
  }

  async function batchAction(batchId: number, action: 'confirm' | 'restore' | 'delete-file') {
    const labels: Record<string, string> = {
      confirm: '确认已经保存到本地了？确认后会删除服务器上的照片文件，腾出空间。（如果还没下载或者解压失败，先别点）',
      restore: '把这一批恢复到网站上？',
      'delete-file': '删掉服务器上的归档包？（照片文件已经删过了，这只是把 zip 也删掉）',
    };
    if (!window.confirm(labels[action])) return;

    setBatchBusy(batchId);
    setError('');
    try {
      await call(`/api/admin/archive/${batchId}`, 'POST', { action });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBatchBusy(null);
    }
  }

  async function resetPassword(memberId: number, name: string) {
    const input = window.prompt(
      `给「${name}」设个新密码。\n\n留空 = 自动生成一个好念的临时密码。\n自己输的话至少 6 位。`,
      '',
    );
    if (input === null) return; // 点了取消

    setBusyId(memberId);
    setError('');
    setResetResult(null);
    try {
      const data = await call<{ password?: string; generated?: boolean }>(
        `/api/admin/members/${memberId}`,
        'PATCH',
        { action: 'reset-password', password: input.trim() || undefined },
      );
      if (!data.password) throw new Error('服务器没返回新密码，怪怪的');
      setResetResult({ name, password: data.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(memberId: number, name: string) {
    if (!window.confirm(`确定拒绝并删除「${name}」的申请吗？`)) return;
    setBusyId(memberId);
    setError('');
    try {
      await call(`/api/admin/members/${memberId}`, 'DELETE');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }

  async function createInvite() {
    setCreating(true);
    setError('');
    try {
      await call('/api/admin/invites', 'POST', {
        note: inviteNote.trim() || null,
        boundStudentNo: inviteBound.trim() || null,
      });
      setInviteNote('');
      setInviteBound('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setCreating(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('浏览器不允许复制，请手动选中');
    }
  }

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.memberCount}</div>
          <div className="stat-label">班级成员</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.photoCount}</div>
          <div className="stat-label">照片总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: stats.pendingCount > 0 ? 'var(--warning)' : undefined }}>
            {stats.pendingCount}
          </div>
          <div className="stat-label">待审批</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.albumCount}</div>
          <div className="stat-label">
            相册数{stats.totalBytes > 0 ? ` · 共 ${formatBytes(stats.totalBytes)}` : ''}
          </div>
        </div>
      </div>

      <div className="chips">
        <button
          type="button"
          className={`chip${tab === 'pending' ? ' active' : ''}`}
          onClick={() => setTab('pending')}
        >
          待审批 {pending.length > 0 ? `(${pending.length})` : ''}
        </button>
        <button
          type="button"
          className={`chip${tab === 'members' ? ' active' : ''}`}
          onClick={() => setTab('members')}
        >
          全体成员
        </button>
        <button
          type="button"
          className={`chip${tab === 'invites' ? ' active' : ''}`}
          onClick={() => setTab('invites')}
        >
          邀请码
        </button>
        <button
          type="button"
          className={`chip${tab === 'archive' ? ' active' : ''}`}
          onClick={() => setTab('archive')}
        >
          归档 {tiers.archivable > 0 ? `(${tiers.archivable})` : ''}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {copied && <div className="form-ok">邀请码已复制</div>}
      {resetResult && (
        <div className="form-ok">
          「{resetResult.name}」的新密码是：<b className="invite-code">{resetResult.password}</b>
          <br />
          <span className="muted" style={{ fontSize: 12.5 }}>
            把密码单独发给他，让他登录后自己改。他其它设备上的登录已经被踢掉了。
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: 8 }}
            onClick={() => {
              navigator.clipboard?.writeText(resetResult.password).catch(() => {});
            }}
          >
            复制
          </button>
        </div>
      )}

      {tab === 'pending' && (
        <div className="card">
          {pending.length === 0 ? (
            <div className="empty">没有待审批的同学</div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>学号</th>
                    <th>姓名</th>
                    <th>申请时间</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((m) => (
                    <tr key={m.id}>
                      <td>{m.student_no}</td>
                      <td>{m.name}</td>
                      <td className="muted">{relativeTime(m.created_at)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busyId === m.id}
                          onClick={() => act(m.id, 'approve')}
                        >
                          <IconCheck size={14} />
                          通过
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busyId === m.id}
                          onClick={() => reject(m.id, m.name)}
                        >
                          <IconX size={14} />
                          拒绝
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>身份</th>
                  <th>状态</th>
                  <th>照片</th>
                  <th>最近登录</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {active.map((m) => (
                  <tr key={m.id}>
                    <td>{m.student_no}</td>
                    <td>{m.name}</td>
                    <td>
                      {m.role === 'admin' ? (
                        <span className="badge badge-accent">管理员</span>
                      ) : (
                        <span className="badge">同学</span>
                      )}
                    </td>
                    <td>
                      {m.status === 'active' ? (
                        <span className="badge">正常</span>
                      ) : (
                        <span className="badge badge-danger">已停用</span>
                      )}
                    </td>
                    <td className="muted">{m.photo_count}</td>
                    <td className="muted">{m.last_login_at ? relativeTime(m.last_login_at) : '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {m.id !== currentUserId && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={busyId === m.id}
                            onClick={() => resetPassword(m.id, m.name)}
                            title="他忘了密码时，给他设一个新的"
                          >
                            重置密码
                          </button>
                          {m.role !== 'admin' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={busyId === m.id}
                              onClick={() => act(m.id, 'promote')}
                            >
                              设为管理员
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={busyId === m.id}
                            onClick={() => act(m.id, m.status === 'active' ? 'disable' : 'enable')}
                          >
                            {m.status === 'active' ? '停用' : '恢复'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'invites' && (
        <div className="stack">
          <div className="card card-pad">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <b>批量导入班级名单</b>
              <span className="muted" style={{ fontSize: 12.5 }}>
                一人一个专属邀请码
              </span>
            </div>
            <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
              一行一个学号就够（姓名让同学注册时自己填）；想一起带上就写「学号,姓名」。
              逗号、顿号、空格、制表符都能分。从 Excel 整列复制过来也认得。
              导入后每个人的码<b>只有他自己的学号能用</b>，这就是学号白名单。
            </p>
            <textarea
              className="textarea"
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              placeholder={'20260001\n20260002\n20260003\n…\n\n想带姓名也行：\n20260010,张三'}
              rows={6}
              spellCheck={false}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={importRoster}
              disabled={importing || !rosterText.trim()}
              style={{ marginTop: 10 }}
            >
              {importing ? '导入中…' : '导入名单并生成邀请码'}
            </button>

            {rosterResult && (
              <div style={{ marginTop: 12 }}>
                <div className="form-ok" style={{ marginBottom: 8 }}>
                  成功生成 {rosterResult.created.length} 个邀请码
                  {rosterResult.skipped.length > 0
                    ? `，跳过 ${rosterResult.skipped.length} 个（已有账号或已有未用码）`
                    : ''}
                  {rosterResult.errors.length > 0 ? `，${rosterResult.errors.length} 行看不懂` : ''}
                </div>
                {rosterResult.created.length > 0 && (
                  <div className="table-scroll" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>学号</th>
                          <th>姓名</th>
                          <th>邀请码</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rosterResult.created.map((row) => (
                          <tr key={row.studentNo}>
                            <td>{row.studentNo}</td>
                            <td className="muted">{row.name ?? '（待同学自己填）'}</td>
                            <td>
                              <span className="invite-code">{row.code}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {rosterResult.errors.length > 0 && (
                  <p className="form-hint" style={{ marginBottom: 0 }}>
                    看不懂的行：{rosterResult.errors.slice(0, 5).join(' / ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <b>生成邀请码</b>
              <span className="muted" style={{ fontSize: 12.5 }}>
                一个码只能用一次
              </span>
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ flex: '1 1 180px' }}
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                placeholder="备注，例如：给张伟"
                maxLength={60}
              />
              <input
                className="input"
                style={{ flex: '1 1 160px' }}
                value={inviteBound}
                onChange={(e) => setInviteBound(e.target.value)}
                placeholder="限定学号（选填）"
                maxLength={20}
              />
              <button type="button" className="btn btn-primary" onClick={createInvite} disabled={creating}>
                <IconPlus size={15} />
                {creating ? '生成中…' : '生成'}
              </button>
            </div>
          </div>

          <div className="card">
            {invites.length === 0 ? (
              <div className="empty">还没有生成过邀请码</div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>邀请码</th>
                      <th>备注</th>
                      <th>状态</th>
                      <th>创建时间</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td>
                          <span className="invite-code">{invite.code}</span>
                        </td>
                        <td className="muted">
                          {invite.note ?? '—'}
                          {invite.bound_student_no ? `（限 ${invite.bound_student_no}）` : ''}
                        </td>
                        <td>
                          {invite.used_by ? (
                            <span className="badge">
                              已被 {invite.used_by_name ?? '同学'} 使用
                            </span>
                          ) : (
                            <span className="badge badge-accent">未使用</span>
                          )}
                        </td>
                        <td className="muted">{formatDay(invite.created_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {!invite.used_by && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => copyCode(invite.code)}
                            >
                              复制
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="form-hint" style={{ margin: 0 }}>
            未使用的邀请码还有 {unusedInvites.length} 个。把码单独发给同学，别发在群里。
          </p>
        </div>
      )}

      {tab === 'archive' && (
        <div className="stack">
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-value">{tiers.fresh}</div>
              <div className="stat-label">新内容 · 一周内</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{tiers.cold}</div>
              <div className="stat-label">低频访问 · 1～2 周</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-value"
                style={{ color: tiers.archivable > 0 ? 'var(--warning)' : undefined }}
              >
                {tiers.archivable}
              </div>
              <div className="stat-label">待归档 · 两周以上</div>
            </div>
          </div>

          <p className="form-hint" style={{ margin: 0 }}>
            规则：一周内的照片正常展示；一周到两周之间算「低频访问」；超过两周进入「待归档」。
            <b>什么时候归档由你决定</b>，系统只负责累计和提醒。
          </p>

          {archiveMsg && <div className="form-ok">{archiveMsg}</div>}

          <div className="card card-pad">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <b>待归档内容</b>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {tiers.archivable} 张 · {formatBytes(tiers.archivableBytes)}
              </span>
            </div>

            {tiers.archivable === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                还没有超过两周的照片，暂时不用归档。
              </p>
            ) : (
              <>
                <div
                  className="table-scroll"
                  style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}
                >
                  <table className="table">
                    <thead>
                      <tr>
                        <th>上传者</th>
                        <th>张数</th>
                        <th>大小</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploaderGroups.map((group) => (
                        <tr key={group.uploader_id ?? 'gone'}>
                          <td>{group.name}</td>
                          <td>{group.count}</td>
                          <td className="muted">{formatBytes(group.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={runArchive}
                  disabled={archiving}
                >
                  {archiving ? '归档中…（打包可能要几十秒）' : `一键归档 ${tiers.archivable} 张`}
                </button>
                <p className="form-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  归档 = 从网站下架 + 打包好等你下载。<b>服务器上的照片不会立刻删</b>，
                  等你确认「已保存到本地」之后才删。
                </p>
              </>
            )}
          </div>

          {batches.length > 0 && (
            <div className="card card-pad">
              <div style={{ marginBottom: 12 }}>
                <b>归档历史</b>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}
                  >
                    <div className="row-between" style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {formatDay(batch.created_at)} · {batch.photo_count} 张 ·{' '}
                        {formatBytes(batch.total_bytes)}
                      </span>
                      {batch.confirmed_at ? (
                        <span className="badge">已保存，服务器副本已删</span>
                      ) : (
                        <span className="badge badge-warn">等你确认</span>
                      )}
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {batch.file_bytes !== null && (
                        <a
                          className="btn btn-sm btn-primary"
                          href={`/api/admin/archive/${batch.id}/download`}
                        >
                          下载归档包（{formatBytes(batch.file_bytes)}）
                        </a>
                      )}
                      {!batch.confirmed_at && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={batchBusy === batch.id}
                            onClick={() => batchAction(batch.id, 'confirm')}
                          >
                            我确认已保存，删除服务器副本
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={batchBusy === batch.id}
                            onClick={() => batchAction(batch.id, 'restore')}
                          >
                            恢复上架
                          </button>
                        </>
                      )}
                      {batch.confirmed_at && batch.file_bytes !== null && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={batchBusy === batch.id}
                          onClick={() => batchAction(batch.id, 'delete-file')}
                        >
                          删掉归档包
                        </button>
                      )}
                    </div>

                    {batch.note && (
                      <p className="form-hint" style={{ marginBottom: 0, marginTop: 8 }}>
                        {batch.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card card-pad">
            <b>归档之后，怎么保存到你电脑上</b>
            <ol style={{ fontSize: 13.5, lineHeight: 2, paddingLeft: 20, margin: '10px 0 0' }}>
              <li>点「下载归档包」—— zip 里<b>已经按上传者姓名分好文件夹</b></li>
              <li>
                解压到 <b>X:\GUET&amp;CLASS\</b>，解压完就是
                <code style={{ fontSize: 12.5 }}>
                  {['X:', 'GUET&CLASS', '王康哲', '2026-09-24_0018.webp'].join(String.fromCharCode(92))}
                </code>
              </li>
              <li>
                确认文件都在，回到这里点「我确认已保存」→ <b>服务器上的照片才会被删掉</b>
              </li>
            </ol>
            <p className="form-hint" style={{ marginTop: 10, marginBottom: 0 }}>
              第 3 步之前，服务器上的照片一直留着，随时能「恢复上架」。照片是没法重拍的，
              所以这一步故意做成手动的。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
