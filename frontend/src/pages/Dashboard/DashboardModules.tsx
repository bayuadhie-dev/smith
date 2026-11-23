import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { useAppSelector } from '../../hooks/redux'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CountUp, Reveal, Stagger, StaggerItem } from '../../components/motion'
import { AlertStrip, HeroStat, PageHeader, Panel, StatusPill, TaskQueue } from '../../components/ui/PageKit'
import RunChart, { type ChartMode, type RidgeRow } from '../../components/charts/RunChart'

type Tone = 'warn' | 'bad' | null
interface Item { key: string; label: string; value: number | null; format: 'number' | 'currency' | 'percent'; tone: Tone }
interface Headline { key: string; label: string; value: number; format: 'number' | 'currency' | 'percent'; delta: number | null; delta_label: string | null; tone?: Tone }
interface Point { date: string; value: number }
interface ModuleSummary { key: string; title: string; href: string; items: Item[] }
interface ActionRow { key: string; label: string; count: number; href: string; tone: 'warn' | 'bad' }
interface ActivityRow { user_name?: string; action?: string; module?: string; entity_type?: string; timestamp?: string }

const toneText = (tone: Tone) =>
  tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'

const fmtOf = (format: Headline['format']) => (n: number) =>
  format === 'currency' ? formatRupiah(n)
    : format === 'percent' ? `${Math.round(n).toLocaleString('id-ID')}%`
      : Math.round(n).toLocaleString('id-ID')

