// 后台共用小件(照全局 admin-ui):页头、数字卡、面板、工具条、分段、胶囊、状态点、头像、分页、右侧面板、确认框、空状态
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { n } from '@/lib/format'

export function PageHeader({ crumb, title, desc, actions }: { crumb?: string; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumb && <div className="mb-1 text-xs text-text-4">{crumb}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        {desc && <p className="mt-1 truncate text-[13px] text-text-3" title={typeof desc === 'string' ? desc : undefined}>{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// 数字从 0 滚到目标值(只滚一次,600ms;减少动态效果时直接显示)。字符串开头的数字也能滚,后面的单位保留
export function CountUp({ value }: { value: ReactNode }) {
  const m = typeof value === 'string' ? /^([\d,]+)(.*)$/.exec(value) : typeof value === 'number' ? [String(value), String(value), ''] : null
  const target = m ? Number(m[1].replace(/,/g, '')) : 0
  const [shown, setShown] = useState(m ? 0 : target)
  const from = useRef(0)
  useEffect(() => {
    if (!m) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || target < 10) { setShown(target); from.current = target; return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min((t - start) / 600, 1), e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(a + (target - a) * e))
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <>{value}</>
  return <>{shown.toLocaleString('zh-CN')}{m[2]}</>
}

export type Kpi = { label: string; value: ReactNode; sub?: ReactNode; tone?: 'bad' | 'warn' | 'ok'; title?: string }
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="jb-stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(k => (
        <div key={k.label} className="jb-card jb-card-hover px-4 py-3.5" title={k.title}>
          <div className="text-xs text-text-3">{k.label}</div>
          <div className={cn('num mt-1 text-[22px] font-semibold leading-tight', k.tone === 'bad' && 'text-bad', k.tone === 'warn' && 'text-warn', k.tone === 'ok' && 'text-ok')}><CountUp value={k.value} /></div>
          {k.sub && <div className="mt-0.5 truncate text-xs text-text-4" title={typeof k.sub === 'string' ? k.sub : undefined}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('jb-card overflow-hidden', className)}>{children}</div>
}
export function PanelHead({ title, extra, sub }: { title: ReactNode; extra?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <div className="min-w-0"><div className="text-sm font-semibold">{title}</div>{sub && <div className="text-xs text-text-4">{sub}</div>}</div>
      {extra}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">{children}</div>
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative flex h-9 w-full items-center sm:w-[300px]">
      <Search className="pointer-events-none absolute left-2.5 size-4 text-text-4" />
      <input data-search value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-white pl-8 pr-8 text-[13px] outline-none placeholder:text-text-4 focus:border-blue-line focus:ring-2 focus:ring-blue-bg" />
      {value && <button type="button" aria-label="清空" onClick={() => onChange('')} className="absolute right-2 rounded p-0.5 text-text-4 hover:text-foreground"><X className="size-3.5" /></button>}
    </label>
  )
}

export type SegOpt<T extends string> = { value: T; label: string; count?: number | null; tone?: 'bad' | 'warn' }
export function Segmented<T extends string>({ options, value, onChange, label }: { options: SegOpt<T>[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex min-h-9 max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-[3px]">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 max-sm:h-9 max-sm:min-w-11 max-sm:justify-center text-[13px] text-text-2 transition-colors hover:text-foreground',
            value === o.value && 'bg-white font-medium text-foreground shadow-[0_1px_2px_rgba(15,23,42,.08)]')}>
          {o.label}
          {o.count != null && <span className={cn('num text-xs text-text-4', o.tone === 'bad' && o.count > 0 && 'text-bad', o.tone === 'warn' && o.count > 0 && 'text-warn')}>{n(o.count)}</span>}
        </button>
      ))}
    </div>
  )
}

// 筛选胶囊(选项多时用,放不下换行)
export function Chips<T extends string>({ options, value, onChange, group }: { options: SegOpt<T>[]; value: T; onChange: (v: T) => void; group?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {group && <span className="mr-1 text-xs text-text-4">{group}</span>}
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={cn('inline-flex h-7 items-center gap-1 rounded-full border bg-white px-2.5 text-xs max-sm:h-9 max-sm:px-3 text-text-2 hover:border-blue-line',
            value === o.value && 'border-blue-line bg-blue-bg font-medium text-blue')}>
          {o.label}{o.count != null && <span className="num text-text-4">{n(o.count)}</span>}
        </button>
      ))}
    </div>
  )
}

export function ActiveFilters({ total, items, onClear }: { total: number; items: { label: string; clear: () => void }[]; onClear: () => void }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b bg-[#FCFCFD] px-4 py-2 text-xs text-text-3">
      <span>筛出 <b className="num text-foreground">{n(total)}</b> 个:</span>
      {items.map(i => (
        <button key={i.label} type="button" onClick={i.clear} className="inline-flex h-6 items-center gap-1 rounded-full bg-blue-bg px-2 text-blue hover:bg-blue-line/50">{i.label}<X className="size-3" /></button>
      ))}
      <button type="button" onClick={onClear} className="ml-1 text-text-3 underline-offset-2 hover:text-foreground hover:underline">清空</button>
    </div>
  )
}

