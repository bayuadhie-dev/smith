import AnimatedValue from './AnimatedValue'
import CountUp from '../motion/CountUp'
import { Link } from 'react-router-dom'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import type { ReactNode } from 'react'

export type KpiTone = 'warn' | 'bad' | 'good' | null

export interface KpiItem {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: KpiTone
  to?: string
  onClick?: () => void
}

const toneClass = (tone?: KpiTone) =>
  tone === 'bad' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-gray-900 dark:text-white'

export const PageHeader = ({ title, subtitle, eyebrow, actions }: {
  title: string
  subtitle?: string
  /** Baris kecil di atas judul, huruf kapital mono. Biasanya jejak lokasi: "GUDANG \u203a LOKASI". */
  eyebrow?: string
  actions?: ReactNode
}) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      {eyebrow && <div className="fn-label mb-1.5">{eyebrow}</div>}
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
)

export const KpiStrip = ({ items }: { items: KpiItem[] }) => (
  <section className="fn-card grid grid-cols-2 overflow-hidden lg:grid-flow-col lg:auto-cols-fr">
    {items.map((it, i) => {
      const body = (
        <>
          <p className="fn-label truncate">{it.label}</p>
          <p className={`mt-1.5 truncate text-2xl font-semibold tabular-nums ${toneClass(it.tone)}`}><AnimatedValue value={it.value} /></p>
          <p className="mt-1 truncate text-xs text-gray-400">{it.hint || ' '}</p>
        </>
      )
      const cls = `block p-4 ${i % 2 === 1 ? 'border-l' : ''} ${i > 0 ? 'lg:border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} border-gray-200/70 dark:border-gray-700/70`
      if (it.onClick) {
        return (
          <button key={it.label} type="button" onClick={it.onClick} className={`${cls} w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/40`}>{body}</button>
        )
      }
      return it.to ? (
        <Link key={it.label} to={it.to} className={`${cls} hover:bg-gray-50 dark:hover:bg-gray-700/40`}>{body}</Link>
      ) : (
        <div key={it.label} className={cls}>{body}</div>
      )
    })}
  </section>
)

export const QuickLinks = ({ title = 'Pintasan', links }: { title?: string; links: { to: string; label: string }[] }) => (
  <section className="fn-card overflow-hidden">
    <h2 className="fn-label border-b border-gray-200/70 px-4 py-3 dark:border-gray-700/70">{title}</h2>
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

export const Panel = ({ title, action, children, loading }: {
  title: string
  action?: ReactNode
  children: ReactNode
  /** Selama true, kartu berkilau menyapu - bukan kotak abu-abu kedap. */
  loading?: boolean
}) => (
  <section className={`fn-card overflow-hidden ${loading ? 'is-loading' : ''}`}>
    <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 px-4 py-3 dark:border-gray-700/70">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

/* =====================================================================
   Tambahan 2026-11-21 - bahasa tampilan baru.

   Potongan yang dipakai berulang di seluruh modul: angka besar sebagai
   pusat perhatian, pita peringatan yang membawa tombolnya sendiri, antrean
   "butuh kamu", pil status, dan strip riwayat mini di dalam baris tabel.
   Warna tetap dari variabel perusahaan - tidak ada warna merek yang
   dipatok di sini.
   ===================================================================== */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted'

const PILL: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-cta-50 text-cta-700 dark:bg-cta-500/15 dark:text-cta-300',
  muted: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
}

const DOT: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-cta-500',
  muted: 'bg-gray-400',
}

/** Pil status kecil dengan titik berwarna di depannya. */
export const StatusPill = ({ tone = 'muted', children, dot = true }: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
}) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${PILL[tone]}`}>
    {dot && <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} />}
    {children}
  </span>
)

/** Pemilih rentang/tampilan: satu baris pil, yang aktif timbul putih. */
export const Segmented = <T extends string>({ value, onChange, options, size = 'md' }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  size?: 'sm' | 'md'
}) => (
  <div className={`inline-flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        title={o.title}
        onClick={() => onChange(o.value)}
        className={`fn-press rounded-full px-3 ${size === 'sm' ? 'py-1' : 'py-1.5'} font-medium transition-colors ${
          o.value === value
            ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
        }`}
        aria-pressed={o.value === value}
      >
        {o.label}
      </button>
    ))}
  </div>
)

/** Ukuran huruf angka pahlawan, mengecil kalau teksnya panjang. */
const ukuranAngka = (value: number, format?: (n: number) => string) => {
  const teks = format ? format(value) : Math.round(value).toLocaleString('id-ID')
  if (teks.length > 16) return 'text-[30px]'
  if (teks.length > 12) return 'text-[38px]'
  if (teks.length > 9) return 'text-[46px]'
  return 'text-[56px]'
}

/**
 * Angka besar yang jadi pusat halaman, beserta perbandingan dan statistik
 * pendampingnya. `right` diisi diagram - lihat RunChart.
 */
