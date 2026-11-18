import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { LOGIN_WORDS } from '@/lib/login-words'
import { cn } from '@/lib/utils'

// 登录页(方向 C:单词流):深色背景上,词库里的真单词一行行慢慢飘过,时不时有一个亮起来显示中文
const ROWS = [
  { size: 15, speed: 140, dir: 1, op: .16 }, { size: 22, speed: 110, dir: -1, op: .2 }, { size: 17, speed: 160, dir: 1, op: .14 },
  { size: 28, speed: 95, dir: -1, op: .22 }, { size: 16, speed: 150, dir: 1, op: .15 }, { size: 20, speed: 120, dir: -1, op: .18 },
  { size: 34, speed: 85, dir: 1, op: .2 }, { size: 15, speed: 170, dir: -1, op: .14 }, { size: 19, speed: 130, dir: 1, op: .17 },
  { size: 24, speed: 105, dir: -1, op: .2 }, { size: 16, speed: 155, dir: 1, op: .15 }
]

function WordStream() {
  const box = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => ROWS.map((r, i) => {
    const words = Array.from({ length: 12 }, (_, k) => LOGIN_WORDS[(i * 7 + k * 5) % LOGIN_WORDS.length])
    return { ...r, words }
  }), [])
  // 每 1.6 秒挑一个看得见的词亮起来,显示中文,2.4 秒后暗下去
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      const el = box.current
      if (!el) return
      const all = [...el.querySelectorAll<HTMLElement>('[data-zh]')].filter(w => {
        const r = w.getBoundingClientRect()
        return r.left > 40 && r.right < innerWidth - 40 && r.top > 40 && r.bottom < innerHeight - 40 && !w.classList.contains('lit')
      })
      const w = all[Math.floor(Math.random() * all.length)]
      if (!w) return
      w.classList.add('lit')
      setTimeout(() => w.classList.remove('lit'), 2400)
    }, 1600)
    return () => clearInterval(t)
  }, [])
  return (
    <div ref={box} aria-hidden="true" className="jb-stream pointer-events-none absolute inset-0 flex select-none flex-col justify-around overflow-hidden py-6">
      {rows.map((r, i) => (
        <div key={i} className="jb-stream-row" style={{ fontSize: r.size, ['--op' as string]: r.op, animationDuration: `${r.speed}s`, animationDirection: r.dir > 0 ? 'normal' : 'reverse' }}>
          {[0, 1].map(copy => (
            <span key={copy} className="jb-stream-track">
              {r.words.map(([ms, zh], k) => <span key={k} className="jb-word" data-zh={zh}>{ms}</span>)}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

// 登录页和「先改初始密码」页共用的外框
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="jb-auth relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 lg:justify-end lg:pr-[10vw]">
      <WordStream />
      <div className="pointer-events-none absolute bottom-8 left-8 hidden max-w-[440px] rounded-2xl bg-[#0B1320] p-4 text-white shadow-[0_0_48px_36px_#0B1320] lg:block">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="size-11 rounded-xl ring-1 ring-white/15" />
          <div><div className="text-xl font-semibold tracking-tight">JomBelajar</div><div className="text-[13px] text-white/55">马来语 5000 高频词 · 管理后台</div></div>
        </div>
        <p className="mt-5 text-[13px] leading-relaxed text-white/45">10 站旅程,从吉隆坡到亚庇。<br />老师在这里管学生、审单词、开课程。</p>
      </div>
      <div className="relative z-10 w-full max-w-[380px]">{children}</div>
    </div>
  )
}

export function Login() {
  const { refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try { await api('/login', { body: { username: username.trim(), password } }); await refresh() }
    catch (e) { setErr((e as Error).message); setPassword(''); setShake(s => s + 1) }
    finally { setBusy(false) }
  }
  return (
    <AuthScreen>
      <form key={shake} onSubmit={submit} className={cn('jb-auth-card px-7 py-8', shake && 'jb-shake')}>
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <img src="/logo.png" alt="" className="size-10 rounded-xl" />
          <div><div className="text-lg font-semibold leading-tight">JomBelajar</div><div className="text-xs text-text-3">管理后台</div></div>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight">Selamat datang</h1>
        <p className="mb-6 mt-1 text-[13px] text-text-3">欢迎回来,用你的后台账号登录</p>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-medium text-text-2">账号</span>
          <Input autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required className="h-11 bg-[#FAFBFC] text-[15px]" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-text-2">密码</span>
          <span className="relative block">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} required className="h-11 bg-[#FAFBFC] pr-11 text-[15px]"
              onChange={e => setPassword(e.target.value)} onKeyUp={e => setCaps(e.getModifierState('CapsLock'))} />
            <button type="button" aria-label={show ? '隐藏密码' : '显示密码'} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-4 hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </span>
        </label>
        <div className="mt-2 min-h-[20px] text-[13px]" role="alert">{err ? <span className="text-bad">{err}</span> : caps ? <span className="text-warn">大写锁定开着</span> : null}</div>
        <button type="submit" disabled={busy} className="jb-login-btn group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-medium text-white disabled:opacity-70">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <>登录<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></>}
        </button>
        <p className="mt-5 text-center text-xs text-text-4">忘记密码请找超级管理员重置</p>
      </form>
    </AuthScreen>
  )
}
