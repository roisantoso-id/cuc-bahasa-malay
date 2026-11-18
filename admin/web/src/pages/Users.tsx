import { useEffect, useState } from 'react'
import { ChevronRight, Copy, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFetch } from '@/lib/use-fetch'
import { ago, full } from '@/lib/format'
import { Avatar, Empty, ErrorLine, Field, Loading, PageHeader, Panel, Pill, SearchBox, Section, Segmented, SidePanel, Toolbar, rowClick, useConfirm } from '@/components/app/ui'

export type AdminUser = { id: number; username: string; name: string; status: string; mustChange: boolean; roleId: number; roleCode: string; roleName: string; lastLoginAt: string; lastLoginIp: string; createdAt: string }
export type Role = { id: number; code: string; name: string; description: string; permissions: string[]; builtin: boolean; users: number }

// 生成初始密码:12 位,去掉容易看错的字符
export const genPassword = () => { const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; const a = crypto.getRandomValues(new Uint32Array(12)); return Array.from(a, x => c[x % c.length]).join('') }

export function Users() {
  const { can, me } = useAuth()
  const { data, error, loading, reload } = useFetch<AdminUser[]>('/users')
  const { data: roles } = useFetch<{ roles: Role[] }>('/roles')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState<AdminUser | 'new' | null>(null)
  const rows = (data || []).filter(u => (!status || (status === 'pw' ? u.mustChange : u.status === status)) && (!q || `${u.username} ${u.name} ${u.roleName}`.toLowerCase().includes(q.toLowerCase())))
  const all = data || []
  return (
    <>
      <PageHeader crumb="系统" title="后台账号" desc="每个人用自己的账号登录;能做什么由角色决定,改角色后对方要重新登录"
        actions={can('users.manage') && <Button onClick={() => setOpen('new')}><Plus />新建账号</Button>} />
      <Panel>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="搜账号、姓名、角色  /" />
          <Segmented label="状态" value={status} onChange={setStatus} options={[{ value: '', label: '全部', count: all.length }, { value: 'active', label: '正常', count: all.filter(u => u.status === 'active').length }, { value: 'pw', label: '待改密码', count: all.filter(u => u.mustChange).length, tone: 'warn' }, { value: 'disabled', label: '已停用', count: all.filter(u => u.status === 'disabled').length }]} />
        </Toolbar>
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !rows.length ? <Empty>没有符合条件的账号</Empty> : (
          <table className="jb-table">
            <thead><tr><th>账号</th><th>角色</th><th className="hidden sm:table-cell">状态</th><th className="r">最近登录</th><th className="w-8" /></tr></thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} {...rowClick(() => setOpen(u))} className={u.status === 'disabled' ? 'opacity-60' : ''}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={u.name || u.username} id={u.id} /><div className="min-w-0"><div className="truncate font-medium">{u.name}{u.id === me?.user.id && <span className="ml-1.5 text-xs font-normal text-text-4">(我)</span>}</div><div className="truncate font-mono text-xs text-text-4">{u.username}</div></div></div></td>
                  <td className="nw"><Pill tone={u.roleCode === 'super_admin' ? 'blue' : 'off'}>{u.roleName || '没有角色'}</Pill></td>
                  <td className="nw hidden sm:table-cell">{u.status === 'disabled' ? <Pill tone="bad" dot>已停用</Pill> : u.mustChange ? <Pill tone="warn" dot>待改密码</Pill> : <Pill tone="ok" dot>正常</Pill>}</td>
                  <td className="r nw" title={full(u.lastLoginAt)}><div className="text-text-2">{u.lastLoginAt ? ago(u.lastLoginAt) : '没登录过'}</div>{u.lastLoginIp && <div className="font-mono text-xs text-text-4">{u.lastLoginIp}</div>}</td>
                  <td className="text-text-4"><ChevronRight className="size-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <UserPanel u={open} roles={roles?.roles || []} onClose={() => setOpen(null)} onSaved={reload} />
    </>
  )
}

function PasswordReveal({ pw }: { pw: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
      <span className="flex-1 break-all font-mono text-sm">{pw}</span>
      <button type="button" onClick={() => { navigator.clipboard.writeText(pw); toast.success('已复制') }} className="rounded p-1 text-text-3 hover:text-foreground" aria-label="复制密码"><Copy className="size-4" /></button>
    </div>
  )
}

