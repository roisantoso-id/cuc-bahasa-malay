import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler } from './api'

export type Me = { user: { id: number; username: string; name: string; role: { code: string; name: string } }; permissions: string[]; mustChange: boolean; demo: boolean; audioBase: string }
type Ctx = { me: Me | null; loading: boolean; can: (p: string) => boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setMe(await api<Me>('/me')) } catch { setMe(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { setUnauthorizedHandler(() => setMe(null)); refresh() }, [refresh])
  const logout = async () => { await api('/logout', { method: 'POST', body: {} }).catch(() => {}); setMe(null) }
  const can = (p: string) => !!me && me.permissions.includes(p)
  return <AuthCtx.Provider value={{ me, loading, can, refresh, logout }}>{children}</AuthCtx.Provider>
}
export const useAuth = () => useContext(AuthCtx)
