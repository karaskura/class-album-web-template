'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readExifTakenAt } from '@/lib/exif-client';
import { formatBytes, relativeTime } from '@/lib/format';
import { preferredOutputMime, processImage, putBlob } from '@/lib/image-client';
import { IconTrash, IconUpload, IconX } from './icons';

type AlbumOption = { id: number; name: string };

type QueueStatus = 'pending' | 'uploading' | 'done' | 'error';

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: QueueStatus;
  progress: number;
  error?: string;
  takenAt: string | null;
  description: string;
};

type UploadTarget = {
  key: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
};

type InitResponse = {
  targets?: Array<{ orig: UploadTarget; thumb: UploadTarget; micro: UploadTarget }>;
  error?: string;
};

const CONCURRENCY = 2;

let seq = 0;
const nextId = () => `q${Date.now()}_${seq++}`;

export default function UploadClient({
  albums,
  defaultAlbumId,
  allowedTypes,
  maxUploadMb,
}: {
  albums: AlbumOption[];
  defaultAlbumId?: number | null;
  allowedTypes: string[];
  maxUploadMb: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [albumId, setAlbumId] = useState<string>(defaultAlbumId ? String(defaultAlbumId) : '');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  // 这一批照片共用的说明（写上去之后，搜索才搜得到）
  const [batchDescription, setBatchDescription] = useState('');

  // 组件卸载时释放预览用的 objectURL
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const readyCount = useMemo(
    () => items.filter((i) => i.status === 'pending' || i.status === 'error').length,
    [items],
  );
  const doneCount = useMemo(() => items.filter((i) => i.status === 'done').length, [items]);

  const patch = useCallback((id: string, changes: Partial<QueueItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const accepted: QueueItem[] = [];
      const rejected: string[] = [];

      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          rejected.push(`${file.name}（格式不支持）`);
          continue;
        }
        if (file.size > maxUploadMb * 1024 * 1024) {
          rejected.push(`${file.name}（超过 ${maxUploadMb}MB）`);
          continue;
        }
        accepted.push({
          id: nextId(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'pending',
          progress: 0,
          takenAt: null,
          description: '',
        });
      }

      if (rejected.length > 0) {
        setSummary(`跳过 ${rejected.length} 个文件：${rejected.slice(0, 3).join('、')}${rejected.length > 3 ? ' 等' : ''}`);
      } else {
        setSummary('');
      }
      if (accepted.length === 0) return;

      setItems((list) => [...list, ...accepted]);

      // 顺手读一下 EXIF 的拍摄时间（只用来显示，不参与排序）
      accepted.forEach(async (item) => {
        const takenAt = await readExifTakenAt(item.file);
        if (takenAt) patch(item.id, { takenAt });
      });
    },
    [allowedTypes, maxUploadMb, patch],
  );

  async function startUpload() {
    const queue = items.filter((i) => i.status === 'pending' || i.status === 'error');
    if (queue.length === 0 || busy) return;

    setBusy(true);
    setSummary('');

    try {
      // 先问浏览器：最终产出 webp 还是 jpg（决定存储后缀）
      const output = await preferredOutputMime();

      const res = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: albumId ? Number(albumId) : null,
          outputMime: output.mime,
          files: queue.map((item) => ({
            name: item.file.name,
            size: item.file.size,
            type: item.file.type,
          })),
        }),
      });
      const data = (await res.json()) as InitResponse;
      if (!res.ok || !data.targets) throw new Error(data.error ?? '申请上传地址失败');

      const targets = data.targets;
      const committed: Array<Record<string, unknown>> = [];
      let cursor = 0;
      let failures = 0;

      // 简单的工作池：同时处理 CONCURRENCY 个文件
      async function worker() {
        while (cursor < queue.length) {
          const index = cursor;
          cursor += 1;
          const item = queue[index];
          const target = targets[index];
          if (!item || !target) continue;

          patch(item.id, { status: 'uploading', progress: 0, error: undefined });
          try {
            const processed = await processImage(item.file);
            await putBlob(target.micro.url, target.micro.headers, processed.micro, (r) =>
              patch(item.id, { progress: r * 0.15 }),
            );
            await putBlob(target.thumb.url, target.thumb.headers, processed.thumb, (r) =>
              patch(item.id, { progress: 0.15 + r * 0.25 }),
            );
            await putBlob(target.orig.url, target.orig.headers, processed.orig, (r) =>
              patch(item.id, { progress: 0.4 + r * 0.6 }),
            );

            committed.push({
              storageKey: target.orig.key,
              thumbKey: target.thumb.key,
              microKey: target.micro.key,
              width: processed.width,
              height: processed.height,
              bytes: processed.orig.size,
              mime: processed.mime,
              // 时间轴按发布时间排，这里只存真正的 EXIF 拍摄时间（没有就留空）
              takenAt: item.takenAt,
              description: item.description.trim() || batchDescription.trim() || null,
            });
            patch(item.id, { status: 'done', progress: 1 });
          } catch (err) {
            failures += 1;
            patch(item.id, {
              status: 'error',
              progress: 0,
              error: err instanceof Error ? err.message : '上传失败',
            });
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

      if (committed.length > 0) {
        const commitRes = await fetch('/api/upload/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ albumId: albumId ? Number(albumId) : null, items: committed }),
        });
        const commitData = (await commitRes.json()) as { count?: number; error?: string };
        if (!commitRes.ok) throw new Error(commitData.error ?? '写入数据库失败');

        setSummary(`上传完成：成功 ${commitData.count ?? committed.length} 张${failures > 0 ? `，失败 ${failures} 张` : ''}`);
        // 已完成的从队列里去掉
        setTimeout(() => {
          setItems((list) => {
            list.filter((i) => i.status === 'done').forEach((i) => URL.revokeObjectURL(i.previewUrl));
            return list.filter((i) => i.status !== 'done');
          });
        }, 1200);
        router.refresh();
      } else {
        setSummary(`上传失败 ${failures} 张，可以点"重试失败的"再试一次`);
      }
    } catch (err) {
      setSummary(err instanceof Error ? err.message : '上传出错了');
    } finally {
      setBusy(false);
    }
  }

  function removeItem(id: string) {
    setItems((list) => {
      const target = list.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return list.filter((i) => i.id !== id);
    });
  }

  function clearDone() {
    setItems((list) => {
      list.filter((i) => i.status === 'done').forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return list.filter((i) => i.status !== 'done');
    });
  }

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="album-select">上传到哪个相册</label>
        <select
          id="album-select"
          className="select"
          value={albumId}
          onChange={(e) => setAlbumId(e.target.value)}
        >
          <option value="">不放进相册（只进时间轴）</option>
          {albums.map((album) => (
            <option key={album.id} value={String(album.id)}>
              {album.name}
            </option>
          ))}
        </select>
        <span className="form-hint">
          相册由管理员在「相册」页创建；不确定就留空，照片一样会出现在时间轴里。
        </span>
      </div>

      <div className="field">
        <label htmlFor="batch-desc">给这批照片写句话（选填，但强烈建议写）</label>
        <textarea
          id="batch-desc"
          className="textarea"
          value={batchDescription}
          onChange={(e) => setBatchDescription(e.target.value)}
          placeholder="比如：2026 秋季运动会 · 4×100 米接力决赛"
          maxLength={500}
          rows={2}
        />
        <span className="form-hint">
          会写到这一批所有照片上。写了之后同学搜「运动会」「接力」就能找到；传完每张还能单独改。
        </span>
      </div>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <div className="dz-icon">
          <IconUpload size={34} />
        </div>
        <div className="dz-title">点击选择照片，或直接拖到这里</div>
        <div className="dz-sub">
          支持 JPG / PNG / WebP / GIF，单张不超过 {maxUploadMb}MB；可以一次选很多张
        </div>
      </div>

      {/* 真正的文件选择器放在拖拽区外面：嵌在 role="button" 里 ARIA 上不合法 */}
      <input
        ref={inputRef}
        type="file"
        accept={allowedTypes.join(',')}
        multiple
        className="sr-only"
        aria-label="选择要上传的照片"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {summary && <div className="form-ok">{summary}</div>}

      {items.length > 0 && (
        <>
          <div className="row-between">
            <div className="section-title" style={{ margin: 0 }}>
              待上传
              <span className="count">
                {readyCount} 张待传 · {doneCount} 张完成
              </span>
            </div>
            {doneCount > 0 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={clearDone}>
                清除已完成
              </button>
            )}
          </div>

          <div className="queue">
            {items.map((item) => (
              <div className="queue-item" key={item.id}>
                <img className="queue-thumb" src={item.previewUrl} alt="" />
                <div className="grow">
                  <div className="queue-name">{item.file.name}</div>
                  <div className="queue-sub">
                    {formatBytes(item.file.size)}
                    {item.takenAt ? ` · 拍摄于 ${relativeTime(item.takenAt)}` : ''}
                    {item.error ? ` · ${item.error}` : ''}
                  </div>
                  <div
                    className={`progress${item.status === 'done' ? ' done' : ''}${item.status === 'error' ? ' error' : ''}`}
                  >
                    <i style={{ width: `${Math.round(item.progress * 100)}%` }} />
                  </div>
                </div>
                {item.status === 'uploading' ? (
                  <span className="muted" style={{ fontSize: 12.5, flex: 'none' }}>
                    {Math.round(item.progress * 100)}%
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => removeItem(item.id)}
                    aria-label="移除"
                    disabled={busy}
                  >
                    <IconX size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={startUpload}
            disabled={busy || readyCount === 0}
          >
            {busy ? `上传中…（${doneCount}/${items.length}）` : `开始上传 ${readyCount} 张`}
          </button>

          <p className="form-hint" style={{ margin: 0 }}>
            照片在浏览器里本地压缩后才上传，同时会去掉位置等隐私信息；原图不会经过我们的服务器。
          </p>
        </>
      )}

      {items.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <IconTrash size={30} />
          </div>
          还没有待上传的照片
        </div>
      )}
    </div>
  );
}
