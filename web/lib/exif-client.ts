/**
 * 浏览器端读 EXIF 拍摄时间。
 *
 * 只做一件事：从 JPEG 的 APP1 段里把 DateTimeOriginal 抠出来。
 * 不引入 exif-js 之类的依赖。
 *
 * 顺带一提：后面用 canvas 重新编码，会把 EXIF（含 GPS 定位）整块丢掉，
 * 所以外链看到的是"干净"的图，不会泄露拍摄地点。
 */

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME = 0x0132;

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

/** "2026:09:15 14:30:22" → "2026-09-15T14:30:22" */
function exifDateToIso(value: string): string | null {
  const m = value.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (y === '0000') return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

type IfdEntry = { tag: number; type: number; count: number; valueOffset: number; rawOffset: number };

function readIfd(view: DataView, tiffStart: number, ifdOffset: number, little: boolean): IfdEntry[] {
  const entries: IfdEntry[] = [];
  const base = tiffStart + ifdOffset;
  if (base + 2 > view.byteLength) return entries;
  const count = view.getUint16(base, little);
  // 防御异常文件：条目数不可能特别多
  if (count > 512) return entries;

  for (let i = 0; i < count; i += 1) {
    const entryOffset = base + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    entries.push({
      tag: view.getUint16(entryOffset, little),
      type: view.getUint16(entryOffset + 2, little),
      count: view.getUint32(entryOffset + 4, little),
      valueOffset: view.getUint32(entryOffset + 8, little),
      rawOffset: entryOffset + 8,
    });
  }
  return entries;
}

function readValue(view: DataView, tiffStart: number, entry: IfdEntry, little: boolean): unknown {
  // 2 = ASCII
  if (entry.type === 2) {
    const length = entry.count;
    const offset = length <= 4 ? entry.rawOffset : tiffStart + entry.valueOffset;
    if (offset + length > view.byteLength) return null;
    return readAscii(view, offset, length);
  }
  // 3 = SHORT, 4 = LONG —— 目前只用到它们
  if (entry.type === 3 && entry.count === 1) {
    return length4(entry) ? view.getUint16(entry.rawOffset, little) : null;
  }
  if (entry.type === 4 && entry.count === 1) {
    return entry.valueOffset;
  }
  return null;
}

function length4(entry: IfdEntry): boolean {
  return entry.count === 1;
}

export async function readExifTakenAt(file: File | Blob): Promise<string | null> {
  try {
    if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test((file as File).name ?? '')) return null;

    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // SOI
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = view.getUint8(offset + 1);
      // SOS / EOI 之后就没有元数据了
      if (marker === 0xda || marker === 0xd9) break;
      const size = view.getUint16(offset + 2, false);
      if (size < 2) break;

      if (marker === 0xe1) {
        const segStart = offset + 4;
        // "Exif\0\0"
        if (segStart + 6 <= view.byteLength && readAscii(view, segStart, 4) === 'Exif') {
          const tiffStart = segStart + 6;
          const byteOrder = view.getUint16(tiffStart, false);
          const little = byteOrder === 0x4949; // II = 小端
          if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;

          const ifd0Offset = view.getUint32(tiffStart + 4, little);
          const ifd0 = readIfd(view, tiffStart, ifd0Offset, little);

          let exifIfdPointer: number | null = null;
          let fallback: string | null = null;
          for (const entry of ifd0) {
            if (entry.tag === TAG_EXIF_IFD) exifIfdPointer = entry.valueOffset;
            if (entry.tag === TAG_DATETIME) {
              const v = readValue(view, tiffStart, entry, little);
              if (typeof v === 'string') fallback = exifDateToIso(v);
            }
          }

          if (exifIfdPointer !== null) {
            const exifIfd = readIfd(view, tiffStart, exifIfdPointer, little);
            for (const entry of exifIfd) {
              if (entry.tag === TAG_DATETIME_ORIGINAL) {
                const v = readValue(view, tiffStart, entry, little);
                if (typeof v === 'string') {
                  const iso = exifDateToIso(v);
                  if (iso) return iso;
                }
              }
            }
          }
          return fallback;
        }
      }

      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}
