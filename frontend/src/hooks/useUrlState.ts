import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

type SetOptions = { replace?: boolean }

/**
 * State halaman yang disimpan di URL (?key=value). Tab dan drill-down yang memakai ini
 * ikut tombol Back/Forward browser dan bisa dibagikan lewat tautan.
 */
export function useUrlState<T extends string>(key: string, defaultValue: T, allowed?: readonly T[]) {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value = (raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? raw : defaultValue) as T

  const set = useCallback((next: T | ((prev: T) => T), opts?: SetOptions) => {
    setParams((prev) => {
      const current = (() => {
        const r = prev.get(key)
        return (r !== null && (!allowed || (allowed as readonly string[]).includes(r)) ? r : defaultValue) as T
      })()
      const v = typeof next === 'function' ? (next as (p: T) => T)(current) : next
      const out = new URLSearchParams(prev)
      if (v === defaultValue || v === '' || v === null || v === undefined) out.delete(key)
      else out.set(key, String(v))
      return out
    }, { replace: opts?.replace })
  }, [key, defaultValue, allowed, setParams])

  return [value, set] as const
}

/** Id (angka) pilihan di URL, null bila tidak ada. */
export function useUrlNumber(key: string) {
  const [raw, setRaw] = useUrlState<string>(key, '')
  const n = raw !== '' && /^\d+$/.test(raw) ? Number(raw) : null
  const set = useCallback((next: number | null, opts?: SetOptions) => setRaw(next === null ? '' : String(next), opts), [setRaw])
  return [n, set] as const
}