function UserPanel({ u, roles, onClose, onSaved }: { u: AdminUser | 'new' | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const { can, me } = useAuth()
  const confirm = useConfirm()
  const isNew = u === 'new'
  const [f, setF] = useState({ username: '', name: '', roleId: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [newPw, setNewPw] = useState('')
  useEffect(() => {
    setNewPw('')
    if (u === 'new') setF({ username: '', name: '', roleId: String(roles.find(r => r.code === 'teacher')?.id || ''), password: genPassword() })
    else if (u) setF({ username: u.username, name: u.name, roleId: String(u.roleId || ''), password: '' })
  }, [u, roles])
  if (!u) return <SidePanel open={false} onClose={onClose} title=""><span /></SidePanel>
  const self = !isNew && u.id === me?.user.id
  const manage = can('users.manage')
  const role = roles.find(r => String(r.id) === f.roleId)
  const save = async () => {
    setBusy(true)
    try {
      if (isNew) { await api('/users', { body: { ...f, roleId: Number(f.roleId) } }); toast.success('账号已建好,把账号和初始密码发给对方'); setNewPw(f.password) }
      else { await api(`/users/${u.id}`, { method: 'PUT', body: { name: f.name, roleId: Number(f.roleId) } }); toast.success('已保存'); onClose() }
      onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const setStatus = async (status: string) => {
    if (isNew) return
    if (status === 'disabled' && !await confirm({ title: `停用 ${u.name}?`, desc: '对方马上被踢下线,登录不了;随时可以恢复。', ok: '停用', danger: true })) return
    try { await api(`/users/${u.id}`, { method: 'PUT', body: { status } }); toast.success(status === 'disabled' ? '已停用' : '已恢复'); onSaved(); onClose() } catch (e) { toast.error((e as Error).message) }
  }
  const reset = async () => {
    if (isNew) return
    const pw = genPassword()
    if (!await confirm({ title: `重置 ${u.name} 的密码?`, desc: '会生成一个新的初始密码,对方马上下线,下次登录要先改密码。', ok: '重置' })) return
    try { await api(`/users/${u.id}/password`, { body: { password: pw } }); setNewPw(pw); onSaved() } catch (e) { toast.error((e as Error).message) }
  }
  const del = async () => {
    if (isNew) return
    if (!await confirm({ title: `删除账号 ${u.username}?`, desc: '删了不能恢复;操作日志会保留。只是暂时不用的话,停用就行。', ok: '删除', danger: true })) return
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); toast.success('已删除'); onSaved(); onClose() } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <SidePanel open onClose={onClose} width={560}
      head={!isNew && <Avatar name={u.name || u.username} id={u.id} size={40} />}
      title={isNew ? '新建后台账号' : u.name} sub={!isNew && <span className="font-mono">{u.username} · {ago(u.createdAt)}建的</span>}
      footer={manage && !newPw && <>
        {!isNew && !self && <Button variant="outline" className="mr-auto text-bad hover:text-bad" onClick={del}><Trash2 />删除</Button>}
        <Button onClick={save} disabled={busy}>{isNew ? '建账号' : '保存'}</Button>
      </>}>
      {newPw ? (
        <Section title={isNew ? '账号建好了' : '密码已重置'}>
          <p className="mb-3 text-[13px] text-text-2">把下面的账号和初始密码私下发给 <b>{f.name || f.username}</b>。关掉这个面板后就看不到这个密码了;对方第一次登录要改成自己的密码。</p>
          <div className="mb-2 font-mono text-[13px]">账号:{f.username}</div>
          <PasswordReveal pw={newPw} />
          <Button className="mt-4" onClick={onClose}>我记下了</Button>
        </Section>
      ) : (
        <fieldset disabled={!manage}>
          {!isNew && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {u.status === 'disabled' ? <Pill tone="bad" dot>已停用</Pill> : u.mustChange ? <Pill tone="warn" dot>待改初始密码</Pill> : <Pill tone="ok" dot>正常</Pill>}
              <Pill title={full(u.lastLoginAt)}>{u.lastLoginAt ? `${ago(u.lastLoginAt)}登录 · ${u.lastLoginIp}` : '还没登录过'}</Pill>
            </div>
          )}
          <Section title="资料">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="账号" hint={isNew ? '3–32 位小写字母、数字、. _ -,建好后不能改' : undefined}><Input value={f.username} disabled={!isNew} onChange={e => setF({ ...f, username: e.target.value.toLowerCase() })} className="font-mono" placeholder="zhang.jl" autoComplete="off" /></Field>
              <Field label="姓名"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="张静灵" /></Field>
            </div>
          </Section>
          <Section title="角色">
            <Select value={f.roleId} onValueChange={v => setF({ ...f, roleId: v })} disabled={!manage || self}>
              <SelectTrigger className="bg-white" aria-label="角色"><SelectValue placeholder="选择角色" /></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
            {role && <p className="mt-1.5 text-xs text-text-3">{role.description || '自定义角色'} · {role.permissions.includes('*') ? '全部权限' : `${role.permissions.length} 项权限`}</p>}
            {self && <p className="mt-1.5 text-xs text-text-4">不能改自己的角色</p>}
          </Section>
          {isNew ? (
            <Section title="初始密码" extra={<button type="button" onClick={() => setF({ ...f, password: genPassword() })} className="inline-flex items-center gap-1 text-xs text-blue hover:underline"><RefreshCw className="size-3" />换一个</button>}>
              <Input value={f.password} onChange={e => setF({ ...f, password: e.target.value })} className="font-mono" />
              <p className="mt-1.5 text-xs text-text-4">至少 8 位;对方第一次登录必须改掉</p>
            </Section>
          ) : manage && !self && (
            <Section title="安全">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={reset}><KeyRound />重置密码</Button>
                {u.status === 'disabled' ? <Button type="button" variant="outline" onClick={() => setStatus('active')}>恢复账号</Button> : <Button type="button" variant="outline" className="text-bad hover:text-bad" onClick={() => setStatus('disabled')}>停用账号</Button>}
              </div>
            </Section>
          )}
        </fieldset>
      )}
    </SidePanel>
  )
}
