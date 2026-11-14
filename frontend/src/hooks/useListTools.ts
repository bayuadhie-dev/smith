import { useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useUrlState } from './useUrlState'

export type CellValue = string | number | null | undefined

export interface ListColumn<T> {
  key: string
  label: string
  /** Nilai mentah untuk urut, cari, dan ekspor (angka tetap angka, tanggal ISO string). */
  value: (row: T) => CellValue
  /** Nilai khusus untuk Excel bila beda dari value (mis. nama status berbahasa Indonesia). */
  exportValue?: (row: T) => CellValue
  type?: 'text' | 'number' | 'date'
  sortable?: boolean
  /** false = tidak ikut ekspor/cari (mis. kolom aksi). */
  exportable?: boolean
}

export interface ListTools<T> {
  rows: T[]
  total: number
  query: string
  setQuery: (q: string) => void
  sortKey: string
  sortDir: 'asc' | 'desc'
  toggleSort: (key: string) => void
  columns: ListColumn<T>[]
  exportExcel: () => void
  /** Periode tanggal (ISO). Kosong = semua. null bila daftar tidak punya kolom tanggal. */
  period: { from: string; to: string; all: boolean; label: string } | null
  setPeriod: (from: string, to: string) => void
  setPeriodAll: () => void
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

function cmp(a: CellValue, b: CellValue, type: ListColumn<any>['type']) {
  const ea = a === null || a === undefined || a === ''
  const eb = b === null || b === undefined || b === ''
  if (ea && eb) return 0
  if (ea) return 1
  if (eb) return -1
  if (type === 'number') return Number(a) - Number(b)
  if (type === 'date') return new Date(String(a)).getTime() - new Date(String(b)).getTime()
  return collator.compare(String(a), String(b))
}

function isoToLocal(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v
}

/**
 * Standar daftar transaksi: kolom bisa diurutkan (klik header), pencarian di semua kolom, dan ekspor Excel
 * dari baris yang sedang tampil. Urutan dan kata cari disimpan di URL (?sort=kolom:asc&q=...).
 */
export function useListTools<T>(
  data: T[] | undefined | null,
  columns: ListColumn<T>[],
  opts: { filename: string; initialSort?: { key: string; dir?: 'asc' | 'desc' }; paramPrefix?: string; dateColumn?: string; defaultAll?: boolean },
): ListTools<T> {
  const [query, setQueryRaw] = useUrlState<string>(`${opts.paramPrefix || ''}q`, '')
  const pp = opts.paramPrefix || ''
  const dateCol = columns.find((c) => c.key === opts.dateColumn) || columns.find((c) => c.type === 'date')
  const [pFrom, setPFrom] = useUrlState<string>(`${pp}from`, '')
  const [pTo, setPTo] = useUrlState<string>(`${pp}to`, '')
  const [pAll, setPAll] = useUrlState<string>(`${pp}period`, opts.defaultAll ? 'all' : '')
  const today = new Date()
  const defFrom = isoDay(new Date(today.getFullYear(), today.getMonth(), 1))
  const defTo = isoDay(today)
  const allPeriod = pAll === 'all'
  const periodFrom = pFrom || defFrom
  const periodTo = pTo || defTo
  const initial = opts.initialSort ? `${opts.initialSort.key}:${opts.initialSort.dir || 'asc'}` : ''
  const [sort, setSort] = useUrlState<string>(`${opts.paramPrefix || ''}sort`, initial)
  const [sortKey, sortDirRaw] = sort.split(':')
  const sortDir: 'asc' | 'desc' = sortDirRaw === 'desc' ? 'desc' : 'asc'

  const setQuery = useCallback((q: string) => setQueryRaw(q, { replace: true }), [setQueryRaw])

  const toggleSort = useCallback((key: string) => {
    const [k, d] = sort.split(':')
    if (k !== key) setSort(`${key}:asc`)
    else if (d !== 'desc') setSort(`${key}:desc`)
    else setSort('')
  }, [sort, setSort])

  const rows = useMemo(() => {
    let list = (data || []).slice()
    if (dateCol && !allPeriod) {
      list = list.filter((r) => {
        const v = dateCol.value(r)
        if (v === null || v === undefined || v === '') return true
        const d = String(v).slice(0, 10)
        return d >= periodFrom && d <= periodTo
      })
    }
    const q = query.trim().toLowerCase()
    if (q) {
      const searchable = columns.filter((c) => c.exportable !== false)
      list = list.filter((r) => searchable.some((c) => {
        const v = c.exportValue ? c.exportValue(r) : c.value(r)
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      }))
    }
    const col = columns.find((c) => c.key === sortKey)
    if (col) {
      const f = sortDir === 'desc' ? -1 : 1
      list.sort((a, b) => f * cmp(col.value(a), col.value(b), col.type))
    }
    return list
  }, [data, columns, query, sortKey, sortDir, dateCol, allPeriod, periodFrom, periodTo])

  const exportExcel = useCallback(() => {
    const cols = columns.filter((c) => c.exportable !== false)
    const head = cols.map((c) => c.label)
    const body = rows.map((r) => cols.map((c) => {
      const v = c.exportValue ? c.exportValue(r) : c.value(r)
      if (v === null || v === undefined) return ''
      if (c.type === 'date' && typeof v === 'string') return isoToLocal(v)
      if (c.type === 'number') return Number(v)
      return v
    }))
    const ws = XLSX.utils.aoa_to_sheet([head, ...body])
    ws['!cols'] = cols.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, opts.filename.slice(0, 31))
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    XLSX.writeFile(wb, `${opts.filename}_${stamp}.xlsx`)
  }, [columns, rows, opts.filename])

  const setPeriod = useCallback((from: string, to: string) => { setPAll(''); setPFrom(from); setPTo(to) }, [setPAll, setPFrom, setPTo])
  const setPeriodAll = useCallback(() => { setPAll('all'); setPFrom(''); setPTo('') }, [setPAll, setPFrom, setPTo])
  const period = dateCol ? { from: periodFrom, to: periodTo, all: allPeriod, label: dateCol.label } : null

  return { period, setPeriod, setPeriodAll, rows, total: (data || []).length, query, setQuery, sortKey: sortKey || '', sortDir, toggleSort, columns, exportExcel }
}
