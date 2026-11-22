import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, Eye } from 'lucide-react'
import {
  AlertStrip,
  CategoryBars,
  HeroStat,
  KpiStrip,
  PageHeader,
  Panel,
  QuickLinks,
  StatusPill,
  TaskQueue,
  type Tone,
} from '../../components/ui/PageKit'
import { formatRupiah } from '../../utils/currencyUtils'
import { Reveal } from '../../components/motion'
import {
  useGetWarehouseDashboardQuery,
  useGetWarehouseAlertsQuery,
  useAcknowledgeWarehouseAlertMutation,
  useResolveWarehouseAlertMutation,
  useGetWarehouseZonesQuery,
  useGetWarehouseLocationsQuery,
} from '../../services/api'
import { useUrlFilter } from '../../hooks/useUrlState'

const JENIS_MUTASI: Record<string, string> = {
  receive: 'Penerimaan', issue: 'Pengeluaran', transfer: 'Pemindahan', adjust: 'Penyesuaian',
  goods_receipt: 'Penerimaan Barang', material_issue: 'Permintaan Barang', stock_in: 'Stok masuk', stock_out: 'Stok keluar',
}

const NADA_PERINGATAN: Record<string, Tone> = {
  critical: 'bad', high: 'bad', medium: 'warn', low: 'info',
}

