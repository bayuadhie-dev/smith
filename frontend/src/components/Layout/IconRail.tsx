import { NavLink, useLocation } from 'react-router-dom'
import { Home, CheckCircle2, Bell, MessagesSquare, PanelLeft } from 'lucide-react'
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
  { to: '/app/approval', end: false, label: 'Persetujuan', Icon: CheckCircle2 },
  { to: '/app/notifications', end: false, label: 'Notifikasi', Icon: Bell },
  { to: '/app/chat', end: false, label: 'Obrolan', Icon: MessagesSquare },
]

export default function IconRail({ onToggleSidebar }: {
  onToggleSidebar?: () => void
}) {
  const { pathname } = useLocation()

  return (
    <aside
      className="sidebar-themed fixed inset-y-0 left-0 z-50 hidden w-14 flex-col items-center gap-3 py-3.5 lg:flex"
      aria-label="Pintasan utama"
    >
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

      <div className="min-h-0 flex-1" />

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
