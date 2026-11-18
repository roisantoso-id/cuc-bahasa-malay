// 时间写人话:刚刚 / 3 分钟前 / 3 小时前 / 昨天 / 11-02 / 2025-11-02;完整时间放 title
export function ago(iso?: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso.length === 10 ? iso + 'T00:00:00+08:00' : iso).getTime()
  if (Number.isNaN(t)) return '—'
  const s = (Date.now() - t) / 1000
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  const d = Math.floor(s / 86400)
  if (d === 1) return '昨天'
  if (d < 7) return `${d} 天前`
  const dt = new Date(t + 8 * 3600e3).toISOString()
  return new Date().getFullYear() === new Date(t).getFullYear() ? dt.slice(5, 10) : dt.slice(0, 10)
}
export function full(iso?: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? iso : new Date(t + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + '(北京时间)'
}
export const n = (v: number | null | undefined) => (v == null ? 0 : Number(v)).toLocaleString('zh-CN')
