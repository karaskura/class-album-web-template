/**
 * 统一的 API 错误类型。
 * 路由里 throw new HttpError(403, 'xx')，外层 catch 后转成 JSON。
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export function jsonOk(data: unknown = { ok: true }, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : '服务器出了点问题';
  console.error('[api]', err);
  return Response.json({ error: message }, { status: 500 });
}

/** 把路由体包一层，自动处理异常 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return jsonError(err);
    }
  };
}
