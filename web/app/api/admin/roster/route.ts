import { generateInviteCode, isValidStudentNo } from '@/lib/auth';
import { audit, query, tx } from '@/lib/db';
import { HttpError, handler } from '@/lib/http';
import { requireAdmin } from '@/lib/session';

type Body = { text?: string };

type ParsedRow = { studentNo: string; name: string | null };

/** 纯学号：4~20 位数字 */
const NUMBER_ONLY = /^\d{4,20}$/;

/**
 * 批量导入班级名单。
 *
 * 管理员把名单粘进来，系统给每个学号生成一个**绑定学号**的邀请码。
 * 这就是"学号白名单"：不在名单上的学号，即使拿到别人的码也用不了。
 *
 * 姓名可以不写（同学注册时自己填），所以下面几种都能认：
 *   20260001                 一行一个学号
 *   20260001,张三            学号 + 姓名（逗号、顿号、制表符、空格都行）
 *   20260001 20260002 ...  从 Excel 整列粘过来挤在一行里
 */
function parseRoster(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const push = (studentNo: string, name: string | null) => {
    if (!isValidStudentNo(studentNo)) return false;
    if (seen.has(studentNo)) return true; // 重复的就静默跳过
    seen.add(studentNo);
    rows.push({ studentNo, name });
    return true;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const tokens = line.split(/[\s,，、\t]+/).filter(Boolean);

    // 情况一：一行里塞了多个纯学号（Excel 整列复制最常见）
    if (tokens.length > 1 && tokens.every((t) => NUMBER_ONLY.test(t))) {
      tokens.forEach((t) => push(t, null));
      continue;
    }

    // 情况二：学号 + 姓名
    if (tokens.length === 2 && NUMBER_ONLY.test(tokens[0]) && !NUMBER_ONLY.test(tokens[1])) {
      if (!push(tokens[0], tokens[1])) errors.push(line);
      continue;
    }

    // 情况三：只有学号
    if (tokens.length === 1 && NUMBER_ONLY.test(tokens[0])) {
      if (!push(tokens[0], null)) errors.push(line);
      continue;
    }

    errors.push(line);
  }

  return { rows, errors };
}

export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Body;

  const text = (body.text ?? '').trim();
  if (!text) throw new HttpError(400, '先把名单粘进来');

  const { rows, errors } = parseRoster(text);
  if (rows.length === 0) {
    throw new HttpError(400, '一行都没解析出来，格式应该是「学号,姓名」，一行一个同学');
  }
  if (rows.length > 200) throw new HttpError(400, '一次最多导入 200 人');

  // 已有账号的跳过，已经被绑过邀请码的也跳过，避免重复生成
  const existingUsers = new Set(
    (
      await query<{ student_no: string }>(
        `select student_no from users where student_no = any($1::text[])`,
        [rows.map((row) => row.studentNo)],
      )
    ).map((row) => row.student_no),
  );
  const existingInvites = new Set(
    (
      await query<{ bound_student_no: string }>(
        `select bound_student_no from invites
          where bound_student_no = any($1::text[]) and used_by is null`,
        [rows.map((row) => row.studentNo)],
      )
    ).map((row) => row.bound_student_no),
  );

  const created: Array<{ studentNo: string; name: string | null; code: string }> = [];
  const skipped: Array<{ studentNo: string; name: string | null; reason: string }> = [];

  for (const row of rows) {
    if (existingUsers.has(row.studentNo)) {
      skipped.push({ ...row, reason: '已经有账号了' });
      continue;
    }
    if (existingInvites.has(row.studentNo)) {
      skipped.push({ ...row, reason: '已经有未使用的邀请码' });
      continue;
    }
    created.push({ ...row, code: '' });
  }

  if (created.length > 0) {
    await tx(async (client) => {
      for (const item of created) {
        // 撞码概率极低，但还是要保证唯一
        let code = '';
        for (let attempt = 0; attempt < 8 && !code; attempt += 1) {
          const candidate = generateInviteCode();
          const taken = await client.query('select 1 from invites where code = $1', [candidate]);
          if (taken.rowCount === 0) code = candidate;
        }
        if (!code) throw new HttpError(500, '生成邀请码失败，再试一次');

        await client.query(
          `insert into invites (code, note, bound_student_no, created_by)
           values ($1, $2, $3, $4)`,
          [code, item.name, item.studentNo, admin.id],
        );
        item.code = code;
      }
    });
  }

  await audit(admin.id, 'roster.import', null, {
    created: created.length,
    skipped: skipped.length,
  });

  return Response.json({
    ok: true,
    created,
    skipped,
    errors,
  });
});
