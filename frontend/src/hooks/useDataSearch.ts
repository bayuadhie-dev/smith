import { useEffect, useState } from 'react'
import axiosInstance from '../utils/axiosConfig'
import { useDebounce } from './useDebounce'
import { typeRank } from '../utils/searchTypes'

export interface DataHit {
  id: number | string
  type: string
  module: string
  title: string
  subtitle?: string
  url: string
}

/** Pencarian data lintas modul (hasil disaring izin pengguna di server). */
export function useDataSearch(term: string, opts?: { perType?: number; total?: number; minChars?: number }) {
  const perType = opts?.perType ?? 4
  const total = opts?.total ?? 14
  const minChars = opts?.minChars ?? 2
  const debounced = useDebounce(term.trim(), 250)
  const [hits, setHits] = useState<DataHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (debounced.length < minChars) { setHits([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    axiosInstance.get('/api/search/global', { params: { q: debounced, limit: 60 } })
      .then((r) => {
        if (cancelled) return
        const raw: DataHit[] = r.data?.data?.results || []
        const seen: Record<string, number> = {}
        const capped = raw.filter((h) => {
          seen[h.type] = (seen[h.type] || 0) + 1
          return seen[h.type] <= perType
        })
        capped.sort((a, b) => typeRank(a.type) - typeRank(b.type))
        setHits(capped.slice(0, total))
      })
      .catch(() => { if (!cancelled) setHits([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debounced, perType, total, minChars])

  return { hits, loading, ready: debounced === term.trim() }
}
