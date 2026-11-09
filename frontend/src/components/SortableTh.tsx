import { useMemo, useState } from 'react'

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

export function useSort<T>(rows: T[], accessors: Record<string, (r: T) => string | number | null | undefined>, initial: SortState = null) {
  const [sort, setSort] = useState<SortState>(initial)
  const toggle = (key: string) => setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  const sorted = useMemo(() => {
    if (!sort || !accessors[sort.key]) return rows
    const get = accessors[sort.key]
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b)
      if (x == null || x === '') return y == null || y === '' ? 0 : 1
      if (y == null || y === '') return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * mul
      return String(x).localeCompare(String(y), 'id', { numeric: true }) * mul
    })
  }, [rows, sort, accessors])
  return { sorted, sort, toggle }
}

export default function SortableTh({ label, k, sort, toggle, className = '' }: { label: string; k: string; sort: SortState; toggle: (k: string) => void; className?: string }) {
  const active = sort?.key === k
  return (
    <th className={className} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 font-medium hover:text-gray-900 dark:hover:text-white" title="Klik untuk mengurutkan">
        {label}
        <span className={active ? 'text-emerald-600' : 'text-gray-300'}>{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}
