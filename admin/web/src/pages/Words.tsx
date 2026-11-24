import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Download, FileUp, Loader2, Plus, RotateCcw, Sparkles, Trash2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api, qs } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useDebounced, useFetch } from '@/lib/use-fetch'
import { ago, full, n } from '@/lib/format'
import { ActiveFilters, Chips, Dot, Empty, ErrorLine, Field, Loading, MiniStats, PageHeader, Pager, Panel, Pill, SearchBox, Section, Segmented, SidePanel, Toolbar, rowClick, useConfirm } from '@/components/app/ui'
import { actionLabel } from './Audit'

type Sense = { pos: string; zh: string; en?: string; exMs?: string; exZh?: string; check?: boolean }
type Extra = { ex?: { ms: string; zh: string }[]; col?: string[]; fam?: string[]; syn?: string[]; ant?: string[]; tip?: string; note?: string; image?: string; audioOrig?: string; audioBy?: string }
type Word = { rank: number; ms: string; root: string; level: number; topic: string; senses: Sense[]; audio: string; audioUrl: string; status: string; edited: boolean; updatedAt: string; extra: Extra }
type List = { total: number; page: number; size: number; counts: { total: number; approved: number | null; pending: number | null; check: number | null; edited: number | null }; topics: { topic: string; n: number }[]; words: Word[] }
type Course = { level: number; city: string; ms: string }
type WordDetail = Word & { learners: { n: number; mastered: number; wrong: number }; history: { at: string; username: string; action: string; detail: string }[] }

// 词库里出现最多的词性(content/vocab5000/words.json),其它的选「其它…」自己写
const POS = ['名词', '动词', '形容词', '副词', '专有名词', '被动动词', '介词', '连词', '代词', '数词', '助动词', '及物动词', '量词', '感叹词', '否定词', '疑问词', '助词', '短语']
let audioEl: HTMLAudioElement | null = null
const play = (url: string) => { if (!url) return; audioEl?.pause(); audioEl = new Audio(url); audioEl.play().catch(() => toast.error('音频放不出来:文件可能还没传到 COS')) }
const VOICES = [{ value: 'yasmin', label: 'Yasmin 女声' }, { value: 'nadira', label: 'Nadira 女声' }, { value: 'osman', label: 'Osman 男声' }] as const
type Voice = typeof VOICES[number]['value']
type Take = { audio: string; audioUrl: string; voice: Voice; voiceName: string; rate: 'slow' | 'normal' }
const isAi = (a: string) => a.startsWith('/uploads/tts/')

