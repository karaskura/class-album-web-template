import { confirmArchive, deleteArchiveFile, restoreArchive } from '@/lib/archive';
import { audit } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };
type Body = { action?: 'confirm' | 'restore' | 'delete-file' };

async function resolveBatchId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const batchId = Number(id);
  if (!Number.isInteger(batchId) || batchId <= 0) throw new HttpError(400, '批次 id 不对');
  return batchId;
}

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const batchId = await resolveBatchId(ctx);
  const body = (await req.json().catch(() => ({}))) as Body;

  switch (body.action) {
    case 'confirm': {
      const result = await confirmArchive(batchId);
      await audit(admin.id, 'archive.confirm', String(batchId), result);
      return Response.json({ ok: true, ...result });
    }
    case 'restore': {
      const result = await restoreArchive(batchId);
      await audit(admin.id, 'archive.restore', String(batchId), result);
      return Response.json({ ok: true, ...result });
    }
    case 'delete-file': {
      await deleteArchiveFile(batchId);
      await audit(admin.id, 'archive.deleteFile', String(batchId), null);
      return Response.json({ ok: true });
    }
    default:
      throw new HttpError(400, '不认识的操作');
  }
});