const TONES = { ok: 'bg-ok', warn: 'bg-[#D97706]', bad: 'bg-bad', off: 'bg-text-4', blue: 'bg-blue' }
export function Dot({ tone = 'ok' }: { tone?: keyof typeof TONES }) {
  return <span className={cn('inline-block size-1.5 shrink-0 rounded-full', TONES[tone])} />
}
const PILLS = { ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', off: 'bg-secondary text-text-3', blue: 'bg-blue-bg text-blue' }
export function Pill({ tone = 'off', dot, children, title }: { tone?: keyof typeof PILLS; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-[22px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs', PILLS[tone])}>
      {dot && <Dot tone={tone} />}<span className="truncate">{children}</span>
    </span>
  )
}

const AV = ['#2563EB', '#0891B2', '#7C3AED', '#DB2777', '#D97706', '#16A34A', '#0F766E', '#9333EA', '#C2410C', '#4F46E5']
export function Avatar({ name, id, size = 32, src }: { name?: string | null; id?: number | string; size?: number; src?: string }) {
  const key = typeof id === 'number' ? id : [...String(id ?? name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0)
  if (src) return <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white" style={{ width: size, height: size, background: AV[key % AV.length], fontSize: size * 0.42 }}>
      {(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (total <= size) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-text-3">
      <span className="num">第 {(page - 1) * size + 1}–{Math.min(page * size, total)} 个,共 {n(total)} 个</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="inline-flex h-9 items-center gap-1 rounded-md border bg-white px-2.5 disabled:opacity-40"><ChevronLeft className="size-3.5" />上一页</button>
        <span className="num px-2">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border bg-white px-2.5 disabled:opacity-40">下一页<ChevronRight className="size-3.5" /></button>
      </div>
    </div>
  )
}

export function Empty({ children = '没有数据' }: { children?: ReactNode }) {
  return <div className="px-4 py-12 text-center text-[13px] text-text-4">{children}</div>
}
// 加载中:几行灰条扫光,比“正在加载…”更像页面本身
export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="px-4 py-3" aria-busy="true" aria-label="正在加载">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="jb-skel size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1"><div className="jb-skel h-3" style={{ width: `${55 - (i % 3) * 12}%` }} /><div className="jb-skel mt-2 h-2.5" style={{ width: `${30 + (i % 2) * 10}%` }} /></div>
          <div className="jb-skel hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  )
}
export function ErrorLine({ msg }: { msg: string }) {
  return msg ? <div className="mx-4 my-3 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">{msg}</div> : null
}

// 右侧面板:头部固定 + 中间滚动 + 底部按钮固定(不跳页、不弹窗)
export function SidePanel({ open, onClose, title, sub, head, children, footer, width = 600 }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; head?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-none" style={{ maxWidth: `min(100vw, ${width}px)` }} aria-describedby={undefined}>
        <div className="flex items-start gap-3 border-b px-5 py-4 pr-12">
          {head}
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold">{title}</SheetTitle>
            {sub ? <SheetDescription asChild><div className="mt-0.5 truncate text-xs text-text-3">{sub}</div></SheetDescription> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-white px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  )
}

// 小卡(面板里 4 个一排)
export function MiniStats({ items }: { items: { label: string; value: ReactNode; tone?: 'bad' | 'ok' | 'warn' }[] }) {
  return (
    <div className="jb-stagger mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(i => (
        <div key={i.label} className="rounded-xl border bg-[#FCFCFD] px-3 py-2.5">
          <div className="text-xs text-text-3">{i.label}</div>
          <div className={cn('num mt-0.5 text-base font-semibold', i.tone === 'bad' && 'text-bad', i.tone === 'ok' && 'text-ok', i.tone === 'warn' && 'text-warn')}><CountUp value={i.value} /></div>
        </div>
      ))}
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-4">{hint}</span>}
    </label>
  )
}

export function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[13px] font-semibold text-foreground">{title}</h3>{extra}</div>
      {children}
    </section>
  )
}

// 确认框(不用浏览器自带的 confirm)
type ConfirmOpts = { title: string; desc?: ReactNode; ok?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const res = useRef<(v: boolean) => void>(() => {})
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>(r => { res.current = r; setOpts(o) }), [])
  const done = (v: boolean) => { res.current(v); setOpts(null) }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={o => !o && done(false)}>
        <AlertDialogContent className="max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.desc ? <AlertDialogDescription>{opts.desc}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => done(false)}>取消</AlertDialogCancel>
            <AlertDialogAction className={cn(opts?.danger && 'bg-bad hover:bg-bad/90')} onClick={() => done(true)}>{opts?.ok || '确定'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)

export function Forbidden() {
  return <div className="jb-card px-6 py-16 text-center text-[13px] text-text-3">你的角色没有这个页面的权限。需要的话请联系超级管理员。</div>
}

// 整行可点:点按钮 / 链接 / 输入框不触发
export const rowClick = (fn: () => void) => ({
  'data-click': '', tabIndex: 0,
  onClick: (e: React.MouseEvent) => { if (!(e.target as HTMLElement).closest('button, a, input, label, [data-stop]')) fn() },
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') fn() }
})
