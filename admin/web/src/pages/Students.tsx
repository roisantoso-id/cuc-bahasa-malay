import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, qs } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useDebounced, useFetch } from '@/lib/use-fetch'
import { ago, full, n } from '@/lib/format'
import { ActiveFilters, Avatar, Chips, Empty, ErrorLine, Field, Kpis, Loading, MiniStats, PageHeader, Pager, Panel, Pill, SearchBox, Section, Segmented, SidePanel, Toolbar, rowClick, useConfirm } from '@/components/app/ui'

type Row = { id: number; name: string; school: string; className: string; track: string; phone: string; status: string; note: string; dailyNew: number; learned: number; mastered: number; days: number; createdAt: string; lastActiveAt: string }
type List = { total: number; page: number; size: number; counts: { total: number; disabled: number | null; active7: number | null; idle: number | null; some: number | null }; rows: Row[] }
type Level = { level: number; city: string; total: number; learned: number; mastered: number; published: boolean; stamped: boolean }
type Detail = { student: Row; total: { learned: number; mastered: number; fav: number; wrong: number; studyDays: number }; days: { day: string; new: number; review: number }[]; boxes: number[]; levels: Level[]; streak: number; checkedToday: boolean; wrong: { rank: number; ms: string; zh: string; wrong: number; box: number }[] }

const TRACK: Record<string, string> = { zero: '零基础', some: '会说一些' }
const ACTIVE = [{ value: '', label: '全部' }, { value: '7d', label: '近 7 天在学' }, { value: 'idle', label: '两周没来' }] as const

export function Students() {
  const { can } = useAuth()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [active, setActive] = useState<string>('')
  const [status, setStatus] = useState('')
  const [track, setTrack] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  useEffect(() => setPage(1), [dq, active, status, track])
  const { data, error, loading, reload } = useFetch<List>('/students' + qs({ q: dq, active, status, track, page, size: 20 }))
  const openId = Number(sp.get('id')) || 0
  const open = (id: number) => setSp(id ? { id: String(id) } : {})
  const c = data?.counts
  const filters = [
    ...(dq ? [{ label: `搜索「${dq}」`, clear: () => setQ('') }] : []),
    ...(active ? [{ label: ACTIVE.find(a => a.value === active)!.label, clear: () => setActive('') }] : []),
    ...(status ? [{ label: status === 'disabled' ? '已停用' : '正常', clear: () => setStatus('') }] : []),
    ...(track ? [{ label: TRACK[track], clear: () => setTrack('') }] : [])
  ]
  return (
    <>
      <PageHeader crumb="教学" title="学生" desc="学生在小程序里注册;这里看学习情况、改资料、停用账号"
        actions={can('students.export') && <Button variant="outline" asChild><a href={'/api/admin/students.csv' + qs({ q: dq, active, status, track })}><Download />导出 CSV</a></Button>} />
      <Kpis items={[
        { label: '学生总数', value: n(c?.total) },
        { label: '近 7 天在学', value: n(c?.active7), sub: c?.total ? `占 ${Math.round((c.active7 || 0) / c.total * 100)}%` : undefined, tone: 'ok' },
        { label: '会说一些马来语', value: n(c?.some), sub: '其余是零基础' },
        { label: '两周没来', value: n(c?.idle), tone: c?.idle ? 'warn' : undefined, sub: c?.disabled ? `另有 ${c.disabled} 个已停用` : '没有停用的账号' }
      ]} />
      <Panel>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="搜姓名、学校、班级、手机号  /" />
          <Segmented label="活跃" value={active} onChange={setActive} options={[{ value: '', label: '全部', count: c?.total }, { value: '7d', label: '近 7 天在学', count: c?.active7 }, { value: 'idle', label: '两周没来', count: c?.idle, tone: 'warn' }]} />
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <Chips group="起点" value={track} onChange={setTrack} options={[{ value: 'zero', label: '零基础' }, { value: 'some', label: '会说一些' }]} />
            <Chips group="状态" value={status} onChange={setStatus} options={[{ value: 'disabled', label: '已停用', count: c?.disabled }]} />
          </div>
        </Toolbar>
        <ActiveFilters total={data?.total || 0} items={filters} onClear={() => { setQ(''); setActive(''); setStatus(''); setTrack('') }} />
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !data.rows.length ? <Empty>{filters.length ? '没有符合条件的学生' : '还没有学生注册。学生在小程序里填完资料就会出现在这里'}</Empty> : (
          <table className="jb-table">
            <thead><tr>
              <th>学生</th><th className="hidden md:table-cell">起点</th>
              <th title="已学 = 学过至少一次的词;已掌握 = 进了第 6 个盒子">学习</th>
              <th className="r hidden sm:table-cell" title="有学习记录的天数">学习天数</th>
              <th className="r">最近活跃</th><th className="w-8" />
            </tr></thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id} {...rowClick(() => open(r.id))} className={r.status === 'disabled' ? 'opacity-60' : ''}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={r.name} id={r.id} /><div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate font-medium">{r.name || '没填名字'}{r.status === 'disabled' && <Pill tone="bad">已停用</Pill>}</div>
                    <div className="truncate text-xs text-text-4" title={`${r.school} ${r.className}`}>{[r.school, r.className].filter(Boolean).join(' · ') || '没填学校'}</div>
                  </div></div></td>
                  <td className="nw hidden md:table-cell"><Pill tone={r.track === 'some' ? 'blue' : 'off'}>{TRACK[r.track] || '零基础'}</Pill></td>
                  <td className="nw"><div className="num text-[13px]"><b>{n(r.learned)}</b> <span className="text-text-3">· 掌握 {n(r.mastered)}</span></div>
                    <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-ok" style={{ width: `${r.learned ? r.mastered / r.learned * 100 : 0}%` }} /></div></td>
                  <td className="r num hidden sm:table-cell">{r.days ? `${r.days} 天` : <span className="text-text-4">—</span>}</td>
                  <td className="r nw text-text-2" title={full(r.lastActiveAt)}>{ago(r.lastActiveAt)}</td>
                  <td className="text-text-4"><ChevronRight className="size-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Panel>
      <StudentPanel id={openId} onClose={() => open(0)} onSaved={reload} />
    </>
  )
}

