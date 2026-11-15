import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import type { DataHit } from '../../hooks/useDataSearch'
import type { MenuEntry } from '../../utils/menuIndex'

/** Nama jenis data dari API pencarian, dalam Bahasa Indonesia. */
const TYPE_LABEL: Record<string, string> = {
  'Work Order': 'SPK',
  Product: 'Produk',
  Customer: 'Pelanggan',
  Supplier: 'Pemasok',
  Employee: 'Karyawan',
  Document: 'Dokumen',
}

const Header = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 mt-1 flex items-center gap-2 px-3">
    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{children}</span>
    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
  </div>
)

interface Props {
  query: string
  menuHits: MenuEntry[]
  dataHits: DataHit[]
  loading: boolean
  /** Dipanggil setelah sebuah hasil dibuka, untuk mengosongkan kotak pencarian. */
  onPick: () => void
}

export default function SidebarSearchResults({ query, menuHits, dataHits, loading, onPick }: Props) {
  const groups: { type: string; items: DataHit[] }[] = []
  dataHits.forEach((h) => {
    const last = groups[groups.length - 1]
    if (last && last.type === h.type) last.items.push(h)
    else groups.push({ type: h.type, items: [h] })
  })

  const empty = !menuHits.length && !dataHits.length && !loading

  return (
    <div className="space-y-4" aria-live="polite">
      {menuHits.length > 0 && (
        <div>
          <Header>Menu</Header>
          <ul className="space-y-0.5">
            {menuHits.map((m) => (
              <li key={`${m.href}-${m.label}`}>
                <NavLink
                  to={m.href}
                  end
                  onClick={onPick}
                  className={({ isActive }) =>
                    clsx(
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
                      'flex items-start gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                    )
                  }
                >
                  {m.icon ? <m.icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" /> : <span className="w-5 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block truncate">{m.label}</span>
                    {m.path.length > 0 && (
                      <span className="block truncate text-[11px] font-normal text-gray-400 dark:text-gray-500">{m.path.join(' › ')}</span>
                    )}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <Header>Data</Header>
          <ul className="space-y-0.5">
            {groups.map((g) => (
              <li key={g.type}>
                <p className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">{TYPE_LABEL[g.type] || g.type}</p>
                <ul className="space-y-0.5">
                  {g.items.map((h) => (
                    <li key={`${h.type}-${h.id}`}>
                      <NavLink
                        to={h.url}
                        onClick={onPick}
                        className="block rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                      >
                        <span className="block truncate font-medium">{h.title}</span>
                        {h.subtitle && <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">{h.subtitle}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <div className="space-y-2 px-3">
          {[0, 1, 2].map((i) => <div key={i} className="ui-shimmer h-4 rounded bg-gray-200 dark:bg-gray-700" />)}
        </div>
      )}

      {empty && (
        <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Tidak ada menu atau data untuk &quot;{query}&quot;.
        </p>
      )}

      {query.trim().length >= 2 && !loading && (
        <NavLink
          to={`/app/search?q=${encodeURIComponent(query.trim())}`}
          onClick={onPick}
          className="block rounded-lg px-3 py-2 text-xs font-medium text-primary-700 hover:bg-gray-100 dark:text-primary-300 dark:hover:bg-gray-800"
        >
          Lihat semua hasil pencarian
        </NavLink>
      )}
    </div>
  )
}
