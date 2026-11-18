import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFetch } from '@/lib/use-fetch'
import { ago, full, n } from '@/lib/format'
import { Empty, ErrorLine, Field, Kpis, Loading, MiniStats, PageHeader, Panel, Pill, Section, SidePanel, rowClick, useConfirm } from '@/components/app/ui'

type Course = { level: number; city: string; ms: string; note: string; intro: string; published: boolean; updatedAt: string; approved: number; pending: number; learners: number }

export function Courses() {
  const { can } = useAuth()
  const confirm = useConfirm()
  const [sp, setSp] = useSearchParams()
  const { data, error, loading, reload } = useFetch<Course[]>('/courses')
  const openLv = Number(sp.get('level')) || 0
  const toggle = async (c: Course) => {
    if (c.published && !await confirm({ title: `关闭「${c.city}」?`, desc: '关闭后小程序里不显示这一站,也不再发这一站的新词;学生已经学过的词照常复习。', ok: '关闭', danger: true })) return
    try { await api(`/courses/${c.level}`, { method: 'PUT', body: { published: !c.published } }); toast.success(c.published ? '已关闭' : '已开放'); reload() } catch (e) { toast.error((e as Error).message) }
  }
  const rows = data || []
  const ready = rows.filter(c => c.pending === 0 && c.approved > 0).length
  return (
    <>
      <PageHeader crumb="教学" title="课程" desc="学习路线是马来西亚 10 站旅程,每站约 500 词;学完一站盖一个章" />
      <Kpis items={[
        { label: '开放中', value: `${rows.filter(c => c.published).length} / ${rows.length} 站` },
        { label: '词全部上架', value: `${ready} 站`, tone: 'ok' },
        { label: '已上架的词', value: n(rows.reduce((a, c) => a + c.approved, 0)) },
        { label: '待补的词', value: n(rows.reduce((a, c) => a + c.pending, 0)), tone: rows.some(c => c.pending) ? 'warn' : undefined, sub: '只有音频、还没释义,或释义待复核' }
      ]} />
      <Panel>
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !rows.length ? <Empty /> : (
          <table className="jb-table">
            <thead><tr><th>站</th><th className="hidden md:table-cell">一句话</th><th>词</th><th className="r hidden sm:table-cell">学过的学生</th><th className="hidden sm:table-cell">开放</th><th className="w-8" /></tr></thead>
            <tbody>
              {rows.map(c => {
                const t = c.approved + c.pending
                return (
                  <tr key={c.level} {...rowClick(() => setSp({ level: String(c.level) }))} className={c.published ? '' : 'opacity-70'}>
                    <td><div className="flex items-center gap-2.5"><span className="num inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-text-2">{c.level}</span><div className="min-w-0"><div className="truncate font-medium">{c.city}{!c.published && <span className="ml-1.5 sm:hidden"><Pill>未开放</Pill></span>}</div><div className="truncate font-mono text-xs text-text-4">{c.ms}</div></div></div></td>
                    <td className="hidden text-text-2 md:table-cell"><span className="line-clamp-1" title={c.note}>{c.note || <span className="text-text-4">—</span>}</span></td>
                    <td><div className="num text-[13px]"><b>{n(c.approved)}</b><span className="text-text-3"> / {n(t)} 上架</span>{c.pending > 0 && <span className="text-warn"> · 待补 {n(c.pending)}</span>}</div>
                      <div className="mt-1 h-1 w-full max-w-32 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${t ? c.approved / t * 100 : 0}%`, background: c.pending ? '#D97706' : 'var(--ok)' }} /></div></td>
                    <td className="r num hidden sm:table-cell">{c.learners ? `${n(c.learners)} 人` : <span className="text-text-4">—</span>}</td>
                    <td data-stop className="hidden sm:table-cell">{can('courses.edit') ? <Switch checked={c.published} onCheckedChange={() => toggle(c)} aria-label={`开放 ${c.city}`} /> : c.published ? <Pill tone="ok" dot>开放</Pill> : <Pill dot>未开放</Pill>}</td>
                    <td className="text-text-4"><ChevronRight className="size-4" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
      <CoursePanel course={rows.find(c => c.level === openLv) || null} onClose={() => setSp({})} onSaved={reload} />
    </>
  )
}

function CoursePanel({ course, onClose, onSaved }: { course: Course | null; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth()
  const [f, setF] = useState<Partial<Course>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (course) setF(course) }, [course])
  const save = async () => {
    setBusy(true)
    try { await api(`/courses/${course!.level}`, { method: 'PUT', body: f }); toast.success('已保存'); onSaved() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <SidePanel open={!!course} onClose={onClose} width={560}
      head={course && <span className="num inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-semibold">{course.level}</span>}
      title={course ? `第 ${course.level} 站 · ${course.city}` : ''} sub={course && <span title={full(course.updatedAt)}>{course.ms} · {ago(course.updatedAt)}改过</span>}
      footer={course && can('courses.edit') && <Button onClick={save} disabled={busy}>保存</Button>}>
      {course && (
        <>
          <MiniStats items={[{ label: '已上架', value: n(course.approved), tone: 'ok' }, { label: '待补', value: n(course.pending), tone: course.pending ? 'warn' : undefined }, { label: '学过的学生', value: n(course.learners) }, { label: '状态', value: course.published ? '开放' : '未开放' }]} />
          <div className="mb-4 text-[13px]"><Link to={`/words?level=${course.level}`} className="inline-flex min-h-9 items-center text-blue hover:underline">看这一站的 {n(course.approved + course.pending)} 个词 →</Link></div>
          <fieldset disabled={!can('courses.edit')}>
            <Section title="小程序里显示的内容">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="站名(中文)"><Input value={f.city || ''} onChange={e => setF({ ...f, city: e.target.value })} /></Field>
                <Field label="马来语名"><Input value={f.ms || ''} onChange={e => setF({ ...f, ms: e.target.value })} className="font-mono" /></Field>
                <Field label="一句话" className="sm:col-span-2" hint="地图上站名下面那一行"><Input value={f.note || ''} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
                <Field label="介绍" className="sm:col-span-2" hint="这一站学什么、这座城市有什么,可空"><Textarea rows={4} value={f.intro || ''} onChange={e => setF({ ...f, intro: e.target.value })} /></Field>
              </div>
            </Section>
            <Section title="开放">
              <label className="flex items-start gap-3 rounded-xl border bg-[#FCFCFD] p-3 text-[13px]">
                <Switch checked={!!f.published} onCheckedChange={v => setF({ ...f, published: v })} />
                <span><b className="font-medium">{f.published ? '开放中' : '未开放'}</b><span className="block text-xs text-text-3">关闭后小程序里不显示这一站,也不再发这一站的新词;已经学过的照常复习</span></span>
              </label>
            </Section>
          </fieldset>
        </>
      )}
    </SidePanel>
  )
}