export default function WarehouseDashboardEnhanced() {
  const [alertFilter, setAlertFilter] = useUrlFilter<string>('peringatan', 'active')

  const { data: dashboardData, isLoading: dashboardLoading } = useGetWarehouseDashboardQuery(undefined)
  const { data: alertsData } = useGetWarehouseAlertsQuery({ status: alertFilter })
  const { data: zonesData } = useGetWarehouseZonesQuery({})
  const { data: locationsData } = useGetWarehouseLocationsQuery({})

  const [acknowledgeAlert] = useAcknowledgeWarehouseAlertMutation()
  const [resolveAlert] = useResolveWarehouseAlertMutation()

  const summary = dashboardData?.summary || {}
  const movements = dashboardData?.movements || {}
  const abcAnalysis = dashboardData?.abc_analysis || {}
  const recentMovements = dashboardData?.recent_movements || []
  const topProducts = dashboardData?.top_products || []
  const alerts = alertsData?.alerts || []
  const zones = zonesData?.zones || []
  const locations = locationsData?.locations || []

  const tombolAksi = 'fn-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium'

  const mutasiMingguan = [
    { label: 'Penerimaan', value: movements?.receipts || 0 },
    { label: 'Pengeluaran', value: movements?.issues || 0 },
    { label: 'Pemindahan', value: movements?.transfers || 0 },
    { label: 'Penyesuaian', value: movements?.adjustments || 0 },
  ]

  const abc = [
    { label: 'Kelas A', value: abcAnalysis.A?.count || 0, hint: formatRupiah(abcAnalysis.A?.value || 0) },
    { label: 'Kelas B', value: abcAnalysis.B?.count || 0, hint: formatRupiah(abcAnalysis.B?.value || 0) },
    { label: 'Kelas C', value: abcAnalysis.C?.count || 0, hint: formatRupiah(abcAnalysis.C?.value || 0) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Reveal>
        <PageHeader
          eyebrow="GUDANG · RINGKASAN"
          title="Dashboard Gudang"
          subtitle={dashboardLoading ? 'Memuat ringkasan...' : 'Stok, lokasi, dan peringatan gudang'}
          actions={
            <>
              <Link to="/app/warehouse/inventory" className="btn-secondary">Barang per gudang</Link>
              <Link to="/app/warehouse/stock-input" className="btn-secondary">Input material</Link>
              <Link to="/app/warehouse/inventory/add-product" className="btn-primary">Tambah produk</Link>
            </>
          }
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="fn-card overflow-hidden">
          <HeroStat
            label="Nilai stok fisik"
            value={summary.total_value || 0}
            format={formatRupiah}
            loading={dashboardLoading}
            note="Jumlah stok dikalikan harga di master barang."
            stats={[
              { label: 'Total produk', value: (summary.total_products || 0).toLocaleString('id-ID') },
              {
                label: 'Pemakaian lokasi',
                // null = tidak ada lokasi yang dibatasi kapasitasnya
                value: summary.location_utilization === null || summary.location_utilization === undefined
                  ? 'belum diukur'
                  : `${summary.location_utilization}%`,
              },
              { label: 'Total lokasi', value: (summary.total_locations || locations.length || 0).toLocaleString('id-ID') },
            ]}
            right={
              <div className="pt-1">
                <p className="fn-label mb-3">Mutasi stok 7 hari terakhir</p>
                <CategoryBars items={mutasiMingguan} unit="mutasi" />
              </div>
            }
          />
          {(summary.active_alerts || 0) > 0 && (
            <AlertStrip
              tone={(summary.critical_alerts || 0) > 0 ? 'bad' : 'warn'}
              icon={<AlertTriangle className="h-4 w-4" />}
              actions={
                <Link to="/app/warehouse/alerts" className={`${tombolAksi} bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600`}>
                  Lihat peringatan <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              <b className="font-semibold">{(summary.active_alerts || 0).toLocaleString('id-ID')} peringatan aktif</b>{' '}
              <span className="text-gray-500 dark:text-gray-400">
                {(summary.critical_alerts || 0) > 0
                  ? `${summary.critical_alerts} di antaranya kritis.`
                  : 'belum ada yang kritis.'}
              </span>
            </AlertStrip>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <KpiStrip
          items={[
            {
              label: 'Barang di bawah minimum',
              value: summary.low_stock_items || 0,
              tone: summary.low_stock_items > 0 ? 'warn' : null,
              hint: 'di bawah titik pesan ulang',
              to: '/app/warehouse/alerts',
            },
            {
              label: 'Hampir kedaluwarsa',
              value: summary.expiring_soon || 0,
              tone: summary.expiring_soon > 0 ? 'warn' : null,
              hint: '30 hari ke depan',
              to: '/app/finance/reports/near-expiry',
            },
            { label: 'Gudang', value: zones.length, hint: `${zones.filter((z: any) => z.is_active !== false).length} aktif`, to: '/app/warehouse/zones' },
            {
              label: 'Lokasi tersedia',
              value: locations.filter((l: any) => l.is_available !== false).length,
              hint: `dari ${locations.length} lokasi`,
              to: '/app/warehouse/locations',
            },
          ]}
        />
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Reveal>
            <Panel
              title="Analisis ABC"
              loading={dashboardLoading}
              action={<Link to="/app/warehouse/abc-analysis" className="fn-label hover:underline">Rincian</Link>}
            >
              <div className="p-4">
                {abc.every((k) => k.value === 0) ? (
                  <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada barang yang diklasifikasikan.{' '}
                    <Link to="/app/warehouse/abc-analysis" className="font-medium hover:underline">Jalankan analisis ABC</Link>.
                  </p>
                ) : (
                  <>
                    <CategoryBars items={abc} unit="barang" />
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Kelas A = sedikit barang tapi menyerap nilai terbesar; kelas C sebaliknya.
                    </p>
                  </>
                )}
              </div>
            </Panel>
          </Reveal>

          <Reveal>
            <Panel
              title="Mutasi terbaru"
              action={<Link to="/app/warehouse/movements" className="fn-label hover:underline">Lihat semua</Link>}
            >
              {recentMovements.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada mutasi.</p>
              ) : (
                <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
                  {recentMovements.slice(0, 6).map((m: any, i: number) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{m.product}</p>
                        <p className="fn-label truncate">
                          {JENIS_MUTASI[m.type] || m.type} · {Number(m.quantity || 0).toLocaleString('id-ID')} · {m.location}
                        </p>
                      </div>
                      <span className="fn-label shrink-0">
                        {m.date ? new Date(m.date).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Reveal>

          <Reveal>
            <Panel title="Barang dengan nilai tertinggi" loading={dashboardLoading}>
              {topProducts.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                        <th className="fn-label px-4 py-2.5 text-left">Barang</th>
                        <th className="fn-label px-4 py-2.5 text-right">Jumlah</th>
                        <th className="fn-label px-4 py-2.5 text-right">Nilai</th>
                        <th className="fn-label px-4 py-2.5 text-right">Porsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
                      {topProducts.map((p: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white">{p.name}</td>
                          <td className="fn-num px-4 py-2.5 text-right text-sm text-gray-900 dark:text-white">
                            {Number(p.quantity || 0).toLocaleString('id-ID')}
                          </td>
                          {/* Nilainya rupiah, bukan dolar - dulu dicetak dengan "$". */}
                          <td className="fn-num px-4 py-2.5 text-right text-sm text-gray-900 dark:text-white">
                            {formatRupiah(p.value || 0)}
                          </td>
                          <td className="fn-num px-4 py-2.5 text-right text-sm text-gray-500 dark:text-gray-400">
                            {summary.total_value > 0 ? ((p.value / summary.total_value) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </Reveal>
        </div>

        <div className="space-y-4">
          <Reveal delay={0.1}>
            <TaskQueue
              title="Peringatan"
              items={alerts.slice(0, 6).map((a: any) => ({
                id: a.id,
                code: (a.severity || '').toUpperCase(),
                title: a.title,
                note: (
                  <>
                    <span className="block">{a.message}</span>
                    {a.product_name && <StatusPill tone={NADA_PERINGATAN[a.severity] || 'muted'}>{a.product_name}</StatusPill>}
                  </>
                ),
                actions: a.status === 'active' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(a.id)}
                      className={`${tombolAksi} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600`}
                    >
                      <Eye className="h-3.5 w-3.5" /> Sudah dilihat
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveAlert({ alertId: a.id, resolution_notes: 'Diselesaikan dari dashboard' })}
                      className={`${tombolAksi} bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600`}
                    >
                      <Check className="h-3.5 w-3.5" /> Selesai
                    </button>
                  </>
                ) : null,
              }))}
              action={
                <div className="flex items-center gap-1">
                  {(['active', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAlertFilter(f)}
                      className={`fn-press rounded-full px-2.5 py-1 text-xs font-medium ${
                        alertFilter === f
                          ? 'bg-gray-900 text-white dark:bg-gray-700'
                          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                      }`}
                    >
                      {f === 'active' ? 'Aktif' : 'Semua'}
                    </button>
                  ))}
                </div>
              }
              empty={alertFilter === 'active' ? 'Tidak ada peringatan aktif.' : 'Belum ada peringatan.'}
              footer="Peringatan dibuat otomatis dari stok minimum dan tanggal kedaluwarsa"
            />
          </Reveal>

          <Reveal delay={0.12}>
            <QuickLinks
              title="Pintasan"
              links={[
                { to: '/app/warehouse/analytics', label: 'Analitik gudang' },
                { to: '/app/warehouse/abc-analysis', label: 'Analisis ABC' },
                { to: '/app/production/mrp-run', label: 'MRP Run (titik pesan ulang)' },
                { to: '/app/warehouse/zones', label: 'Master gudang' },
                { to: '/app/warehouse/locations', label: 'Lokasi gudang' },
                { to: '/app/warehouse/movements', label: 'Mutasi stok' },
              ]}
            />
          </Reveal>
        </div>
      </div>
    </div>
  )
}
