import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDebounce } from '../../hooks/useDebounce'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  UserIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  TruckIcon,
  ReceiptPercentIcon,
  InboxArrowDownIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import { typeLabel, typeRank, TYPE_HINTS } from '../../utils/searchTypes'
import { useUrlFilter } from '../../hooks/useUrlState'

interface SearchResult {
  id: string | number
  type: string
  module: string
  title: string
  subtitle: string
  description: string
  url: string
  icon: string
  color: string
  metadata: Record<string, any>
}

/** Ikon per jenis hasil; dokumen transaksi tidak mengirim field icon dari server. */
const TYPE_ICON: Record<string, any> = {
  'Surat Jalan': TruckIcon,
  'Faktur Penjualan': ReceiptPercentIcon,
  'Faktur Pembelian': ReceiptPercentIcon,
  'Penerimaan Barang': InboxArrowDownIcon,
}

const ICON_MAP: Record<string, any> = {
  cube: CubeIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  'shopping-cart': ShoppingCartIcon,
  user: UserIcon,
  'shopping-bag': ShoppingBagIcon,
  'building-storefront': BuildingStorefrontIcon,
  'document-text': DocumentTextIcon,
  users: UsersIcon,
}

const MODULES = [
  { value: 'all', label: 'Semua modul' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'finance', label: 'Finance' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'production', label: 'Production' },
  { value: 'products', label: 'Produk' },
  { value: 'hr', label: 'HR' },
  { value: 'dcc', label: 'Dokumen' },
]

/** Nama field metadata dari server, supaya tidak tampil sebagai kata Inggris. */
const META_LABEL: Record<string, string> = {
  status: 'Status', category: 'Kategori', date: 'Tanggal', total: 'Total',
  priority: 'Prioritas', department: 'Departemen', type: 'Jenis',
}

// Nilai status yang datang apa adanya dari basis data.
const NILAI_LABEL: Record<string, string> = {
  active: 'Aktif', inactive: 'Nonaktif', draft: 'Draf', approved: 'Disetujui',
  rejected: 'Ditolak', pending: 'Menunggu', completed: 'Selesai',
  cancelled: 'Dibatalkan', open: 'Terbuka', closed: 'Tutup',
  in_progress: 'Dikerjakan', paid: 'Lunas', unpaid: 'Belum dibayar',
  high: 'Tinggi', medium: 'Sedang', low: 'Rendah',
}

export default function GlobalSearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [moduleFilter, setModuleFilter] = useUrlFilter<string>('modul', 'all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [recent, setRecent] = useState<string[]>([])

  const debounced = useDebounce(query, 300)

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) { try { setRecent(JSON.parse(saved)) } catch { setRecent([]) } }
  }, [])

  const saveToRecent = (q: string) => {
    if (!q.trim()) return
    setRecent((prev) => {
      const next = [q, ...prev.filter((s) => s !== q)].slice(0, 10)
      localStorage.setItem('recentSearches', JSON.stringify(next))
      return next
    })
  }

  const performSearch = useCallback(async (q: string, module: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await axiosInstance.get('/api/search/global', { params: { q, module, limit: 50 } })
      if (res.data?.success) {
        const rows: SearchResult[] = res.data.data.results || []
        setResults([...rows].sort((a, b) => typeRank(a.type) - typeRank(b.type)))
        saveToRecent(q)
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!debounced) { setResults([]); return }
    performSearch(debounced, moduleFilter)
    setSearchParams({ q: debounced }, { replace: true })
  }, [debounced, moduleFilter])

  const clearQuery = () => { setQuery(''); setResults([]) }

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/app')}
            className="mb-3 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Kembali ke Dashboard
          </button>
          <div className="fn-label mb-1.5">PENCARIAN</div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">Pencarian</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 sm:text-base">Cari dokumen dan data di seluruh modul.</p>
        </div>

        <div className="card mb-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); clearQuery() } }}
                placeholder="Nomor dokumen, nama barang, pelanggan, atau nama jenis dokumen..."
                aria-label="Kata pencarian"
                className="input-field py-3 pl-10 pr-10"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  aria-label="Hapus pencarian"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                showFilters
                  ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/30 dark:text-primary-200'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <FunnelIcon className="h-5 w-5" aria-hidden="true" />
              Saring
            </button>
          </div>

          {showFilters && (
            <div className="ui-pop mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Saring menurut modul</p>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setModuleFilter(m.value)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      moduleFilter === m.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Bisa juga diketik nama jenis dokumennya, misalnya {TYPE_HINTS.slice(0, 4).map((h, i) => (
              <span key={h}>
                {i > 0 && ', '}
                <button type="button" onClick={() => setQuery(h)} className="font-medium text-primary-700 hover:underline dark:text-primary-300">{h}</button>
              </span>
            ))} — hasilnya 10 dokumen terbaru jenis itu.
          </p>
        </div>

        {!query && recent.length > 0 && (
          <div className="card mb-6 p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                <ClockIcon className="h-5 w-5" aria-hidden="true" />
                Pencarian terakhir
              </h2>
              <button
                type="button"
                onClick={() => { setRecent([]); localStorage.removeItem('recentSearches') }}
                className="shrink-0 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              >
                Bersihkan
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setQuery(r)}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="card space-y-3 p-4 sm:p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="ui-shimmer h-11 w-11 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="ui-shimmer h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="ui-shimmer h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && query && (
          <div className="card overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                {results.length} hasil untuk &quot;{query}&quot;
              </h2>
            </div>

            {results.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {results.map((r, i) => {
                  const Icon = TYPE_ICON[r.type] || ICON_MAP[r.icon] || CubeIcon
                  const meta = Object.entries(r.metadata || {}).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'N/A')
                  return (
                    <li key={`${r.type}-${r.id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => navigate(r.url)}
                        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 sm:gap-4 sm:px-6"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 sm:h-12 sm:w-12">
                          <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-all font-semibold text-gray-900 dark:text-white">{r.title}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {typeLabel(r.type)}
                            </span>
                          </span>
                          {r.subtitle && <span className="mt-0.5 block truncate text-sm text-gray-600 dark:text-gray-300">{r.subtitle}</span>}
                          {r.description && <span className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{r.description}</span>}
                          {meta.length > 0 && (
                            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {meta.map(([k, v]) => (
                                <span key={k} className="text-xs text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">{META_LABEL[k] || k}:</span> {NILAI_LABEL[String(v)] || String(v)}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <ChevronRightIcon className="mt-1 hidden h-5 w-5 shrink-0 text-gray-400 sm:block" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-4 py-12 text-center sm:px-6">
                <MagnifyingGlassIcon className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                <p className="text-gray-600 dark:text-gray-300">Tidak ada hasil untuk &quot;{query}&quot;.</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Coba kata lain, atau ketik nama jenis dokumennya.</p>
              </div>
            )}
          </div>
        )}

        {!loading && !query && recent.length === 0 && (
          <div className="card p-8 text-center sm:p-12">
            <MagnifyingGlassIcon className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Mulai mencari</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300 sm:text-base">
              Ketik nomor dokumen, nama barang atau pelanggan, atau langsung nama jenis dokumennya.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {TYPE_HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setQuery(h)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