export function Words() {
  const { can } = useAuth()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('')
  const level = sp.get('level') || ''
  const status = sp.get('status') || ''
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const dq = useDebounced(q)
  useEffect(() => { setPage(1); setSel(new Set()) }, [dq, status, topic, level])
  const { data, error, loading, reload } = useFetch<List>('/words' + qs({ q: dq, status, topic, level, page, size: 50 }))
  const { data: courses } = useFetch<Course[]>(can('courses.view') ? '/courses' : null)
  const openRank = sp.get('rank')
  const setParam = (k: string, v: string) => { const p = new URLSearchParams(sp); if (v) p.set(k, v); else p.delete(k); setSp(p) }
  const setStatus = (v: string) => setParam('status', v)
  const c = data?.counts
  const city = (lv: number) => courses?.find(x => x.level === lv)?.city || `第 ${lv} 站`
  const filters = [
    ...(dq ? [{ label: `搜索「${dq}」`, clear: () => setQ('') }] : []),
    ...(level ? [{ label: city(Number(level)), clear: () => setParam('level', '') }] : []),
    ...(status ? [{ label: { approved: '已上架', pending: '待补 / 下架', check: '待复核', edited: '后台改过' }[status] || status, clear: () => setStatus('') }] : []),
    ...(topic ? [{ label: `主题 ${topic}`, clear: () => setTopic('') }] : [])
  ]
  const batch = async (st: 'approved' | 'pending') => {
    try {
      const r = await api<{ ok: number; skipped: number }>('/words/batch', { body: { ranks: [...sel], status: st } })
      toast.success(`${st === 'approved' ? '上架' : '下架'}了 ${r.ok} 个${r.skipped ? `,${r.skipped} 个没有审过的释义,没上架` : ''}`)
      setSel(new Set()); reload()
    } catch (e) { toast.error((e as Error).message) }
  }
  const all = data?.words.length ? data.words.every(w => sel.has(w.rank)) : false
  return (
    <>
      <PageHeader crumb="教学" title="单词" desc="上架的词学生才能学;AI 生成的释义标「待复核」,老师审过去掉勾,学生才看得到"
        actions={<>
          {can('words.view') && <Button variant="outline" asChild><a href="/api/admin/words/export.json" title="词光(Word Atlas)格式,只含已上架的词"><Download />导出</a></Button>}
          {can('words.import') && <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp />导入</Button>}
          {can('words.edit') && <Button onClick={() => setParam('rank', 'new')}><Plus />新增单词</Button>}
        </>} />
      <Panel>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="搜马来语、词根、中文释义或序号  /" />
          <Segmented label="状态" value={status} onChange={setStatus} options={[
            { value: '', label: '全部', count: c?.total }, { value: 'approved', label: '已上架', count: c?.approved },
            { value: 'pending', label: '待补', count: c?.pending, tone: 'warn' }, { value: 'check', label: '待复核', count: c?.check, tone: 'bad' }, { value: 'edited', label: '改过', count: c?.edited }
          ]} />
          <div className="sm:ml-auto">
            <Select value={level || 'all'} onValueChange={v => setParam('level', v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-[180px] bg-white text-[13px]" aria-label="按站筛选"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 10 站</SelectItem>
                {(courses || Array.from({ length: 10 }, (_, i) => ({ level: i + 1, city: `第 ${i + 1} 站`, ms: '' }))).map(c => <SelectItem key={c.level} value={String(c.level)}>{c.level} · {c.city}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Toolbar>
        {!!data?.topics.length && <div className="border-b px-4 py-2"><Chips group="主题" value={topic} onChange={v => setTopic(v === topic ? '' : v)} options={data.topics.slice(0, 12).map(t => ({ value: t.topic, label: t.topic, count: t.n }))} /></div>}
        <ActiveFilters total={data?.total || 0} items={filters} onClear={() => { setQ(''); setTopic(''); setSp({}) }} />
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-blue-bg px-4 py-2 text-[13px]">
            <span className="text-blue">已选 <b className="num">{sel.size}</b> 个</span>
            <Button size="sm" onClick={() => batch('approved')}>上架</Button>
            <Button size="sm" variant="outline" onClick={() => batch('pending')}>下架</Button>
            <button type="button" className="ml-1 text-xs text-text-3 hover:text-foreground" onClick={() => setSel(new Set())}>取消选择</button>
          </div>
        )}
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !data.words.length ? <Empty>没有符合条件的词</Empty> : (
          <table className="jb-table">
            <thead><tr>
              {can('words.publish') && <th className="hidden w-10 sm:table-cell"><Checkbox aria-label="全选这一页" checked={all} onCheckedChange={v => setSel(v ? new Set(data.words.map(w => w.rank)) : new Set())} /></th>}
              <th>单词</th><th>释义</th><th className="hidden lg:table-cell">站</th><th className="hidden sm:table-cell">状态</th><th className="w-10" /><th className="w-8" />
            </tr></thead>
            <tbody>
              {data.words.map(w => {
                const checks = w.senses.filter(s => s.check).length
                return (
                  <tr key={w.rank} {...rowClick(() => setParam('rank', String(w.rank)))}>
                    {can('words.publish') && <td data-stop className="hidden sm:table-cell"><Checkbox aria-label={`选择 ${w.ms}`} checked={sel.has(w.rank)} onCheckedChange={v => { const s = new Set(sel); if (v) s.add(w.rank); else s.delete(w.rank); setSel(s) }} /></td>}
                    <td className="nw"><div className="flex items-center gap-1.5 font-mono text-[13px] font-semibold"><span className="sm:hidden" title={w.status === 'approved' ? '已上架' : '待补'}><Dot tone={w.status === 'approved' ? 'ok' : checks ? 'warn' : 'off'} /></span>{w.ms}</div><div className="num text-xs text-text-4">#{w.rank}{w.root && w.root !== w.ms ? ` · 词根 ${w.root}` : ''}</div></td>
                    <td><div className="line-clamp-2 text-text-2" title={w.senses.map(s => `${s.pos} ${s.zh}`).join('\n')}>{w.senses.length ? w.senses.map((s, i) => <span key={i} className={s.check ? 'text-text-4' : ''}>{i > 0 && ';'}<span className="text-xs text-text-4">{s.pos} </span>{s.zh}</span>) : <span className="text-text-4">还没有释义</span>}</div></td>
                    <td className="nw hidden text-text-3 lg:table-cell">{city(w.level)}</td>
                    <td className="nw hidden sm:table-cell"><div className="flex flex-wrap gap-1">
                      {w.status === 'approved' ? <Pill tone="ok" dot>已上架</Pill> : <Pill tone="off" dot>待补</Pill>}
                      {checks > 0 && <Pill tone="warn">待复核 {checks}</Pill>}
                      {w.edited && <Pill tone="blue" title={`后台改过 · ${full(w.updatedAt)}`}>改过</Pill>}
                    </div></td>
                    <td>{w.audioUrl && <button type="button" aria-label={`播放 ${w.ms}`} onClick={() => play(w.audioUrl)} className="flex size-9 items-center justify-center rounded-md text-text-3 hover:bg-blue-bg hover:text-blue"><Volume2 className="size-4" /></button>}</td>
                    <td className="text-text-4"><ChevronRight className="size-4" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Panel>
      <WordPanel rank={openRank} courses={courses || []} onClose={() => setParam('rank', '')} onSaved={reload} onCreated={r => setParam('rank', String(r))} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} />
    </>
  )
}

const empty: Word = { rank: 0, ms: '', root: '', level: 1, topic: '', senses: [{ pos: '名词', zh: '' }], audio: '', audioUrl: '', status: 'pending', edited: false, updatedAt: '', extra: {} }
const listText = (a?: string[]) => (a || []).join(', ')
const textList = (s: string) => s.split(/[,，;；\n]/).map(x => x.trim()).filter(Boolean)

function WordPanel({ rank, courses, onClose, onSaved, onCreated }: { rank: string | null; courses: Course[]; onClose: () => void; onSaved: () => void; onCreated: (r: number) => void }) {
  const { can } = useAuth()
  const confirm = useConfirm()
  const isNew = rank === 'new'
  const { data, error, reload } = useFetch<WordDetail>(rank && !isNew ? `/words/${rank}` : null)
  const [w, setW] = useState<Word>(empty)
  const [lists, setLists] = useState({ col: '', fam: '', syn: '', ant: '' })
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const d = data && String(data.rank) === rank ? data : null
  useEffect(() => {
    const src = isNew ? empty : d
    if (src) { setW(src); setLists({ col: listText(src.extra.col), fam: listText(src.extra.fam), syn: listText(src.extra.syn), ant: listText(src.extra.ant) }); setDirty(false) }
  }, [d, isNew])
  const edit = can('words.edit')
  const up = (p: Partial<Word>) => { setW({ ...w, ...p }); setDirty(true) }
  const upSense = (i: number, p: Partial<Sense>) => up({ senses: w.senses.map((s, j) => j === i ? { ...s, ...p } : s) })
  const upExtra = (p: Partial<Extra>) => up({ extra: { ...w.extra, ...p } })
  const close = async () => { if (dirty && !await confirm({ title: '有没保存的修改', desc: '关掉会丢掉这些修改。', ok: '不保存,关掉', danger: true })) return; onClose() }
  const save = async (status?: string) => {
    if (!w.ms.trim()) return toast.error('马来语不能为空')
    setBusy(true)
    const payload = { ...w, status: status ?? w.status, extra: { ...w.extra, col: textList(lists.col), fam: textList(lists.fam), syn: textList(lists.syn), ant: textList(lists.ant) } }
    try {
      if (isNew) { const r = await api<{ rank: number }>('/words', { body: payload }); toast.success(`已新增 #${r.rank},先放在「待补」`); setDirty(false); onSaved(); onCreated(r.rank) }
      else { await api(`/words/${w.rank}`, { method: 'PUT', body: edit ? payload : { status } }); toast.success(status === 'approved' ? '已上架' : status === 'pending' ? '已下架' : '已保存'); setDirty(false); reload(); onSaved() }
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const ok = w.senses.some(s => s.zh && !s.check)
  const course = courses.find(c => c.level === w.level)
  return (
    <SidePanel open={!!rank} onClose={close} width={720}
      title={isNew ? '新增单词' : d ? <span className="font-mono">{d.ms}</span> : '单词'}
      sub={!isNew && d && <>#{d.rank} · 第 {d.level} 站 {course?.city || ''} · {d.edited ? `${ago(d.updatedAt)}在后台改过` : '没在后台改过'}</>}
      footer={(isNew || d) && <>
        {!isNew && can('words.publish') && (w.status === 'approved'
          ? <Button variant="outline" onClick={() => save('pending')} disabled={busy}>下架</Button>
          : <Button variant="outline" onClick={() => save('approved')} disabled={busy || !ok} title={ok ? '' : '至少要有一条审过(没勾「待复核」)的释义'}>{dirty ? '保存并上架' : '上架'}</Button>)}
        {edit && <Button onClick={() => save()} disabled={busy || (!dirty && !isNew)}>{isNew ? '新增' : '保存'}</Button>}
      </>}>
      <ErrorLine msg={error} />
      {!isNew && !d ? <Loading /> : (
        <fieldset disabled={!edit} className="min-w-0">
          {!isNew && d && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {d.status === 'approved' ? <Pill tone="ok" dot>已上架</Pill> : <Pill dot>待补 / 下架</Pill>}
                {d.audioUrl ? <button type="button" onClick={() => play(d.audioUrl)} className="inline-flex h-[22px] items-center gap-1 rounded-full bg-blue-bg px-2 text-xs text-blue max-sm:h-9 max-sm:px-3"><Volume2 className="size-3" />听发音</button> : <Pill tone="warn">没有音频</Pill>}
              </div>
              <MiniStats items={[{ label: '学过的学生', value: n(d.learners.n) }, { label: '已掌握', value: n(d.learners.mastered), tone: 'ok' }, { label: '被答错', value: `${n(d.learners.wrong)} 次`, tone: d.learners.wrong ? 'bad' : undefined }, { label: '义项', value: d.senses.length }]} />
            </>
          )}
          <Section title="词条">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="马来语"><Input value={w.ms} onChange={e => up({ ms: e.target.value })} className="font-mono font-semibold" placeholder="makan" /></Field>
              <Field label="词根"><Input value={w.root} onChange={e => up({ root: e.target.value })} className="font-mono" placeholder="没有就空着" /></Field>
              <Field label="所在站">
                <Select value={String(w.level)} onValueChange={v => up({ level: Number(v) })} disabled={!edit}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{(courses.length ? courses : Array.from({ length: 10 }, (_, i) => ({ level: i + 1, city: '', ms: '' }))).map(c => <SelectItem key={c.level} value={String(c.level)}>{c.level} · {c.city}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="主题" hint="词光按主题分组,例如 food、family"><Input value={w.topic} onChange={e => up({ topic: e.target.value })} placeholder="没有就空着" /></Field>
            </div>
          </Section>
          {!isNew && <AudioSection w={w} edit={edit} up={up} />}
          <Section title={`义项 ${w.senses.length}`} extra={edit && <Button type="button" size="sm" variant="outline" onClick={() => up({ senses: [...w.senses, { pos: '名词', zh: '' }] })}><Plus />加一条</Button>}>
            <div className="grid gap-2">
              {w.senses.map((s, i) => (
                <div key={i} className={`rounded-xl border p-3 ${s.check ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'bg-[#FCFCFD]'}`}>
                  <div className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]">
                    <Select value={POS.includes(s.pos) ? s.pos : '__other'} onValueChange={v => upSense(i, { pos: v === '__other' ? '' : v })} disabled={!edit}>
                      <SelectTrigger className="bg-white" aria-label="词性"><SelectValue placeholder="词性" /></SelectTrigger>
                      <SelectContent>{POS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}<SelectItem value="__other">其它…</SelectItem></SelectContent>
                    </Select>
                    <Input value={s.zh} onChange={e => upSense(i, { zh: e.target.value })} placeholder="中文释义" aria-label="中文释义" />
                    <Input value={s.en || ''} onChange={e => upSense(i, { en: e.target.value })} placeholder="英文释义(词光用,可空)" aria-label="英文释义" />
                    {!POS.includes(s.pos) && <Input value={s.pos} onChange={e => upSense(i, { pos: e.target.value })} placeholder="写词性" className="sm:col-span-3" />}
                    <Input value={s.exMs || ''} onChange={e => upSense(i, { exMs: e.target.value })} placeholder="马来语例句" aria-label="例句" className="sm:col-span-3" />
                    <Input value={s.exZh || ''} onChange={e => upSense(i, { exZh: e.target.value })} placeholder="例句翻译" aria-label="例句翻译" className="sm:col-span-3" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-text-2"><Switch checked={!!s.check} onCheckedChange={v => upSense(i, { check: v })} disabled={!edit} />{s.check ? <span className="text-warn">待复核:学生看不到这条</span> : '已审过,学生能看到'}</label>
                    {edit && w.senses.length > 1 && <button type="button" onClick={() => up({ senses: w.senses.filter((_, j) => j !== i) })} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-text-3 hover:bg-bad-bg hover:text-bad max-sm:h-9"><Trash2 className="size-3.5" />删掉</button>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="更多例句" extra={edit && <Button type="button" size="sm" variant="outline" onClick={() => upExtra({ ex: [...(w.extra.ex || []), { ms: '', zh: '' }] })}><Plus />加例句</Button>}>
            {!(w.extra.ex || []).length ? <div className="text-xs text-text-4">没有。义项里的例句已经够用时可以不加</div> : (
              <div className="grid gap-2">
                {(w.extra.ex || []).map((x, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px]">
                    <Input value={x.ms} onChange={e => upExtra({ ex: w.extra.ex!.map((y, j) => j === i ? { ...y, ms: e.target.value } : y) })} placeholder="马来语" />
                    <Input value={x.zh} onChange={e => upExtra({ ex: w.extra.ex!.map((y, j) => j === i ? { ...y, zh: e.target.value } : y) })} placeholder="中文" />
                    {edit && <button type="button" aria-label="删掉这句" onClick={() => upExtra({ ex: w.extra.ex!.filter((_, j) => j !== i) })} className="flex h-9 items-center justify-center rounded-md text-text-4 hover:bg-bad-bg hover:text-bad"><Trash2 className="size-4" /></button>}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title="词光扩展">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="常见搭配" hint="用逗号隔开"><Input value={lists.col} onChange={e => { setLists({ ...lists, col: e.target.value }); setDirty(true) }} placeholder="makan nasi, makan angin" /></Field>
              <Field label="同族词"><Input value={lists.fam} onChange={e => { setLists({ ...lists, fam: e.target.value }); setDirty(true) }} placeholder="makanan, pemakan" /></Field>
              <Field label="同义词"><Input value={lists.syn} onChange={e => { setLists({ ...lists, syn: e.target.value }); setDirty(true) }} /></Field>
              <Field label="反义词"><Input value={lists.ant} onChange={e => { setLists({ ...lists, ant: e.target.value }); setDirty(true) }} /></Field>
              <Field label="记忆提示" className="sm:col-span-2"><Textarea rows={2} value={w.extra.tip || ''} onChange={e => upExtra({ tip: e.target.value })} placeholder="例如:makan 加 -an 变成名词 makanan(食物)" /></Field>
              <Field label="用法提醒" hint="语体、敏感、易错拼写"><Input value={w.extra.note || ''} onChange={e => upExtra({ note: e.target.value })} /></Field>
              <Field label="配图地址" hint="COS 上的图片地址"><Input value={w.extra.image || ''} onChange={e => upExtra({ image: e.target.value })} className="font-mono text-xs" placeholder="https://…" /></Field>
            </div>
            {w.extra.image && <img src={w.extra.image} alt="" className="mt-3 max-h-40 rounded-lg border object-contain" onError={e => (e.currentTarget.style.display = 'none')} />}
          </Section>
          {!isNew && d && d.history.length > 0 && (
            <Section title="修改记录">
              <ul className="divide-y divide-row-line rounded-lg border text-[13px]">
                {d.history.map((h, i) => <li key={i} className="flex justify-between gap-2 px-3 py-2"><span><b className="font-medium">{h.username}</b> <span className="text-text-3">{actionLabel(h.action)}</span></span><span className="nw text-xs text-text-4" title={full(h.at)}>{ago(h.at)}</span></li>)}
              </ul>
            </Section>
          )}
        </fieldset>
      )}
    </SidePanel>
  )
}

type Dry = { total: number; valid: number; invalid: number; update: number; create: number; keepEdited: number }
function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [words, setWords] = useState<unknown[] | null>(null)
  const [name, setName] = useState('')
  const [dry, setDry] = useState<Dry | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!open) { setWords(null); setName(''); setDry(null); setErr(''); setOverwrite(false) } }, [open])
  const check = async (list: unknown[], ow = overwrite) => {
    setBusy(true); setErr('')
    try { setDry(await api<Dry>('/words/import', { body: { words: list, dryRun: true, overwriteEdited: ow } })) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const pick = async (f?: File) => {
    if (!f) return
    setName(f.name)
    try {
      const j = JSON.parse(await f.text())
      const list = Array.isArray(j) ? j : j.words
      if (!Array.isArray(list)) throw new Error('文件里没有单词数组')
      setWords(list); check(list)
    } catch (e) { setErr('读不了这个文件:' + (e as Error).message); setWords(null); setDry(null) }
  }
  const go = async () => {
    if (!words) return
    setBusy(true)
    try { const r = await api<{ total: number; changed: number }>('/words/import', { body: { words, overwriteEdited: overwrite } }); toast.success(`导入完成:${r.changed} 个词有变化`); onDone(); onClose() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>导入词库</DialogTitle><DialogDescription>支持 build.py 生成的 words.json,也支持词光导出的 json。先检查一遍,确认后才写入。</DialogDescription></DialogHeader>
        <input ref={input} type="file" accept=".json,application/json" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-[#FCFCFD] px-4 py-6 text-[13px] text-text-2 hover:border-blue-line hover:bg-blue-bg">
          <FileUp className="size-5 text-text-3" />{name ? <span className="font-mono">{name}</span> : '选择 json 文件'}
        </button>
        {dry && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border px-2 py-2"><div className="text-xs text-text-3">新增</div><div className="num font-semibold">{n(dry.create)}</div></div>
            <div className="rounded-lg border px-2 py-2"><div className="text-xs text-text-3">更新</div><div className="num font-semibold">{n(dry.update - dry.keepEdited)}</div></div>
            <div className="rounded-lg border px-2 py-2" title="后台改过的词默认不覆盖"><div className="text-xs text-text-3">保留改过的</div><div className="num font-semibold">{n(dry.keepEdited)}</div></div>
            {dry.invalid > 0 && <div className="col-span-3 text-xs text-warn">有 {dry.invalid} 条缺序号或马来语,会跳过</div>}
          </div>
        )}
        <label className="flex items-center gap-2 text-[13px]"><Checkbox checked={overwrite} onCheckedChange={v => { setOverwrite(!!v); if (words) check(words, !!v) }} />也覆盖后台改过的词</label>
        {err && <div className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">{err}</div>}
        <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={go} disabled={!dry || busy || !dry.valid}>导入 {dry ? n(dry.valid) : ''} 个词</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 发音：现在用的是哪个（启航原声 / AI 生成），AI 重新生成几条试听，挑一条「用这个」，随单词一起保存
function AudioSection({ w, edit, up }: { w: Word; edit: boolean; up: (p: Partial<Word>) => void }) {
  const [voice, setVoice] = useState<Voice>('yasmin')
  const [rate, setRate] = useState<'normal' | 'slow'>('normal')
  const [text, setText] = useState('')
  const [takes, setTakes] = useState<Take[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { setTakes([]); setText('') }, [w.rank])
  const cur = isAi(w.audio) ? takes.find(t => t.audio === w.audio)?.audioUrl || w.audioUrl : w.audioUrl
  const gen = async () => {
    setBusy(true)
    try {
      const t = await api<Take>(`/words/${w.rank}/tts`, { body: { voice, rate, text: text.trim() || w.ms } })
      setTakes(x => [t, ...x].slice(0, 5)); play(t.audioUrl)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const use = (t: Take) => {
    // 第一次换成 AI 发音时记下启航原声，以后能改回去
    const orig = w.extra.audioOrig || (isAi(w.audio) ? '' : w.audio)
    up({ audio: t.audio, audioUrl: t.audioUrl, extra: { ...w.extra, audioOrig: orig, audioBy: `${t.voiceName}${t.rate === 'slow' ? ' · 慢速' : ''}` } })
    toast.success('换好了，点底部「保存」生效')
  }
  const revert = () => up({ audio: w.extra.audioOrig || '', audioUrl: '', extra: { ...w.extra, audioOrig: '', audioBy: '' } })
  return (
    <Section title="发音" extra={isAi(w.audio) && w.extra.audioOrig && edit && <Button type="button" size="sm" variant="outline" onClick={revert}><RotateCcw />改回启航原声</Button>}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-[#FCFCFD] p-3">
        <button type="button" disabled={!cur} onClick={() => play(cur)} aria-label="听现在的发音" className="flex size-9 flex-none items-center justify-center rounded-md bg-blue-bg text-blue disabled:opacity-40"><Volume2 className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{!w.audio ? '没有音频' : isAi(w.audio) ? `AI 生成 · ${w.extra.audioBy || ''}` : '启航原声'}</div>
          <div className="truncate font-mono text-xs text-text-4" title={w.audio}>{w.audio || '—'}{!cur && w.audio ? ' · 保存后能听' : ''}</div>
        </div>
      </div>
      {edit && (
        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="声音" options={VOICES.map(v => ({ value: v.value, label: v.label }))} value={voice} onChange={setVoice} />
            <Segmented label="语速" options={[{ value: 'normal', label: '正常' }, { value: 'slow', label: '慢一点' }]} value={rate} onChange={setRate} />
          </div>
          <div className="flex min-w-0 gap-2">
            <Input value={text} onChange={e => setText(e.target.value)} placeholder={w.ms} title="要读的内容，默认读这个词；读得不对可以改拼写或加连字符" aria-label="要读的内容" className="min-w-0 flex-1 font-mono" />
            <Button type="button" onClick={gen} disabled={busy} className="flex-none">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? '生成中…' : 'AI 生成'}</Button>
          </div>
          {takes.length > 0 && (
            <div className="divide-y rounded-xl border">
              {takes.map(t => (
                <div key={t.audio} className="flex min-w-0 items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => play(t.audioUrl)} aria-label="试听" className="flex size-8 flex-none items-center justify-center rounded-md text-blue hover:bg-blue-bg"><Volume2 className="size-4" /></button>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{t.voiceName}{t.rate === 'slow' ? ' · 慢一点' : ''}</span>
                  {w.audio === t.audio ? <Pill tone="ok" dot>用这个</Pill> : <Button type="button" size="sm" variant="outline" onClick={() => use(t)}>用这个</Button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
