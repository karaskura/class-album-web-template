import { one, query } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireOwner } from '@/lib/session';
import { sanitizeKey } from '@/lib/storage';

type CreateBody = {
  slot?: string;
  title?: string;
  subtitle?: string;
  imageKey?: string | null;
  linkUrl?: string | null;
};

type UpdateBody = CreateBody & { id?: number };

function cleanImageKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let key: string;
  try {
    key = sanitizeKey(raw);
  } catch {
    throw new HttpError(400, '宣传图路径不对');
  }
  if (!key.startsWith('promos/')) throw new HttpError(400, '宣传图路径不对');
  return key;
}

function cleanLink(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    throw new HttpError(400, '链接要以 http(s):// 开头，或者以 / 开头的站内路径');
  }
  if (url.length > 300) throw new HttpError(400, '链接太长了');
  return url;
}

/** 宣传栏：新建（只有维护者） */
export const POST = handler(async (req: Request) => {
  const owner = await requireOwner();
  const body = (await req.json().catch(() => ({}))) as CreateBody;

  const slot = body.slot === 'login' || body.slot === 'home' ? body.slot : null;
  if (!slot) throw new HttpError(400, '宣传位置只能是登录页或主页');

  const title = (body.title ?? '').trim();
  if (!title) throw new HttpError(400, '给宣传写个标题吧');
  if (title.length > 60) throw new HttpError(400, '标题最多 60 字');

  const subtitle = (body.subtitle ?? '').trim();
  if (subtitle.length > 120) throw new HttpError(400, '副标题最多 120 字');

  const imageKey = cleanImageKey(body.imageKey);
  const linkUrl = cleanLink(body.linkUrl);

  const sorts = await one<{ next: number }>(
    `select coalesce(max(sort_order), 0) + 1 as next from promos where slot = $1`,
    [slot],
  );

  const row = await one<{ id: number }>(
    `insert into promos (slot, title, subtitle, image_key, link_url, sort_order, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [slot, title, subtitle || null, imageKey, linkUrl, sorts?.next ?? 1, owner.id],
  );

  return Response.json({ ok: true, id: row?.id });
});

/** 宣传栏：改标题/副标题/图/链接（只有维护者） */
export const PATCH = handler(async (req: Request) => {
  await requireOwner();
  const body = (await req.json().catch(() => ({}))) as UpdateBody;

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '要改哪一条？');

  const current = await one<{ id: number }>('select id from promos where id = $1', [id]);
  if (!current) throw new HttpError(404, '这条宣传不见了');

  const title = (body.title ?? '').trim();
  if (!title) throw new HttpError(400, '标题不能空着');
  if (title.length > 60) throw new HttpError(400, '标题最多 60 字');

  const subtitle = (body.subtitle ?? '').trim();
  if (subtitle.length > 120) throw new HttpError(400, '副标题最多 120 字');

  await query(
    `update promos set title = $2, subtitle = $3, image_key = $4, link_url = $5 where id = $1`,
    [id, title, subtitle || null, cleanImageKey(body.imageKey), cleanLink(body.linkUrl)],
  );

  return Response.json({ ok: true });
});

/** 宣传栏：删掉（只有维护者） */
export const DELETE = handler(async (req: Request) => {
  await requireOwner();
  const body = (await req.json().catch(() => ({}))) as { id?: number };

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '要删哪一条？');

  await query('delete from promos where id = $1', [id]);
  return Response.json({ ok: true });
});
