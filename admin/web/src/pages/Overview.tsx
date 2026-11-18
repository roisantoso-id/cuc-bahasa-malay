import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useFetch } from '@/lib/use-fetch'
import { useAuth } from '@/lib/auth'
import { ago, full, n } from '@/lib/format'
import { Avatar, Empty, ErrorLine, Kpis, Loading, PageHeader, Panel, PanelHead, Pill, Segmented, rowClick } from '@/components/app/ui'
import { actionLabel } from './Audit'

type Day = { day: string; active: number; learned: number; reviewed: number; signups: number }
type Ov = {
  students: number; newStudents7: number; activeToday: number; active7: number; learnedToday: number; reviewedToday: number; check: number
  trend: Day[]; words: { level: number; status: string; n: number }[]; courses: { level: number; city: string; ms: string; published: number }[]
  recent?: { id: number; at: string; username: string; action: string; target: string }[]
  topStudents?: { id: number; name: string; school: string; learned: number; reviewed: number }[]
}

// 14 天柱状图:新学(深蓝)+ 复习(浅蓝)叠起来;或者每天在学人数
function Trend({ days, mode }: { days: Day[]; mode: 'words' | 'people' }) {
  const [hover, setHover] = useState<number | null>(null)
  const val = (d: Day) => mode === 'words' ? d.learned + d.reviewed : d.active
  const max = Math.max(1, ...days.map(val))
  const H = 160
  const h = hover != null ? days[hover] : null
  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mb-2 h-5 text-xs text-text-3">
        {h ? <span className="num"><b className="text-foreground">{h.day.slice(5)}</b>{mode === 'words' ? <> · 新学 {n(h.learned)} · 复习 {n(h.reviewed)}</> : <> · 在学 {n(h.active)} 人 · 新注册 {n(h.signups)} 人</>}</span>
          : <span>把鼠标放到柱子上看当天数字</span>}
      </div>
      <div className="flex items-end gap-[6px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => {
          const total = val(d)
          const th = Math.round((total / max) * (H - 4))
          const lh = mode === 'words' && total ? Math.round(th * d.learned / total) : th
          return (
            <div key={d.day} className="flex h-full min-w-0 flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)} title={`${d.day}:${mode === 'words' ? `新学 ${d.learned},复习 ${d.reviewed}` : `在学 ${d.active} 人`}`}>
              <div className={`rounded-t-[4px] ${hover === i ? 'opacity-100' : 'opacity-90'}`} style={{ height: Math.max(th - lh, 0), background: '#BFD3FE' }} />
              <div className={`${th - lh > 0 ? '' : 'rounded-t-[4px]'}`} style={{ height: Math.max(lh, total ? 2 : 0), background: hover === i ? '#1D4ED8' : '#2563EB' }} />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-[6px] text-[11px] text-text-4">
        {days.map((d, i) => <div key={d.day} className="num min-w-0 flex-1 text-center">{i % 2 === 1 || days.length < 8 ? d.day.slice(8) : ''}</div>)}
      </div>
      {mode === 'words' && <div className="mt-2 flex gap-4 text-xs text-text-3"><span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-blue" />新学</span><span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: '#BFD3FE' }} />复习</span></div>}
    </div>
  )
}

export function Overview() {
  const { data, error, loading } = useFetch<Ov>('/overview')
  const { can } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'words' | 'people'>('words')
  if (!data) return <>{loading && <Loading />}<ErrorLine msg={error} /></>
  const by = (lv: number, st: string) => data.words.find(w => w.level === lv && w.status === st)?.n || 0
  const approved = data.words.filter(w => w.status === 'approved').reduce((a, w) => a + w.n, 0)
  const total = data.words.reduce((a, w) => a + w.n, 0)
  return (
    <>
      <PageHeader title="概览" desc={`词库 ${n(total)} 个词,已上架 ${n(approved)} 个;日期按北京时间`} />
      <Kpis items={[
        { label: '学生', value: n(data.students), sub: `近 7 天新注册 ${n(data.newStudents7)} 人` },
        { label: '今天在学', value: `${n(data.activeToday)} 人`, sub: `近 7 天学过的 ${n(data.active7)} 人` },
        { label: '今天学了多少词', value: n(data.learnedToday + data.reviewedToday), sub: `新学 ${n(data.learnedToday)} · 复习 ${n(data.reviewedToday)}` },
        { label: '待复核释义', value: can('words.view') && data.check ? <Link to="/words?status=check" className="inline-flex min-h-9 min-w-9 items-center hover:underline">{n(data.check)}</Link> : n(data.check), tone: data.check ? 'bad' : undefined, sub: data.check ? 'AI 生成的释义,老师审过才给学生看' : '都审过了' }
      ]} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead title="最近 14 天" extra={<Segmented label="看什么" value={mode} onChange={setMode} options={[{ value: 'words', label: '学了多少词' }, { value: 'people', label: '在学人数' }]} />} />
          <Trend days={data.trend} mode={mode} />
        </Panel>
        <Panel>
          <PanelHead title="近 7 天学得最多" extra={can('students.view') && <Link to="/students" className="jb-head-link text-xs text-blue hover:underline">全部学生</Link>} />
          {!data.topStudents ? <Empty>没有查看学生的权限</Empty> : !data.topStudents.length ? <Empty>这 7 天还没人学</Empty> : (
            <table className="jb-table"><tbody>
              {data.topStudents.map(s => (
                <tr key={s.id} {...rowClick(() => nav(`/students?id=${s.id}`))}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={s.name} id={s.id} size={28} /><div className="min-w-0"><div className="truncate font-medium">{s.name || '—'}</div><div className="truncate text-xs text-text-4">{s.school || '没填学校'}</div></div></div></td>
                  <td className="r nw"><div className="num font-semibold">{n(s.learned)}</div><div className="num text-xs text-text-4">复习 {n(s.reviewed)}</div></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead title="课程上架进度" sub="每站 500 词;上架的词学生才能学" extra={can('courses.view') && <Link to="/courses" className="jb-head-link text-xs text-blue hover:underline">管理课程</Link>} />
          <table className="jb-table">
            <thead><tr><th>站</th><th className="hidden sm:table-cell">上架进度</th><th className="r">已上架</th><th className="r">待补</th></tr></thead>
            <tbody>
              {data.courses.map(c => {
                const a = by(c.level, 'approved'), p = by(c.level, 'pending'), pct = a + p ? a / (a + p) : 0
                return (
                  <tr key={c.level} {...(can('words.view') ? rowClick(() => nav(`/words?level=${c.level}`)) : {})}>
                    <td><div className="flex items-center gap-2"><span className="num inline-flex size-6 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-text-2">{c.level}</span><div className="min-w-0"><div className="truncate font-medium">{c.city}{!c.published && <span className="ml-1.5"><Pill>未开放</Pill></span>}</div><div className="truncate text-xs text-text-4">{c.ms}</div></div></div></td>
                    <td className="hidden w-[38%] sm:table-cell"><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--ok)' : pct >= .5 ? 'var(--blue)' : '#D97706' }} /></div></td>
                    <td className="r num nw font-medium">{n(a)}</td>
                    <td className={`r num nw ${p ? 'text-warn' : 'text-text-4'}`}>{p ? n(p) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
        <Panel>
          <PanelHead title="最近操作" extra={can('audit.view') && <Link to="/audit" className="jb-head-link text-xs text-blue hover:underline">操作日志</Link>} />
          {!data.recent ? <Empty>没有查看日志的权限</Empty> : !data.recent.length ? <Empty>还没有操作</Empty> : (
            <ul className="divide-y divide-row-line">
              {data.recent.map(r => (
                <li key={r.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <Avatar name={r.username} id={r.username} size={24} />
                  <div className="min-w-0 flex-1 text-[13px]"><span className="font-medium">{r.username}</span> <span className="text-text-3">{actionLabel(r.action)}</span> {!(r.action.startsWith('login') && r.target === r.username) && <span className="text-text-2" title={r.target}>{r.target}</span>}</div>
                  <span className="nw text-xs text-text-4" title={full(r.at)}>{ago(r.at)}</span>
                  <ChevronRight className="hidden size-3.5 text-text-4" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
