import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export function Login() {
  const { refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try { await api('/login', { body: { username: username.trim(), password } }); await refresh() }
    catch (e) { setErr((e as Error).message); setPassword('') }
    finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form onSubmit={submit} className="jb-card w-full max-w-[360px] px-6 py-7">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="" className="size-10 rounded-xl" />
          <div><div className="text-lg font-semibold leading-tight">JomBelajar</div><div className="text-xs text-text-3">管理后台登录</div></div>
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-text-2">账号</span>
          <Input autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required className="h-10" />
        </label>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-text-2">密码</span>
          <span className="relative block">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="h-10 pr-10" />
            <button type="button" aria-label={show ? '隐藏密码' : '显示密码'} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-4 hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </span>
        </label>
        <div className="min-h-[22px] text-[13px] text-bad" role="alert">{err}</div>
        <Button type="submit" className="mt-1 h-10 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}登录</Button>
        <p className="mt-4 text-center text-xs text-text-4">忘记密码请找超级管理员重置</p>
      </form>
    </div>
  )
}
