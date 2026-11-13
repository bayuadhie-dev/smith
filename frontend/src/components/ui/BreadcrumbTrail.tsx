import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export interface TrailCrumb {
  label: string
  /** Query string tujuan, mis. '?tab=downtime&mesin=3'. Kosong = crumb terakhir (halaman aktif). */
  search?: string
}

export interface TrailItem {
  label: string
  go?: () => void
}

interface TrailState {
  owner: string
  root: () => void
  items: TrailItem[]
}

interface TrailApi {
  trail: TrailState | null
  set: (t: TrailState) => void
  clear: (owner: string) => void
}

const Ctx = createContext<TrailApi | null>(null)

/** Tab workspace yang tidak aktif (disembunyikan) tidak boleh mengatur breadcrumb. */
export const TabActiveContext = createContext<{ tabId: string; active: boolean } | null>(null)

export function BreadcrumbTrailProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<TrailState | null>(null)
  const set = useCallback((t: TrailState) => setTrail(t), [])
  const clear = useCallback((owner: string) => setTrail((cur) => (cur && cur.owner === owner ? null : cur)), [])
  const value = useMemo(() => ({ trail, set, clear }), [trail, set, clear])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTrail(): TrailState | null {
  return useContext(Ctx)?.trail ?? null
}

/**
 * Halaman mendaftarkan rantai drill-down (setelah crumb rute), mis.
 * [{ label: 'Downtime', search: '?tab=downtime' }, { label: 'Mesin 3' }].

 * Beri null untuk tidak menyentuh breadcrumb (mis. halaman yang sedang ditanam di halaman lain).
 * Crumb dengan search bisa diklik untuk kembali ke tingkat itu; Back browser ikut menelusurinya.
 */
export function useBreadcrumbTrail(input: TrailCrumb[] | null) {
  const crumbs = input ?? []
  const api = useContext(Ctx)
  const tabCtx = useContext(TabActiveContext)
  const navigate = useNavigate()
  const location = useLocation()
  const owner = tabCtx?.tabId ?? 'main'
  const active = tabCtx ? tabCtx.active : true
  const pathname = location.pathname
  const key = crumbs.map((c) => `${c.label}|${c.search ?? ''}`).join('>')

  useEffect(() => {
    if (!api || !active || input === null) return
    const items: TrailItem[] = crumbs.map((c, i) => ({
      label: c.label,
      go: i < crumbs.length - 1 && c.search !== undefined ? () => navigate({ pathname, search: c.search }) : undefined,
    }))
    api.set({ owner, root: () => navigate({ pathname, search: '' }), items })
    return () => api.clear(owner)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, owner, pathname, input === null])
}