function StudentPanel({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth()
  const confirm = useConfirm()
  const { data, error, reload } = useFetch<Detail>(id ? `/students/${id}` : null)
  const [f, setF] = useState<Partial<Row>>({})
  const [busy, setBusy] = useState(false)
  const s = data && data.student.id === id ? data : null
  useEffect(() => { if (s) setF(s.student) }, [s])
  const save = async (extra: Partial<Row> = {}) => {
    setBusy(true)
    try { await api(`/students/${id}`, { method: 'PUT', body: { ...f, ...extra } }); toast.success('已保存'); reload(); onSaved() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const toggle = async () => {
    if (!s) return
    const off = s.student.status !== 'disabled'
    if (off && !await confirm({ title: `停用 ${s.student.name}?`, desc: '停用后他在小程序里打不开学习页面,学习记录保留,随时可以恢复。', ok: '停用', danger: true })) return
    save({ status: off ? 'disabled' : 'active' })
  }
  const maxDay = Math.max(1, ...(s?.days || []).map(d => d.new + d.review))
  return (
    <SidePanel open={!!id} onClose={onClose} width={640}
      head={s && <Avatar name={s.student.name} id={s.student.id} size={40} />}
      title={s ? s.student.name || '没填名字' : '学生'}
      sub={s && <>{[s.student.school, s.student.className].filter(Boolean).join(' · ') || '没填学校'} · {ago(s.student.createdAt)}注册</>}
      footer={s && can('students.edit') && <>
        <Button variant="outline" className={s.student.status === 'disabled' ? '' : 'text-bad hover:text-bad'} onClick={toggle} disabled={busy}>{s.student.status === 'disabled' ? '恢复账号' : '停用账号'}</Button>
        <Button onClick={() => save()} disabled={busy}>保存资料</Button>
      </>}>
      <ErrorLine msg={error} />
      {!s ? <Loading /> : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {s.student.status === 'disabled' ? <Pill tone="bad" dot>已停用</Pill> : <Pill tone="ok" dot>正常</Pill>}
            <Pill tone={s.student.track === 'some' ? 'blue' : 'off'}>{TRACK[s.student.track] || '零基础'}</Pill>
            <Pill>每天新词 {s.student.dailyNew}</Pill>
            {s.checkedToday && <Pill tone="ok">今天已打卡</Pill>}
          </div>
          <MiniStats items={[
            { label: '已学', value: n(s.total.learned) }, { label: '已掌握', value: n(s.total.mastered), tone: 'ok' },
            { label: '连续打卡', value: `${s.streak} 天` }, { label: '待攻克错词', value: n(s.total.wrong), tone: s.total.wrong ? 'bad' : undefined }
          ]} />
          <Tabs defaultValue="study">
            <TabsList className="mb-3"><TabsTrigger value="study">学习</TabsTrigger><TabsTrigger value="wrong">错词 {s.wrong.length || ''}</TabsTrigger><TabsTrigger value="info">资料</TabsTrigger></TabsList>
            <TabsContent value="study">
              <Section title="最近 30 天" extra={<span className="text-xs text-text-4">学习 {s.total.studyDays} 天 · 收藏 {s.total.fav} 个</span>}>
                <div className="flex h-20 items-end gap-[3px] rounded-lg border bg-[#FCFCFD] px-2 pb-1 pt-2">
                  {s.days.map(d => <div key={d.day} title={`${d.day}:新学 ${d.new},复习 ${d.review}`} className="min-w-0 flex-1 rounded-t-[3px]" style={{ height: `${Math.max((d.new + d.review) / maxDay * 100, d.new + d.review ? 4 : 0)}%`, background: d.new + d.review ? '#2563EB' : 'transparent' }} />)}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-text-4"><span>{s.days[0]?.day.slice(5)}</span><span>今天</span></div>
              </Section>
              <Section title="每一站">
                <table className="jb-table rounded-lg border"><tbody>
                  {s.levels.map(l => (
                    <tr key={l.level}><td className="nw"><span className="num mr-2 text-text-4">{l.level}</span>{l.city}{!l.published && <span className="ml-1.5"><Pill>未开放</Pill></span>}</td>
                      <td className="w-[45%]"><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-blue" style={{ width: `${l.total ? l.learned / l.total * 100 : 0}%` }} /></div></td>
                      <td className="r num nw text-xs text-text-3">{l.learned ? <>{n(l.learned)} / {n(l.total)}{l.stamped && <span className="ml-1 text-ok">已盖章</span>}</> : '—'}</td></tr>
                  ))}
                </tbody></table>
              </Section>
              <Section title="记忆盒子" extra={<span className="text-xs text-text-4">0–5 在学,6 已掌握</span>}>
                <div className="grid grid-cols-7 gap-1.5">
                  {s.boxes.map((b, i) => <div key={i} className={`rounded-lg border px-1 py-2 text-center ${i === 6 ? 'border-ok/30 bg-ok-bg' : 'bg-[#FCFCFD]'}`}><div className="text-[11px] text-text-4">盒 {i}</div><div className="num text-sm font-semibold">{n(b)}</div></div>)}
                </div>
              </Section>
            </TabsContent>
            <TabsContent value="wrong">
              {!s.wrong.length ? <Empty>没有错词</Empty> : (
                <table className="jb-table rounded-lg border"><thead><tr><th>词</th><th>释义</th><th className="r">错几次</th></tr></thead><tbody>
                  {s.wrong.map(w => <tr key={w.rank}><td className="nw"><span className="font-mono font-semibold">{w.ms}</span> <span className="num text-xs text-text-4">#{w.rank}</span></td><td className="text-text-2"><span className="line-clamp-1" title={w.zh}>{w.zh}</span></td><td className="r num nw"><span className="text-bad">{w.wrong}</span>{w.box === 6 && <span className="ml-1 text-xs text-ok">已掌握</span>}</td></tr>)}
                </tbody></table>
              )}
            </TabsContent>
            <TabsContent value="info">
              <fieldset disabled={!can('students.edit')} className="grid gap-3 sm:grid-cols-2">
                <Field label="姓名"><Input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
                <Field label="手机号"><Input value={f.phone || ''} onChange={e => setF({ ...f, phone: e.target.value })} className="font-mono" /></Field>
                <Field label="学校"><Input value={f.school || ''} onChange={e => setF({ ...f, school: e.target.value })} /></Field>
                <Field label="班级"><Input value={f.className || ''} onChange={e => setF({ ...f, className: e.target.value })} /></Field>
                <Field label="起点"><Segmented label="起点" value={(f.track || 'zero') as string} onChange={v => setF({ ...f, track: v })} options={[{ value: 'zero', label: '零基础' }, { value: 'some', label: '会说一些' }]} /></Field>
                <Field label="每天新词"><Segmented label="每天新词" value={String(f.dailyNew || 20)} onChange={v => setF({ ...f, dailyNew: Number(v) })} options={['10', '20', '30', '50'].map(v => ({ value: v, label: v }))} /></Field>
                <Field label="老师备注" className="sm:col-span-2" hint="学生看不到"><Textarea rows={3} value={f.note || ''} onChange={e => setF({ ...f, note: e.target.value })} placeholder="例如:插班生,先从第 2 站开始" /></Field>
              </fieldset>
              <div className="mt-3 text-xs text-text-4" title={full(s.student.createdAt)}>注册于 {full(s.student.createdAt)} · 最近活跃 {ago(s.student.lastActiveAt)}</div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </SidePanel>
  )
}
