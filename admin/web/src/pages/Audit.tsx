import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { qs } from '@/lib/api'
import { useDebounced, useFetch } from '@/lib/use-fetch'
import { ago, full, n } from '@/lib/format'
import { ActiveFilters, Avatar, Chips, Empty, ErrorLine, Loading, PageHeader, Pager, Panel, Pill, SearchBox, Segmented, SidePanel, Toolbar, rowClick } from '@/components/app/ui'

const ACTIONS: Record<string, string> = {
  'login': '登录了', 'login.fail': '登录失败', 'me.password': '改了自己的密码',
  'student.edit': '改了学生资料', 'student.disable': '停用了学生', 'student.enable': '恢复了学生', 'students.export': '导出了学生名单',
  'word.create': '新增了单词', 'word.edit': '改了单词', 'word.tts': 'AI 生成了发音', 'word.publish': '上架了', 'word.unpublish': '下架了',
  'words.publish': '批量上架', 'words.unpublish': '批量下架', 'words.import': '导入了词库', 'words.export': '导出了词库',
  'course.edit': '改了课程', 'course.open': '开放了', 'course.close': '关闭了',
  'teacher.create': '添加了老师', 'teacher.edit': '改了老师介绍', 'teacher.delete': '删除了老师',
  'user.create': '新建了后台账号', 'user.edit': '改了后台账号', 'user.disable': '停用了后台账号', 'user.enable': '恢复了后台账号', 'user.delete': '删除了后台账号', 'user.password': '重置了密码',
  'role.create': '新建了角色', 'role.edit': '改了角色权限', 'role.delete': '删除了角色'
}
export const actionLabel = (a: string) => ACTIONS[a] || a
const KINDS: Record<string, string> = { login: '登录', me: '我的账号', student: '学生', students: '学生', word: '单词', words: '单词', course: '课程', teacher: '老师', user: '账号', role: '角色' }

type Row = { id: number; at: string; userId: number | null; username: string; action: string; target: string; detail: string; ip: string }
type List = { total: number; page: number; size: number; kinds: { k: string; n: number }[]; rows: Row[] }

const prettyDetail = (d: string) => { try { const j = JSON.parse(d); return JSON.stringify(j, null, 2) } catch { return d } }

export function Audit() {
  const [q, setQ] = useState('')
  const [range, setRange] = useState('7d')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Row | null>(null)
  const dq = useDebounced(q)
  useEffect(() => setPage(1), [dq, range, kind])
  const { data, error, loading } = useFetch<List>('/audit' + qs({ q: dq, range, kind, page, size: 50 }))
  const kinds = new Map<string, number>()
  for (const k of data?.kinds || []) { const key = k.k === 'students' ? 'student' : k.k === 'words' ? 'word' : k.k; kinds.set(key, (kinds.get(key) || 0) + k.n) }
  const fails = data?.kinds.find(k => k.k === 'login')
  return (
    <>
      <PageHeader crumb="系统" title="操作日志" desc="谁在什么时候改了什么;登录和失败的登录也记在这里" />
      <Panel>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="搜账号、对象、内容  /" />
          <Segmented label="时间" value={range} onChange={setRange} options={[{ value: '24h', label: '24 小时' }, { value: '7d', label: '7 天' }, { value: '30d', label: '30 天' }, { value: 'all', label: '全部' }]} />
        </Toolbar>
        {kinds.size > 0 && <div className="border-b px-4 py-2"><Chips group="类型" value={kind} onChange={v => setKind(v === kind ? '' : v)} options={[...kinds].map(([k, c]) => ({ value: k, label: KINDS[k] || k, count: c }))} /></div>}
        <ActiveFilters total={data?.total || 0} items={[...(dq ? [{ label: `搜索「${dq}」`, clear: () => setQ('') }] : []), ...(kind ? [{ label: KINDS[kind] || kind, clear: () => setKind('') }] : [])]} onClear={() => { setQ(''); setKind('') }} />
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !data.rows.length ? <Empty>这段时间没有操作{fails ? '' : ''}</Empty> : (
          <table className="jb-table">
            <thead><tr><th>时间</th><th>谁</th><th>做了什么</th><th className="hidden md:table-cell">详情</th><th className="hidden lg:table-cell">IP</th><th className="w-8" /></tr></thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id} {...rowClick(() => setOpen(r))} style={r.action === 'login.fail' ? { boxShadow: 'inset 3px 0 0 var(--bad)' } : undefined}>
                  <td className="nw text-text-2" title={full(r.at)}>{ago(r.at)}</td>
                  <td className="nw"><div className="flex items-center gap-2"><Avatar name={r.username} id={r.username} size={24} /><span className="font-medium">{r.username || '—'}</span></div></td>
                  <td><span className={r.action === 'login.fail' ? 'text-bad' : 'text-text-3'}>{actionLabel(r.action)}</span> {!(r.action.startsWith('login') && r.target === r.username) && <span className="text-foreground" title={r.target}>{r.target}</span>}</td>
                  <td className="hidden max-w-[360px] md:table-cell"><span className="line-clamp-1 font-mono text-xs text-text-3" title={r.detail}>{r.detail || '—'}</span></td>
                  <td className="nw hidden font-mono text-xs text-text-4 lg:table-cell">{r.ip}</td>
                  <td className="text-text-4"><ChevronRight className="size-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Panel>
      <SidePanel open={!!open} onClose={() => setOpen(null)} width={520} title={open ? `${open.username} ${actionLabel(open.action)}` : ''} sub={open && full(open.at)}>
        {open && (
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px]">
            <dt className="text-text-3">账号</dt><dd className="font-mono">{open.username}</dd>
            <dt className="text-text-3">动作</dt><dd><Pill tone={open.action === 'login.fail' ? 'bad' : 'off'}>{open.action}</Pill></dd>
            <dt className="text-text-3">对象</dt><dd className="break-words">{open.target || '—'}</dd>
            <dt className="text-text-3">时间</dt><dd className="num">{full(open.at)}</dd>
            <dt className="text-text-3">IP</dt><dd className="font-mono">{open.ip}</dd>
            <dt className="text-text-3">详情</dt><dd>{open.detail ? <pre className="whitespace-pre-wrap break-all rounded-lg bg-secondary p-2.5 font-mono text-xs">{prettyDetail(open.detail)}</pre> : '—'}</dd>
            <dt className="text-text-3">编号</dt><dd className="num text-text-4">#{n(open.id)}</dd>
          </dl>
        )}
      </SidePanel>
    </>
  )
}
