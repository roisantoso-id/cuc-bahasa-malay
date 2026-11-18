import { useState } from 'react'
import { AuthScreen } from './Login'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFetch } from '@/lib/use-fetch'
import { ago, full } from '@/lib/format'
import { Avatar, Field, PageHeader, Panel, PanelHead, Pill } from '@/components/app/ui'

export function PasswordForm({ onDone, forced }: { onDone?: () => void; forced?: boolean }) {
  const [f, setF] = useState({ old: '', password: '', again: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (f.password.length < 8) return setErr('新密码至少 8 位')
    if (f.password !== f.again) return setErr('两次输入的新密码不一样')
    setBusy(true); setErr('')
    try { await api('/me/password', { body: { old: f.old, password: f.password } }); toast.success('密码已修改,其它设备已下线'); setF({ old: '', password: '', again: '' }); onDone?.() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label={forced ? '初始密码' : '原密码'}><Input type="password" autoComplete="current-password" value={f.old} onChange={e => setF({ ...f, old: e.target.value })} required /></Field>
      <Field label="新密码" hint="至少 8 位"><Input type="password" autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></Field>
      <Field label="再输一次新密码"><Input type="password" autoComplete="new-password" value={f.again} onChange={e => setF({ ...f, again: e.target.value })} required /></Field>
      <div className="min-h-5 text-[13px] text-bad" role="alert">{err}</div>
      <div><Button type="submit" disabled={busy}>修改密码</Button></div>
    </form>
  )
}

// 管理员重置过密码的账号,第一次登录必须先改密码
export function ForcePassword() {
  const { me, refresh, logout } = useAuth()
  return (
    <AuthScreen>
      <div className="jb-auth-card px-7 py-8">
        <div className="mb-1 text-lg font-semibold">先改一个自己的密码</div>
        <p className="mb-5 text-[13px] text-text-3">{me?.user.name},你的密码是管理员设的初始密码,改完才能使用后台。</p>
        <PasswordForm forced onDone={refresh} />
        <button type="button" onClick={logout} className="mt-4 text-xs text-text-3 hover:text-foreground">退出登录</button>
      </div>
    </AuthScreen>
  )
}

type Sess = { current: boolean; createdAt: string; ip: string; ua: string }
const device = (ua: string) => /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '其它设备'
const browser = (ua: string) => /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : ''

export function Account() {
  const { me } = useAuth()
  const { data: sessions } = useFetch<Sess[]>('/me/sessions')
  if (!me) return null
  return (
    <>
      <PageHeader crumb="我的账号" title="我的账号" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead title="资料" />
          <div className="flex items-center gap-3 px-4 py-4">
            <Avatar name={me.user.name || me.user.username} id={me.user.id} size={44} />
            <div className="min-w-0"><div className="text-base font-semibold">{me.user.name}</div><div className="font-mono text-xs text-text-3">{me.user.username}</div></div>
            <div className="ml-auto"><Pill tone="blue">{me.user.role.name}</Pill></div>
          </div>
          <div className="border-t px-4 py-3 text-xs text-text-3">能用的功能:{me.permissions.length} 项。姓名和角色由超级管理员在「后台账号」里改。</div>
          <PanelHead title="登录中的设备" sub="改密码后,其它设备会自动下线" />
          <table className="jb-table"><tbody>
            {(sessions || []).map((s, i) => (
              <tr key={i}><td><div className="font-medium">{device(s.ua)} {browser(s.ua)}</div><div className="font-mono text-xs text-text-4">{s.ip}</div></td>
                <td className="r nw text-text-3" title={full(s.createdAt)}>{s.current ? <Pill tone="ok" dot>当前</Pill> : `${ago(s.createdAt)}登录`}</td></tr>
            ))}
          </tbody></table>
        </Panel>
        <Panel>
          <PanelHead title="修改密码" />
          <div className="px-4 py-4"><PasswordForm /></div>
        </Panel>
      </div>
    </>
  )
}
