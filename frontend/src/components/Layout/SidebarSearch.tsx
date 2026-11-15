import { useRef } from 'react'
import { ArrowPathIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Pencarian data sedang berjalan. */
  loading?: boolean
}

/** Kotak pencarian sidebar: menyaring menu dan memicu pencarian data (hasilnya tampil di bawah, di dalam sidebar). */
export default function SidebarSearch({ value, onChange, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative shrink-0">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onChange('') } }}
        placeholder="Cari menu atau data... (Ctrl+K)"
        aria-label="Cari menu atau data"
        className="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-8 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-600/50 focus:bg-gray-50 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-700 [&::-webkit-search-cancel-button]:hidden"
      />
      {loading ? (
        <ArrowPathIcon className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />
      ) : value ? (
        <button
          type="button"
          onClick={() => { onChange(''); inputRef.current?.focus() }}
          aria-label="Hapus pencarian"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
