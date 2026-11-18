import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

// 拉一个接口:path 变了自动重拉;reload() 手动重拉;旧请求的结果不会盖掉新请求
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const load = useCallback(async () => {
    if (!path) return
    const my = ++seq.current
    setLoading(true)
    try { const d = await api<T>(path); if (my === seq.current) { setData(d); setError('') } }
    catch (e) { if (my === seq.current) setError((e as Error).message) }
    finally { if (my === seq.current) setLoading(false) }
  }, [path])
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load, setData }
}

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}
