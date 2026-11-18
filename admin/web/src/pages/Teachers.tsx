import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ImageUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFetch } from '@/lib/use-fetch'
import { Avatar, Empty, ErrorLine, Field, Loading, PageHeader, Panel, Pill, SidePanel, rowClick, useConfirm } from '@/components/app/ui'

type Teacher = { id: number; name: string; title: string; role: string; bio: string; photo: string; sort: number }

export function Teachers() {
  const { can } = useAuth()
  const { data, error, loading, reload } = useFetch<Teacher[]>('/teachers')
  const [open, setOpen] = useState<Teacher | 'new' | null>(null)
  return (
    <>
      <PageHeader crumb="教学" title="老师" desc="小程序「关于我们」里的老师介绍,按排序从小到大显示"
        actions={can('teachers.edit') && <Button onClick={() => setOpen('new')}><Plus />添加老师</Button>} />
      <Panel>
        <ErrorLine msg={error} />
        {!data ? (loading ? <Loading /> : null) : !data.length ? <Empty>还没有老师介绍</Empty> : (
          <table className="jb-table">
            <thead><tr><th>老师</th><th className="hidden md:table-cell">介绍</th><th>身份</th><th className="r">排序</th><th className="w-8" /></tr></thead>
            <tbody>
              {data.map(t => (
                <tr key={t.id} {...rowClick(() => setOpen(t))}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={t.name} id={t.id} size={36} src={t.photo || undefined} /><div className="min-w-0"><div className="truncate font-medium">{t.name}</div><div className="truncate text-xs text-text-4" title={t.title}>{t.title || '—'}</div></div></div></td>
                  <td className="hidden max-w-[520px] text-text-2 md:table-cell"><span className="line-clamp-2" title={t.bio}>{t.bio || <span className="text-text-4">没写</span>}</span></td>
                  <td className="nw">{t.role ? <Pill tone="blue">{t.role}</Pill> : <span className="text-text-4">—</span>}</td>
                  <td className="r num">{t.sort}</td>
                  <td className="text-text-4"><ChevronRight className="size-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <TeacherPanel t={open} onClose={() => setOpen(null)} onSaved={reload} />
    </>
  )
}

function TeacherPanel({ t, onClose, onSaved }: { t: Teacher | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth()
  const confirm = useConfirm()
  const [f, setF] = useState<Partial<Teacher> & { photoData?: string }>({})
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const isNew = t === 'new'
  useEffect(() => { if (t) setF(isNew ? { sort: 10 } : { ...t }) }, [t, isNew])
  const pick = (fl?: File) => {
    if (!fl) return
    if (!/^image\/(jpeg|png|webp)$/.test(fl.type)) return toast.error('只支持 jpg / png / webp')
    if (fl.size > 5 * 1024 * 1024) return toast.error('图片不能超过 5MB')
    const r = new FileReader(); r.onload = () => setF(x => ({ ...x, photoData: String(r.result) })); r.readAsDataURL(fl)
  }
  const save = async () => {
    if (!f.name?.trim()) return toast.error('请填写姓名')
    setBusy(true)
    try { await api(isNew ? '/teachers' : `/teachers/${(t as Teacher).id}`, { method: isNew ? 'POST' : 'PUT', body: f }); toast.success('已保存'); onSaved(); onClose() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!await confirm({ title: `删除 ${f.name} 的介绍?`, desc: '小程序里就不显示了,删了不能恢复。', ok: '删除', danger: true })) return
    try { await api(`/teachers/${(t as Teacher).id}`, { method: 'DELETE' }); toast.success('已删除'); onSaved(); onClose() } catch (e) { toast.error((e as Error).message) }
  }
  const photo = f.photoData || f.photo
  return (
    <SidePanel open={!!t} onClose={onClose} width={560} title={isNew ? '添加老师' : f.name || '老师'} sub={!isNew && f.title}
      footer={can('teachers.edit') && <>{!isNew && <Button variant="outline" className="mr-auto text-bad hover:text-bad" onClick={del}><Trash2 />删除</Button>}<Button onClick={save} disabled={busy}>保存</Button></>}>
      <fieldset disabled={!can('teachers.edit')} className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2">
          {photo ? <img src={photo} alt="" className="size-16 rounded-full border object-cover" /> : <Avatar name={f.name} id={f.name} size={64} />}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
          <div><Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()}><ImageUp />{photo ? '换照片' : '上传照片'}</Button><div className="mt-1 text-xs text-text-4">正方形最好,jpg / png / webp,5MB 以内</div></div>
        </div>
        <Field label="姓名"><Input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="身份" hint="例如:课程主持、团队成员"><Input value={f.role || ''} onChange={e => setF({ ...f, role: e.target.value })} /></Field>
        <Field label="头衔" className="sm:col-span-2"><Input value={f.title || ''} onChange={e => setF({ ...f, title: e.target.value })} placeholder="副教授 · 中国传媒大学马来语专业教师" /></Field>
        <Field label="介绍" className="sm:col-span-2"><Textarea rows={6} value={f.bio || ''} onChange={e => setF({ ...f, bio: e.target.value })} /></Field>
        <Field label="排序" hint="数字小的排前面"><Input type="number" value={f.sort ?? 0} onChange={e => setF({ ...f, sort: Number(e.target.value) })} className="num" /></Field>
      </fieldset>
    </SidePanel>
  )
}
