'use client';

import { useEffect } from 'react';

/**
 * 图片防下载（维护者 2026-10-05：「禁右键、禁长按」）。
 *
 * 挡的是「顺手保存」这条路：
 *   - 电脑上在图片上点右键 → 没有「图片另存为」
 *   - 拖拽图片到桌面/别的窗口 → 拖不动
 *   - 手机上长按弹菜单 → iOS 靠 CSS 的 -webkit-touch-callout: none，Android 走 contextmenu
 *
 * **这不是绝对防护，别当承诺**：截图、开发者工具里直接取 URL、录屏都挡不住。
 * 真正兜底的是上传时烤进图里的水印（见 lib/image-client.ts）——存出去也带着出处。
 */
export default function ImageGuard() {
  useEffect(() => {
    const isImage = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.tagName === 'IMG';

    const blockContextMenu = (event: MouseEvent) => {
      if (isImage(event.target)) event.preventDefault();
    };
    const blockDragStart = (event: DragEvent) => {
      if (isImage(event.target)) event.preventDefault();
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('dragstart', blockDragStart);
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('dragstart', blockDragStart);
    };
  }, []);

  return null;
}
