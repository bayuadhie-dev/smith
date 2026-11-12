import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { useAppSelector } from '../../hooks/redux'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

type Tone = 'warn' | 'bad' | null
interface Item { key: string; label: string; value: number | null; format: 'number' | 'currency' | 'percent'; tone: Tone }
interface Headline { key: string; label: string; value: number; format: 'number' | 'currency' | 'percent'; delta: number | null; delta_label: string | null; tone?: Tone }
interface Point { date: string; value: number }
interface ModuleSummary { key: string; title: string; href: string; items: Item[] }
interface ActionRow { key: string; label: string; count: number; href: string; tone: 'warn' | 'bad' }
interface ActivityRow { user_name?: string; action?: string; module?: string; entity_type?: string; timestamp?: string }

const formatValue = (it: Item) => {
  if (it.value === null || it.value === undefined) return '-'
  if (it.format === 'currency') return formatRupiah(it.value)
  if (it.format === 'percent') return `${it.value.toLocaleString('id-ID')}%`
  return it.value.toLocaleString('id-ID')
}

const toneText = (tone: Tone) =>
  tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'

const sapaan = () => {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}


const TrendCard = ({ title, data, currency }: { title: string; data: Point[]; currency?: boolean }) => {
  const total = data.reduce((a, b) => a + b.value, 0)
  const fmt = (v: number) => (currency ? formatRupiah(v) : v.toLocaleString('id-ID'))
  return (
    <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">Total {fmt(total)}</span>
      </div>
      <div className="h-44 px-2 pb-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${title.length}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--brand-600))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="rgb(var(--brand-600))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis width={44} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}M` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}rb` : String(v))} />
            <Tooltip formatter={(v: number) => [fmt(v), '']} labelFormatter={(d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} />
            <Area type="monotone" dataKey="value" stroke="rgb(var(--brand-600))" strokeWidth={2} fill={`url(#g-${title.length})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

const DashboardModules = () => {
  useDocumentTitle('Dashboard')
  const user = useAppSelector((s: any) => s.auth?.user)
  const nama = (user?.full_name || user?.username || '').split(' ')[0]

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-modules'],
    queryFn: () => axiosInstance.get('/api/dashboard/modules').then((r) => r.data as { modules: ModuleSummary[]; actions: ActionRow[]; headline: Headline[]; trends: { output?: Point[]; sales?: Point[] } }),
    refetchInterval: 120000,
  })

  const { data: activity } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => axiosInstance.get('/api/executive/real-audit-logs').then((r) => (r.data?.logs || []) as ActivityRow[]),
    retry: false,
  })

  const modules = data?.modules || []
  const actions = data?.actions || []
  const headline = data?.headline || []
  const trends = data?.trends || {}
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {sapaan()}{nama ? `, ${nama}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{tanggal}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </div>


      {headline.length > 0 && (
        <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:grid-cols-4">
          {headline.map((h, i) => (
            <div key={h.key} className={`p-4 ${i > 0 ? 'lg:border-l' : ''} ${i % 2 === 1 ? 'border-l lg:border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} border-gray-200 dark:border-gray-700`}>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{h.label}</p>
              <p className={`mt-1 truncate text-2xl font-semibold tabular-nums ${toneText(h.tone || null)}`}>
                {h.format === 'currency' ? formatRupiah(h.value) : h.value.toLocaleString('id-ID')}
              </p>
              {h.delta !== null && h.delta !== undefined ? (
                <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${h.delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {h.delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(h.delta).toLocaleString('id-ID')}%
                  <span className="font-normal text-gray-400">{h.delta_label}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">&nbsp;</p>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">Perlu tindakan</h2>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        ) : actions.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">Tidak ada yang perlu ditindak saat ini.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {actions.map((a) => (
              <li key={a.key}>
                <Link to={a.href} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <span className="flex items-center gap-3">
                    <span className={`inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-xs font-semibold ${a.tone === 'bad' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                      {a.count.toLocaleString('id-ID')}
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">{a.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>


      {(trends.output || trends.sales) && (
        <div className="grid gap-4 md:grid-cols-2">
          {trends.output && <TrendCard title="Output produksi, 14 hari terakhir" data={trends.output} />}
          {trends.sales && <TrendCard title="Pesanan penjualan, 14 hari terakhir" data={trends.sales} currency />}
        </div>
      )}

      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Ringkasan gagal dimuat. Coba muat ulang.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((m) => (
          <section key={m.key} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{m.title}</h2>
              <Link to={m.href} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Buka modul</Link>
            </div>
            <div className="p-4">
              {m.items[0] && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.items[0].label}</p>
                  <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${toneText(m.items[0].tone)}`}>{formatValue(m.items[0])}</p>
                </div>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-3 dark:border-gray-700 sm:grid-cols-3">
                {m.items.slice(1).map((it) => (
                  <div key={it.key} className="min-w-0">
                    <dt className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {it.tone && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.tone === 'bad' ? 'bg-red-500' : 'bg-amber-500'}`} />}
                      <span className="truncate">{it.label}</span>
                    </dt>
                    <dd className={`mt-0.5 truncate text-base font-semibold tabular-nums ${toneText(it.tone)}`}>{formatValue(it)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        ))}
      </div>

      {!isLoading && !isError && modules.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Akun ini belum punya akses ke modul mana pun. Hubungi admin.</p>
      )}

      {activity && activity.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Aktivitas terbaru</h2>
            <Link to="/app/settings/audit-trail" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Lihat semua</Link>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {activity.slice(0, 6).map((a, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                  <span className="font-medium">{a.user_name}</span> {(a.action || '').toLowerCase()} {a.module || a.entity_type}
                </span>
                <span className="shrink-0 text-xs text-gray-400">{(a.timestamp || '').toString().replace('T', ' ').slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default DashboardModules
