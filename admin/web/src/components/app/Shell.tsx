import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BookOpenText, GraduationCap, LayoutDashboard, LogOut, Map, Menu, PanelLeftClose, PanelLeftOpen, ScrollText, ShieldCheck, UserCog, Users, KeyRound } from 'lucide-react'
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

function Nav({ onPick, mini }: { onPick?: () => void; mini?: boolean }) {
  const { can } = useAuth()
  return (
    <nav className="flex flex-col gap-4 px-3">
      {NAV.map(g => {
        const items = g.items.filter(i => allowed(can, i.perm))
        if (!items.length) return null
        return (
          <div key={g.group || 'main'}>
            {g.group && (mini ? <div className="mx-2.5 mb-2 border-t" /> : <div className="mb-1 px-2.5 text-xs text-text-4">{g.group}</div>)}
            <div className="flex flex-col gap-0.5">
              {items.map(i => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={onPick} title={mini ? i.label : undefined} aria-label={mini ? i.label : undefined}
                  className={({ isActive }) => cn('relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 transition-colors hover:bg-secondary hover:text-foreground',
                    mini && 'justify-center px-0',
                    isActive && 'bg-blue-bg font-medium text-blue hover:bg-blue-bg hover:text-blue')}>
                  {({ isActive }) => <>{isActive && !mini && <span className="jb-nav-ind" />}<i.icon className="size-4 shrink-0" strokeWidth={1.8} />{!mini && i.label}</>}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function Brand({ mini, onToggle }: { mini?: boolean; onToggle?: () => void }) {
  const Icon = mini ? PanelLeftOpen : PanelLeftClose
  const btn = onToggle && <button type="button" onClick={onToggle} title={mini ? '展开侧边栏' : '收起侧边栏'} aria-label={mini ? '展开侧边栏' : '收起侧边栏'} className="flex size-8 flex-none items-center justify-center rounded-md text-text-4 hover:bg-secondary hover:text-foreground"><Icon className="size-4" /></button>
  if (mini) return <div className="flex flex-col items-center gap-2"><img src="/logo.png" alt="JomBelajar" className="size-7 rounded-lg" />{btn}</div>
  return (
    <div className="flex items-center gap-2.5 pl-5 pr-3">
      <img src="/logo.png" alt="" className="size-7 rounded-lg" />
      <div className="min-w-0 flex-1 leading-tight"><div className="text-sm font-semibold">JomBelajar</div><div className="text-xs text-text-4">管理后台</div></div>
      {btn}
    </div>
  )
}

function UserMenu({ compact, rail }: { compact?: boolean; rail?: boolean }) {
  const { me, logout } = useAuth()
  if (!me) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-blue-bg', compact && 'size-10 justify-center p-0')}>
        <Avatar name={me.user.name || me.user.username} id={me.user.id} size={30} />
        {!compact && <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium">{me.user.name || me.user.username}</div><div className="truncate text-xs text-text-4">{me.user.role.name}</div></div>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} side={rail ? 'right' : compact ? 'bottom' : 'top'} className="w-56">
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
  // 侧边栏可以收成只有图标的窄栏(232 → 68px),选择记在本机
  const [mini, setMini] = useState(() => { try { return localStorage.getItem('jb-side-mini') === '1' } catch { return false } })
  const toggle = () => setMini(m => { try { localStorage.setItem('jb-side-mini', m ? '0' : '1') } catch { /* 无痕模式不记 */ } return !m })
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
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-white py-4 transition-[width] duration-200 lg:flex', mini ? 'w-[68px]' : 'w-[232px]')}>
        <Brand mini={mini} onToggle={toggle} />
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><Nav mini={mini} /></div>
        <div className={cn('border-t pt-3', mini ? 'flex justify-center px-2' : 'px-3')}><UserMenu compact={mini} rail={mini} /></div>
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
      <main className={cn('transition-[padding] duration-200', mini ? 'lg:pl-[68px]' : 'lg:pl-[232px]')}>
        {me?.demo && <div className="bg-warn-bg px-4 py-1.5 text-center text-xs text-warn">演示模式(DEMO=1):不要这样上线</div>}
        <div key={loc.pathname} className="jb-page mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
