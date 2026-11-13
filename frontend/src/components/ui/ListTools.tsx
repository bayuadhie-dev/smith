import type { ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, ArrowsUpDownIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import type { ListTools } from '../../hooks/useListTools'

/** Header kolom yang bisa diklik untuk mengurutkan. Pakai sebagai pengganti <th> pada tabel daftar. */
export function SortTh<T>({ tools, col, children, className = '', align }: { tools: ListTools<T>; col: string; children: ReactNode; className?: string; align?: 'right' | 'center' }) {
  const column = tools.columns.find((c) => c.key === col)
  const sortable = column ? column.sortable !== false : false
  const active = tools.sortKey === col
  const aria = active ? (tools.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
  const Icon = active ? (tools.sortDir === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ArrowsUpDownIcon
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''
  return (
    <th className={className} aria-sort={sortable ? (aria as any) : undefined} scope="col">
      {sortable ? (
        <button type="button" onClick={() => tools.toggleSort(col)} className={`inline-flex w-full items-center gap-1 uppercase hover:text-gray-900 dark:hover:text-white ${justify}`} title="Klik untuk mengurutkan">
          <span>{children}</span>
          <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary-600 dark:text-primary-300' : 'text-gray-300 dark:text-gray-600'}`} aria-hidden="true" />
        </button>
      ) : children}
    </th>
  )
}

/** Pencarian, jumlah baris, dan tombol Ekspor Excel di atas tabel daftar. */
export function ListToolbar<T>({ tools, placeholder = 'Cari di semua kolom', extra }: { tools: ListTools<T>; placeholder?: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-sm">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={tools.query}
          onChange={(e) => tools.setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Cari"
          className="input-field pl-9"
        />
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {tools.query ? `${tools.rows.length} dari ${tools.total} baris` : `${tools.total} baris`}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {extra}
        <button type="button" onClick={tools.exportExcel} disabled={tools.rows.length === 0} className="btn-secondary disabled:opacity-50" title="Unduh baris yang tampil sebagai Excel">
          <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Ekspor Excel
        </button>
      </div>
    </div>
  )
}
