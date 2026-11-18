import { Component, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Shell, NAV, allowed } from '@/components/app/Shell'
import { ConfirmProvider, Forbidden, Loading } from '@/components/app/ui'
import { Login } from '@/pages/Login'
import { Account, ForcePassword } from '@/pages/Account'
import { Overview } from '@/pages/Overview'
import { Students } from '@/pages/Students'
import { Words } from '@/pages/Words'
import { Courses } from '@/pages/Courses'
import { Teachers } from '@/pages/Teachers'
import { Users } from '@/pages/Users'
import { Roles } from '@/pages/Roles'
import { Audit } from '@/pages/Audit'

const PAGES: Record<string, () => JSX.Element> = { '/': Overview, '/students': Students, '/words': Words, '/courses': Courses, '/teachers': Teachers, '/users': Users, '/roles': Roles, '/audit': Audit }

// 一个页面出错不至于整个后台白屏
class Boundary extends Component<{ children: ReactNode; k: string }, { err: string }> {
  state = { err: '' }
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  componentDidUpdate(p: { k: string }) { if (p.k !== this.props.k && this.state.err) this.setState({ err: '' }) }
  render() { return this.state.err ? <div className="jb-card px-6 py-10 text-center text-[13px] text-bad">这个页面出错了:{this.state.err}。刷新试试,还不行就把这句话发给技术支持。</div> : this.props.children }
}
function Guard({ children }: { children: ReactNode }) { const l = useLocation(); return <Boundary k={l.pathname}>{children}</Boundary> }

function Routed() {
  const { me, loading, can } = useAuth()
  if (loading) return <Loading />
  if (!me) return <Login />
  if (me.mustChange) return <ForcePassword />
  const items = NAV.flatMap(g => g.items)
  const first = items.find(i => allowed(can, i.perm))
  return (
    <Shell>
      <Guard>
      <Routes>
        {items.map(i => { const P = PAGES[i.to]; return <Route key={i.to} path={i.to} element={allowed(can, i.perm) ? <P /> : i.to === '/' && first ? <Navigate to={first.to} replace /> : <Forbidden />} /> })}
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Guard>
    </Shell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          <ConfirmProvider>
            <Routed />
            <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontSize: 13 } }} />
          </ConfirmProvider>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}