const sapaan = () => {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const tanggalPendek = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Satu angka di ringkasan modul: menghitung naik dan berkedip saat berubah. */
const ItemValue = ({ it }: { it: Item }) => {
  if (it.value === null || it.value === undefined) return <>-</>
  return <CountUp value={it.value} format={fmtOf(it.format)} />
}

const DashboardModules = () => {
  useDocumentTitle('Dashboard')
  const user = useAppSelector((s: any) => s.auth?.user)
  const nama = (user?.full_name || user?.username || '').split(' ')[0]
  const [mode, setMode] = useState<ChartMode>('dots')

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

  const utama = headline[0]
  const pendamping = headline.slice(1)

  // Diagram mengikuti angka utama: kalau yang dipajang omzet, yang digambar
  // penjualan; selain itu output produksi.
  const deret: Point[] = useMemo(() => {
    const pilih = utama?.key === 'omzet' ? trends.sales : trends.output
    return pilih || trends.output || trends.sales || []
  }, [utama?.key, trends.output, trends.sales])

  const sumbu = useMemo(() => {
    if (deret.length === 0) return []
    const ambil = [0, Math.floor(deret.length / 4), Math.floor(deret.length / 2), Math.floor((deret.length * 3) / 4), deret.length - 1]
    return Array.from(new Set(ambil)).map((i) => tanggalPendek(deret[i].date))
  }, [deret])

  // Mode punggungan membandingkan dua sumber sekaligus, bukan satu garis saja.
  const baris: RidgeRow[] = useMemo(() => {
    const r: RidgeRow[] = []
    if (trends.output?.length) r.push({ label: 'Output produksi', values: trends.output.map((p) => p.value) })
    if (trends.sales?.length) r.push({ label: 'Pesanan penjualan', values: trends.sales.map((p) => p.value) })
    return r
  }, [trends.output, trends.sales])

  const terparah = actions.find((a) => a.tone === 'bad') || actions[0]

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Reveal>
        <PageHeader
          eyebrow={`BERANDA · ${tanggal.toUpperCase()}`}
          title={`${sapaan()}${nama ? `, ${nama}` : ''}`}
          subtitle={isLoading ? 'Memuat ringkasan...' : 'Ringkasan seluruh modul yang boleh kamu lihat.'}
          actions={
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Muat ulang
            </button>
          }
        />
      </Reveal>

      {utama && (
        <Reveal delay={0.05}>
          <div className="fn-card overflow-hidden">
            <HeroStat
              label={utama.label}
              value={utama.value}
              format={fmtOf(utama.format)}
              loading={isLoading}
              delta={utama.delta !== null && utama.delta !== undefined ? {
                dir: utama.delta >= 0 ? 'up' : 'down',
                text: `${Math.abs(utama.delta).toLocaleString('id-ID')}%`,
                vs: utama.delta_label || undefined,
              } : undefined}
              note={deret.length > 0 ? `Grafik memperlihatkan ${deret.length} hari terakhir.` : undefined}
              stats={pendamping.map((h) => ({
                label: h.label,
                value: <span className={toneText(h.tone || null)}>{fmtOf(h.format)(h.value)}</span>,
              }))}
              right={deret.length > 0 ? (
                <RunChart
                  values={deret.map((p) => p.value)}
                  axis={sumbu}
                  rows={baris}
                  mode={mode}
                  onModeChange={setMode}
                  height={210}
                  unit={utama.format === 'currency' ? 'rupiah' : ''}
                  annotation={null}
                />
              ) : undefined}
            />
            {terparah && (
              <AlertStrip
                tone={terparah.tone === 'bad' ? 'bad' : 'warn'}
                icon={<AlertTriangle className="h-4 w-4" />}
                actions={
                  <>
                    <Link
                      to={terparah.href}
                      className="fn-press inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      Tangani <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {actions.length > 1 && (
                      <span className="fn-label">+{actions.length - 1} lainnya</span>
                    )}
                  </>
                }
              >
                <b className="font-semibold">{terparah.label}</b>{' '}
                <span className="text-gray-500 dark:text-gray-400">
                  {terparah.count.toLocaleString('id-ID')} butir menunggu.
                </span>
              </AlertStrip>
            )}
          </div>
        </Reveal>
      )}

      {isError && (
        <p className="fn-card px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Ringkasan gagal dimuat. Coba muat ulang.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Stagger className="grid gap-4 md:grid-cols-2">
            {modules.map((m) => (
              <StaggerItem key={m.key}>
                <Panel
                  title={m.title}
                  loading={isLoading}
                  action={
                    <Link to={m.href} className="fn-label hover:underline">
                      Buka modul
                    </Link>
                  }
                >
                  <div className="p-4">
                    {m.items[0] && (
                      <div>
                        <p className="fn-label">{m.items[0].label}</p>
                        <p className={`mt-1 text-2xl font-semibold tracking-tight ${toneText(m.items[0].tone)}`}>
                          <ItemValue it={m.items[0]} />
                        </p>
                      </div>
                    )}
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-200/70 pt-3 dark:border-gray-700/70 sm:grid-cols-3">
                      {m.items.slice(1).map((it) => (
                        <div key={it.key} className="min-w-0">
                          <dt className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                            {it.tone && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.tone === 'bad' ? 'bg-red-500' : 'bg-amber-500'}`} />}
                            <span className="truncate">{it.label}</span>
                          </dt>
                          <dd className={`fn-num mt-0.5 truncate text-base font-semibold ${toneText(it.tone)}`}><ItemValue it={it} /></dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </Panel>
              </StaggerItem>
            ))}
          </Stagger>

          {!isLoading && !isError && modules.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Akun ini belum punya akses ke modul mana pun. Hubungi admin.</p>
          )}

          {activity && activity.length > 0 && (
            <Reveal>
              <Panel
                title="Aktivitas terbaru"
                action={<Link to="/app/settings/audit-trail" className="fn-label hover:underline">Lihat semua</Link>}
              >
                <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
                  {activity.slice(0, 6).map((a, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{a.user_name}</span> {(a.action || '').toLowerCase()} {a.module || a.entity_type}
                      </span>
                      <span className="fn-label shrink-0">{(a.timestamp || '').toString().replace('T', ' ').slice(0, 16)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.08}>
          <TaskQueue
            title="Perlu tindakan"
            items={actions.map((a) => ({
              id: a.key,
              code: a.tone === 'bad' ? 'MENDESAK' : 'PERIKSA',
              title: a.label,
              note: <StatusPill tone={a.tone === 'bad' ? 'bad' : 'warn'}>{a.count.toLocaleString('id-ID')} butir</StatusPill>,
              actions: (
                <Link
                  to={a.href}
                  className="fn-press inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Buka <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ),
            }))}
            empty={isLoading ? 'Memuat...' : 'Tidak ada yang perlu ditindak saat ini.'}
            footer="Angka diperbarui tiap 2 menit"
          />
        </Reveal>
      </div>
    </div>
  )
}

export default DashboardModules
