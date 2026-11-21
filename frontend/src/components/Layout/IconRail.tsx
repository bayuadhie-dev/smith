import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, CheckCircle2, Bell, MessagesSquare, PanelLeft } from 'lucide-react'
import ThemeToggle from '../Common/ThemeToggle'

/**
 * Rel ikon paling kiri - lapisan di atas sidebar menu.
 *
 * Isinya bukan modul (modul tetap di sidebar), melainkan tempat yang dituju
 * dari halaman mana pun: beranda, pencarian, persetujuan, notifikasi, obrolan.
 * Warnanya ikut warna sidebar perusahaan: Falmaco gunmetal, Fengsheng forest.
 */

const LINKS = [
  { to: '/app', end: true, label: 'Beranda', Icon: Home },
  { to: '/app/search', end: false, label: 'Cari (Ctrl+K)', Icon: Search },
  { to: '/app/approval', end: false, label: 'Persetujuan', Icon: CheckCircle2 },
  { to: '/app/notifications', end: false, label: 'Notifikasi', Icon: Bell },
  { to: '/app/chat', end: false, label: 'Obrolan', Icon: MessagesSquare },
]

export default function IconRail({ companyName, logo, onToggleSidebar }: {
  companyName?: string
  logo?: string
  onToggleSidebar?: () => void
}) {
  const { pathname } = useLocation()
  const initials = (companyName || 'ERP')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'E'

  return (
    <aside
      className="sidebar-themed fixed inset-y-0 left-0 z-50 hidden w-14 flex-col items-center gap-3 py-3 lg:flex"
      aria-label="Pintasan utama"
    >
      <NavLink
        to="/app"
        title={companyName || 'Beranda'}
        className="fn-press flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-[11px] font-semibold text-white ring-1 ring-white/15"
      >
        {logo ? <img src={logo} alt="" className="h-full w-full object-contain p-0.5" /> : initials}
      </NavLink>

      <nav className="flex flex-col items-center gap-1 rounded-full bg-black/15 p-1.5">
        {LINKS.map(({ to, end, label, Icon }) => {
          const active = end ? pathname === to : pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className={`fn-press flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-white text-gray-900' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </NavLink>
          )
        })}
      </nav>

      {/* Nama perusahaan dibaca memanjang di sisa ruang kosong rel. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <span
          className="fn-label whitespace-nowrap text-white/25"
          style={{ writingMode: 'vertical-rl' }}
        >
          {(companyName || 'ERP').toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-white/70">
        <ThemeToggle collapsed />
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Ciutkan / lebarkan menu"
            aria-label="Ciutkan atau lebarkan menu"
            className="fn-press flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 hover:text-white"
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </aside>
  )
}
