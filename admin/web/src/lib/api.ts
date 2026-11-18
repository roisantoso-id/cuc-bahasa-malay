// 后台接口:同域 cookie 登录;401 跳登录页,403 提示没权限
export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch('/api/admin' + path, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  })
  const data = await r.json().catch(() => ({}))
  if (r.status === 401 && path !== '/login') onUnauthorized()
  if (!r.ok) throw new ApiError(r.status, data.error || `出错了(${r.status})`)
  return data as T
}

export const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? '?' + s : ''
}
