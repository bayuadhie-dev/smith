import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export type KpiTone = 'warn' | 'bad' | 'good' | null

export interface KpiItem {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: KpiTone
  to?: string
}

const toneClass = (tone?: KpiTone) =>
  tone === 'bad' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-gray-900 dark:text-white'

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
)

export const KpiStrip = ({ items }: { items: KpiItem[] }) => (
  <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:grid-flow-col lg:auto-cols-fr">
    {items.map((it, i) => {
      const body = (
        <>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{it.label}</p>
          <p className={`mt-1 truncate text-2xl font-semibold tabular-nums ${toneClass(it.tone)}`}>{it.value}</p>
          <p className="mt-1 truncate text-xs text-gray-400">{it.hint || ' '}</p>
        </>
      )
      const cls = `block p-4 ${i % 2 === 1 ? 'border-l' : ''} ${i > 0 ? 'lg:border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} border-gray-200 dark:border-gray-700`
      return it.to ? (
        <Link key={it.label} to={it.to} className={`${cls} hover:bg-gray-50 dark:hover:bg-gray-700/40`}>{body}</Link>
      ) : (
        <div key={it.label} className={cls}>{body}</div>
      )
    })}
  </section>
)

export const QuickLinks = ({ title = 'Pintasan', links }: { title?: string; links: { to: string; label: string }[] }) => (
  <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">{title}</h2>
    <ul className="grid divide-gray-100 dark:divide-gray-700 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((l) => (
        <li key={l.to} className="border-b border-gray-100 dark:border-gray-700">
          <Link to={l.to} className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/40">
            {l.label}
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        </li>
      ))}
    </ul>
  </section>
)

export const Panel = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)
