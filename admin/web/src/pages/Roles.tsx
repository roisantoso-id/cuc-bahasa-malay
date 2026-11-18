import { useEffect, useState } from 'react'
import { ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFetch } from '@/lib/use-fetch'
import { Empty, ErrorLine, Field, Loading, PageHeader, Panel, Pill, Section, SidePanel, rowClick, useConfirm } from '@/components/app/ui'
import type { Role } from './Users'

type Catalog = { group: string; items: [string, string][] }[]

export function Roles() {
  const { can } = useAuth()
  const { data, error, loading, reload } = useFetch<{ catalog: Catalog; roles: Role[] }>('/roles')
  const [open, setOpen] = useState<Role | 'new' | null>(null)
  const total = data?.catalog.reduce((a, g) => a + g.items.length, 0) || 0
  return (
    <>
      <PageHeader crumb="系统" title="角色权限" desc="一个账号一个角色;角色决定能看哪些页面、能做哪些修改"
        actions={can('roles.manage') && <Button onClick={() => setOpen('new')}><Plus />新建角色</Button>} />
      <Panel>
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !data.roles.length ? <Empty /> : (
          <table className="jb-table">
            <thead><tr><th>角色</th><th className="hidden md:table-cell">能做什么</th><th className="r">权限</th><th className="r">账号</th><th className="w-8" /></tr></thead>
            <tbody>
              {data.roles.map(r => {
                const all = r.permissions.includes('*')
                const groups = data.catalog.filter(g => all || g.items.some(i => r.permissions.includes(i[0]))).map(g => g.group)
                return (
                  <tr key={r.id} {...rowClick(() => setOpen(r))}>
                    <td><div className="flex items-center gap-1.5 font-medium">{r.name}{r.builtin && <Pill>内置</Pill>}</div><div className="truncate text-xs text-text-4" title={r.description}>{r.description || '—'}</div></td>
                    <td className="hidden md:table-cell"><div className="flex flex-wrap gap-1">{groups.map(g => <Pill key={g} tone={all ? 'blue' : 'off'}>{g}</Pill>)}</div></td>
                    <td className="r num nw">{all ? '全部' : `${r.permissions.length} / ${total}`}</td>
                    <td className="r num nw">{r.users ? `${r.users} 个` : <span className="text-text-4">—</span>}</td>
                    <td className="text-text-4"><ChevronRight className="size-4" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {data && <RolePanel r={open} catalog={data.catalog} onClose={() => setOpen(null)} onSaved={reload} />}
    </>
  )
}

function RolePanel({ r, catalog, onClose, onSaved }: { r: Role | 'new' | null; catalog: Catalog; onClose: () => void; onSaved: () => void }) {
  const { can, me } = useAuth()
  const confirm = useConfirm()
  const isNew = r === 'new'
  const [f, setF] = useState({ name: '', description: '', permissions: [] as string[] })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (r === 'new') setF({ name: '', description: '', permissions: ['overview.view'] }); else if (r) setF({ name: r.name, description: r.description, permissions: r.permissions }) }, [r])
  const locked = !isNew && !!r && r.code === 'super_admin'
  const mineRole = !isNew && !!r && r.code === me?.user.role.code && me?.user.role.code !== 'super_admin'
  const editable = !!r && can('roles.manage') && !locked && !mineRole
  const all = f.permissions.includes('*')
  const has = (p: string) => all || f.permissions.includes(p)
  const mine = (p: string) => me?.permissions.includes(p)
  const togglePerm = (p: string, on: boolean) => {
    let next = on ? [...f.permissions, p] : f.permissions.filter(x => x !== p)
    // 能改就一定要能看:勾了 xx.edit 自动带上 xx.view;去掉 xx.view 时一起去掉同组的写权限
    const [grp] = p.split('.')
    if (on && !p.endsWith('.view') && catalog.some(g => g.items.some(i => i[0] === `${grp}.view`))) next.push(`${grp}.view`)
    if (!on && p.endsWith('.view')) next = next.filter(x => !x.startsWith(grp + '.'))
    setF({ ...f, permissions: [...new Set(next)] })
  }
  const save = async () => {
    if (!f.name.trim()) return toast.error('请填写角色名称')
    setBusy(true)
    try { await api(isNew ? '/roles' : `/roles/${(r as Role).id}`, { method: isNew ? 'POST' : 'PUT', body: f }); toast.success(isNew ? '角色已建好' : '已保存;用这个角色的人刷新页面后生效'); onSaved(); onClose() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!await confirm({ title: `删除角色「${f.name}」?`, ok: '删除', danger: true })) return
    try { await api(`/roles/${(r as Role).id}`, { method: 'DELETE' }); toast.success('已删除'); onSaved(); onClose() } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <SidePanel open={!!r} onClose={onClose} width={600} title={isNew ? '新建角色' : f.name} sub={!isNew && r && <>{(r as Role).users} 个账号在用{(r as Role).builtin ? ' · 内置角色' : ''}</>}
      footer={editable && <>{!isNew && !(r as Role).builtin && <Button variant="outline" className="mr-auto text-bad hover:text-bad" onClick={del}><Trash2 />删除</Button>}<Button onClick={save} disabled={busy}>{isNew ? '建角色' : '保存'}</Button></>}>
      {locked && <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-bg px-3 py-2 text-[13px] text-blue"><Lock className="size-4" />超级管理员什么都能做,权限不能改</div>}
      {mineRole && <div className="mb-4 rounded-lg bg-warn-bg px-3 py-2 text-[13px] text-warn">这是你自己所在的角色,不能自己改</div>}
      <fieldset disabled={!editable}>
        <Section title="名称">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="角色名称"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="例如:助教" /></Field>
            <Field label="一句话说明"><Input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="这个角色负责什么" /></Field>
          </div>
        </Section>
        <Section title="权限" extra={<span className="text-xs text-text-4">勾「改」会自动带上「看」</span>}>
          <div className="overflow-hidden rounded-xl border">
            {catalog.map(g => (
              <div key={g.group} className="grid grid-cols-[72px_minmax(0,1fr)] border-b last:border-b-0">
                <div className="bg-[#FAFBFC] px-3 py-2.5 text-xs font-medium text-text-2">{g.group}</div>
                <div className="grid gap-1 px-3 py-2 sm:grid-cols-2">
                  {g.items.map(([code, label]) => {
                    const cannotGrant = !all && !mine(code) && !has(code)
                    return (
                      <label key={code} className={`flex items-center gap-2 rounded-md px-1 py-1 text-[13px] ${cannotGrant ? 'opacity-50' : ''}`} title={cannotGrant ? '你自己没有这项权限,不能给别人' : code}>
                        <Checkbox checked={has(code)} disabled={!editable || all || cannotGrant} onCheckedChange={v => togglePerm(code, !!v)} />{label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </fieldset>
    </SidePanel>
  )
}