export const HeroStat = ({ label, value, format, delta, note, stats, right, loading, action }: {
  label: string
  value: number
  format?: (n: number) => string
  delta?: { dir: 'up' | 'down' | 'flat'; text: string; vs?: string }
  note?: ReactNode
  stats?: { label: string; value: ReactNode }[]
  right?: ReactNode
  loading?: boolean
  action?: ReactNode
}) => (
  <section className={`fn-card overflow-hidden ${loading ? 'is-loading' : ''}`}>
    <div className="flex items-center justify-between gap-3 px-5 pt-4">
      <span className="fn-label">{label}</span>
      {action}
    </div>
    <div className="grid gap-4 px-5 pb-5 pt-2 lg:grid-cols-[minmax(220px,320px)_1fr]">
      <div className="min-w-0">
        {/* Angka rupiah bisa 15 karakter - pada 56px itu melimpah keluar kolom
            dan menimpa diagram di sebelahnya. Ukurannya mengikuti panjang
            teks akhir (bukan nilai sementara saat menghitung naik, supaya
            tidak gonta-ganti ukuran selama animasi). */}
        <div className={`${ukuranAngka(value, format)} min-w-0 break-words font-semibold leading-none tracking-tight text-gray-900 dark:text-white`}>
          <CountUp value={value} format={format} />
        </div>
        {delta && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 font-medium ${
              delta.dir === 'down' ? PILL.bad : delta.dir === 'up' ? PILL.ok : PILL.muted
            }`}>
              {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'} {delta.text}
            </span>
            {delta.vs && <span className="text-gray-500 dark:text-gray-400">{delta.vs}</span>}
          </div>
        )}
        {note && <p className="mt-3 max-w-[260px] text-xs leading-relaxed text-gray-500 dark:text-gray-400">{note}</p>}
        {stats && stats.length > 0 && (
          <dl className="mt-4 space-y-1.5 border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
            {stats.map((st) => (
              <div key={st.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-gray-500 dark:text-gray-400">{st.label}</dt>
                <dd className="fn-num text-xs font-medium text-gray-900 dark:text-white">{st.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {right && <div className="min-w-0">{right}</div>}
    </div>
  </section>
)

/**
 * Pita peringatan yang membawa tindakannya sendiri. Memberi tahu ada masalah
 * tanpa tombol untuk menanganinya cuma memindahkan pekerjaan ke pembacanya.
 */
export const AlertStrip = ({ tone = 'warn', icon, children, actions }: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) => (
  <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-gray-300/70 px-5 py-3 dark:border-gray-600/60">
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${PILL[tone]}`}>{icon}</span>
    <p className="min-w-[200px] flex-1 text-sm text-gray-700 dark:text-gray-200">{children}</p>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
)

/**
 * Strip riwayat mini di dalam satu baris tabel - 24 batang terakhir, yang
 * bermasalah diwarnai merah. Dipakai untuk "24 produksi terakhir", "12 bulan
 * pemakaian", dan sejenisnya.
 */
export const MiniBars = ({ values, bad, title, height = 18 }: {
  values: number[]
  /** Indeks yang ditandai merah (gagal/di luar batas). */
  bad?: number[]
  title?: string
  height?: number
}) => {
  const max = Math.max(1, ...values)
  const flag = new Set(bad || [])
  return (
    <div className="flex items-end gap-[2px]" style={{ height }} title={title}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${flag.has(i) ? 'bg-red-500' : 'bg-gray-400/70 dark:bg-gray-500/70'}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export interface QueueItem {
  id: string | number
  code?: string
  title: ReactNode
  note?: ReactNode
  age?: string
  actions?: ReactNode
}

/** Antrean "butuh kamu": tindakannya ada di kartunya, bukan di halaman lain. */
export const TaskQueue = ({ title = 'Butuh kamu', items, action, footer, empty = 'Tidak ada yang menunggu.' }: {
  title?: string
  items: QueueItem[]
  action?: ReactNode
  footer?: ReactNode
  empty?: ReactNode
}) => (
  <section className="fn-card flex flex-col overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      <span className="fn-num rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-gray-700">{items.length}</span>
      <div className="ml-auto">{action}</div>
    </div>
    <div className="flex-1 space-y-2 px-3 pb-3">
      {items.length === 0 && <p className="px-1 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{empty}</p>}
      {items.map((it) => (
        <article key={it.id} className="fn-card fn-card-sm px-3 py-2.5">
          <div className="flex items-center gap-2">
            {it.code && <span className="fn-label">{it.code}</span>}
            {it.age && <span className="fn-label ml-auto">{it.age}</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{it.title}</p>
          {it.note && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{it.note}</p>}
          {it.actions && <div className="mt-2 flex flex-wrap items-center gap-2">{it.actions}</div>}
        </article>
      ))}
    </div>
    {footer && <div className="fn-label border-t border-gray-200/70 px-4 py-2.5 dark:border-gray-700/70">{footer}</div>}
  </section>
)

/**
 * Perbandingan antar kategori sebagai batang mendatar.
 *
 * Pengganti diagram donat/batang untuk data yang cuma 3-6 kategori: angkanya
 * terbaca langsung (donat memaksa mata menaksir sudut), dan tidak perlu
 * pustaka diagram sama sekali.
 */
export const CategoryBars = ({ items, format, unit }: {
  items: { label: string; value: number; hint?: ReactNode; tone?: Tone }[]
  format?: (n: number) => string
  unit?: string
}) => {
  const max = Math.max(1, ...items.map((i) => i.value))
  const fmt = format || ((n: number) => n.toLocaleString('id-ID'))
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-gray-700 dark:text-gray-200">{it.label}</span>
            <span className="fn-num shrink-0 text-sm font-medium text-gray-900 dark:text-white">
              {fmt(it.value)}{unit ? ` ${unit}` : ''}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700/70">
            <div
              className={`h-full rounded-full ${
                it.tone === 'bad' ? 'bg-red-500' : it.tone === 'warn' ? 'bg-amber-500' : 'bg-gray-800 dark:bg-gray-300'
              }`}
              style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }}
            />
          </div>
          {it.hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{it.hint}</p>}
        </li>
      ))}
    </ul>
  )
}
