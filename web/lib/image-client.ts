/**
 * 浏览器端图片压缩 + 缩略图生成。
 *
 * 为什么放在浏览器做？
 *  - 低配云主机跑 sharp / ImageMagick 会吃不消
 *  - 图片不用流经服务器，直接传对象存储，省带宽
 *  - 顺便把 EXIF（包含 GPS 定位）洗掉，保护隐私
 *
 * 每张照片产出三份：
 *   micro  480px   —— 网格/瀑布流用
 *   thumb  1280px  —— 点开看大图用
 *   orig   2560px  —— 管理员归档/备份用（仍然是有损压缩，但不是原始几十兆的巨图）
 *
 * 三份都会印上水印（维护者 2026-10-05：防图片被盗用）——
 * 网页上看得见的那张（thumb）才是别人真正会右键/长按存走的，只盖原图没意义。
 */

export type ProcessedImage = {
  micro: Blob;
  thumb: Blob;
  orig: Blob;
  width: number;
  height: number;
  /** 存储用后缀，例如 .webp */
  ext: string;
  mime: string;
};

const MICRO_MAX = 480;
const THUMB_MAX = 1280;
const ORIG_MAX = 2560;

/**
 * 水印文字（维护者 2026-10-05「图上打水印」定）。
 * 想换内容：部署环境里设 NEXT_PUBLIC_WATERMARK（例如「桂电示例班」），改完重新构建。
 */
const WATERMARK_TEXT = (process.env.NEXT_PUBLIC_WATERMARK ?? '').trim();

/** 平铺斜向水印：浅色照片和深色照片上都看得见，但不糊住画面 */
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  if (!WATERMARK_TEXT || width < 140 || height < 140) return;

  const fontSize = Math.max(13, Math.round(Math.min(width, height) * 0.042));
  const stepX = fontSize * 6.4;
  const stepY = fontSize * 4.2;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const reach = Math.sqrt(width * width + height * height) / 2 + Math.max(stepX, stepY);
  const cols = Math.ceil(reach / stepX);
  const rows = Math.ceil(reach / stepY);

  for (let col = -cols; col <= cols; col += 1) {
    for (let row = -rows; row <= rows; row += 1) {
      const x = col * stepX + (row % 2 === 0 ? 0 : stepX / 2);
      const y = row * stepY;
      // 先垫一层深色再画浅色：亮背景上浅色看不见，暗背景上深色看不见
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#000000';
      ctx.fillText(WATERMARK_TEXT, x + 1, y + 1);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(WATERMARK_TEXT, x, y);
    }
  }

  ctx.restore();
}

let webpSupported: boolean | null = null;

/** 检测浏览器能不能编码 webp（Safari 16+ 可以） */
async function canEncodeWebp(): Promise<boolean> {
  if (webpSupported !== null) return webpSupported;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.8),
    );
    webpSupported = blob?.type === 'image/webp';
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

/** 当前浏览器最终会产出什么格式（决定存储用的后缀和 Content-Type） */
export async function preferredOutputMime(): Promise<{ mime: string; ext: string }> {
  const webp = await canEncodeWebp();
  return webp ? { mime: 'image/webp', ext: '.webp' } : { mime: 'image/jpeg', ext: '.jpg' };
}

async function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  // createImageBitmap 能按 EXIF 方向摆正
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      /* 落到下面的 <img> 方案 */
    }
  }

  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('这张图片浏览器打不开'));
    el.src = url;
  });
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

function scaleToFit(width: number, height: number, max: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= max) return { width, height };
  const ratio = max / longEdge;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

async function encode(
  source: CanvasImageSource,
  width: number,
  height: number,
  max: number,
  mime: string,
  quality: number,
): Promise<Blob> {
  const size = scaleToFit(width, height, max);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, size.width);
  canvas.height = Math.max(1, size.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 canvas');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  drawWatermark(ctx, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw new Error('图片压缩失败');
  return blob;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    const useWebp = await canEncodeWebp();
    const mime = useWebp ? 'image/webp' : 'image/jpeg';
    const ext = useWebp ? '.webp' : '.jpg';

    const orig = await encode(source, width, height, ORIG_MAX, mime, 0.9);
    const thumb = await encode(source, width, height, THUMB_MAX, mime, 0.85);
    const micro = await encode(source, width, height, MICRO_MAX, mime, 0.8);

    const finalSize = scaleToFit(width, height, ORIG_MAX);
    return {
      orig,
      thumb,
      micro,
      width: finalSize.width,
      height: finalSize.height,
      ext,
      mime,
    };
  } finally {
    cleanup();
  }
}

/** 带进度的 PUT（fetch 拿不到上传进度，所以用 XHR） */
export function putBlob(
  url: string,
  headers: Record<string, string>,
  blob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`上传失败（HTTP ${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error('网络中断，上传失败'));
    xhr.ontimeout = () => reject(new Error('上传超时'));
    xhr.send(blob);
  });
}

/**
 * 头像：从原图正中间裁一个正方形，缩到 256×256。
 * 传上来之前压好，服务器就只管存，不用装图像处理库。
 */
export async function processAvatar(file: File): Promise<Blob> {
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    const side = Math.min(width, height);
    const sx = Math.round((width - side) / 2);
    const sy = Math.round((height - side) / 2);
    const out = 256;

    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持 canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 先画一个圆形的裁剪区，再往里画图 ——
    // 圆外的四个角不画，保持透明，所以存下来的文件本身就是圆的
    ctx.beginPath();
    ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(source, sx, sy, side, side, 0, 0, out, out);

    // 必须用带透明通道的格式：JPEG 没有 alpha，四角会变成黑块
    const useWebp = await canEncodeWebp();
    const mime = useWebp ? 'image/webp' : 'image/png';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, 0.9),
    );
    if (!blob) throw new Error('头像处理失败');
    return blob;
  } finally {
    cleanup();
  }
}
