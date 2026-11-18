import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BookOpenText, GraduationCap, LayoutDashboard, LogOut, Map, Menu, ScrollText, ShieldCheck, UserCog, Users, KeyRound } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Avatar } from './ui'

export const NAV = [
  { group: '', items: [{ to: '/', label: '概览', icon: LayoutDashboard, perm: 'overview.view' }] },
  { group: '教学', items: [
    { to: '/students', label: '学生', icon: Users, perm: 'students.view' },
    { to: '/words', label: '单词', icon: BookOpenText, perm: 'words.view' },
    { to: '/courses', label: '课程', icon: Map, perm: 'courses.view' },
    { to: '/teachers', label: '老师', icon: GraduationCap, perm: 'teachers.view' }
  ] },
  { group: '系统', items: [
    { to: '/users', label: '后台账号', icon: UserCog, perm: 'users.view|users.manage' },
    { to: '/roles', label: '角色权限', icon: ShieldCheck, perm: 'roles.manage|users.view' },
    { to: '/audit', label: '操作日志', icon: ScrollText, perm: 'audit.view' }
  ] }
]
export const allowed = (can: (p: string) => boolean, perm: string) => perm.split('|').some(can)

function Nav({ onPick }: { onPick?: () => void }) {
  const { can } = useAuth()
  return (
    <nav className="flex flex-col gap-4 px-3">
      {NAV.map(g => {
        const items = g.items.filter(i => allowed(can, i.perm))
        if (!items.length) return null
        return (
          <div key={g.group || 'main'}>
            {g.group && <div className="mb-1 px-2.5 text-xs text-text-4">{g.group}</div>}
            <div className="flex flex-col gap-0.5">
              {items.map(i => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={onPick}
                  className={({ isActive }) => cn('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 hover:bg-secondary hover:text-foreground',
                    isActive && 'bg-blue-bg font-medium text-blue hover:bg-blue-bg hover:text-blue')}>
                  <i.icon className="size-4 shrink-0" strokeWidth={1.8} />{i.label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5">
      <img src="/logo.png" alt="" className="size-7 rounded-lg" />
      <div className="leading-tight"><div className="text-sm font-semibold">JomBelajar</div><div className="text-xs text-text-4">管理后台</div></div>
    </div>
  )
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { me, logout } = useAuth()
  if (!me) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-blue-bg', compact && 'size-10 justify-center p-0')}>
        <Avatar name={me.user.name || me.user.username} id={me.user.id} size={30} />
        {!compact && <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium">{me.user.name || me.user.username}</div><div className="truncate text-xs text-text-4">{me.user.role.name}</div></div>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} side={compact ? 'bottom' : 'top'} className="w-56">
        <DropdownMenuLabel className="font-normal"><div className="text-[13px] font-medium">{me.user.name}</div><div className="font-mono text-xs text-text-4">{me.user.username} · {me.user.role.name}</div></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><NavLink to="/account"><KeyRound className="size-4" />我的账号和密码</NavLink></DropdownMenuItem>
        <DropdownMenuItem onClick={logout} className="text-bad focus:text-bad"><LogOut className="size-4" />退出登录</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // 按 / 聚焦搜索框
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !t.closest('input, textarea, [contenteditable]')) {
        const el = document.querySelector<HTMLInputElement>('input[data-search]'); if (el) { e.preventDefault(); el.focus() }
      }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r bg-white py-4 lg:flex">
        <Brand />
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto"><Nav /></div>
        <div className="border-t px-3 pt-3"><UserMenu /></div>
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4 lg:hidden">
        <button type="button" aria-label="打开菜单" onClick={() => setOpen(true)} className="-ml-1 flex size-10 items-center justify-center rounded-lg hover:bg-secondary"><Menu className="size-5" /></button>
        <div className="flex items-center gap-2"><img src="/logo.png" alt="" className="size-6 rounded-md" /><span className="text-sm font-semibold">JomBelajar 后台</span></div>
        <UserMenu compact />
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] p-0 py-4" aria-describedby={undefined}>
          <SheetTitle className="sr-only">菜单</SheetTitle>
          <Brand /><div className="mt-6"><Nav onPick={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
      <main className="lg:pl-[232px]">
        {me?.demo && <div className="bg-warn-bg px-4 py-1.5 text-center text-xs text-warn">演示模式(DEMO=1):不要这样上线</div>}
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
