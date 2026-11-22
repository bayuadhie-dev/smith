import React, { useState } from 'react'
import { useGetWarehouseAnalyticsQuery } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext';
import { KpiStrip, PageHeader, Panel, Segmented, StatusPill } from '../../components/ui/PageKit'
import RunChart from '../../components/charts/RunChart'
import { formatRupiah } from '../../utils/currencyUtils'
import { useUrlFilter } from '../../hooks/useUrlState'
export default function WarehouseAnalytics() {
    const { t } = useLanguage();

const [period, setPeriod] = useUrlFilter<string>('periode', 'monthly')
  const [warehouseId, setWarehouseId] = useState<number | undefined>()

  const { data: analyticsData, isLoading } = useGetWarehouseAnalyticsQuery({ 
    period, 
    warehouse_id: warehouseId 
  })

  const analytics = analyticsData?.analytics || []
  const summary = analyticsData?.summary || {}

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const sumbu = analytics.length
    ? [analytics[0].date, analytics[Math.floor(analytics.length / 2)]?.date, analytics[analytics.length - 1].date]
        .filter(Boolean)
        .map((d: string) => String(d).slice(5))
    : []

  const deret = (kunci: string) => analytics.map((a: any) => Number(a[kunci] || 0))

  const diagram: { judul: string; kunci: string; satuan: string }[] = [
    { judul: 'Perputaran persediaan', kunci: 'inventory_turnover', satuan: 'kali' },
    { judul: 'Pemakaian kapasitas', kunci: 'storage_utilization', satuan: '%' },
    { judul: 'Nilai persediaan', kunci: 'total_value', satuan: 'rupiah' },
    { judul: 'Jumlah barang', kunci: 'total_products', satuan: 'barang' },
    { judul: 'Kejadian stok habis', kunci: 'stockout_incidents', satuan: 'kejadian' },
    { judul: 'Barang kedaluwarsa', kunci: 'expired_products', satuan: 'barang' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <PageHeader
        eyebrow="GUDANG · ANALITIK"
        title="Analitik Gudang"
        subtitle="Pola pergerakan stok dan ukuran kinerja gudang"
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'daily', label: 'Harian' },
              { value: 'weekly', label: 'Mingguan' },
              { value: 'monthly', label: 'Bulanan' },
            ]}
          />
        }
      />

      <KpiStrip
        items={[
          {
            label: 'Perputaran persediaan',
            value: summary.current_turnover ? `${summary.current_turnover}x` : 'belum ada data',
            hint: 'periode berjalan',
          },
          {
            label: 'Pemakaian kapasitas',
            value: summary.current_utilization ? `${summary.current_utilization}%` : 'belum ada data',
            hint: `rata-rata ${summary.avg_utilization?.toFixed(1) || 0}%`,
          },
          {
            label: 'Persediaan cukup untuk',
            value: summary.current_days_supply ? `${summary.current_days_supply} hari` : 'belum ada data',
            hint: 'pada laju pemakaian sekarang',
          },
          {
            label: 'Kejadian stok habis',
            value: summary.total_stockouts || 0,
            tone: (summary.total_stockouts || 0) > 0 ? 'bad' : null,
            hint: 'pada periode ini',
          },
        ]}
      />

      {analytics.length === 0 ? (
        <Panel title="Grafik">
          <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Belum ada data analitik. Angka muncul setelah ada pergerakan gudang yang tercatat.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {diagram.map((d) => (
            <Panel key={d.kunci} title={d.judul}>
              <div className="px-4 pb-3 pt-1">
                <RunChart values={deret(d.kunci)} axis={sumbu} height={170} unit={d.satuan} />
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel title="Rincian per periode">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                <th className="fn-label px-4 py-2.5 text-left">Tanggal</th>
                <th className="fn-label px-4 py-2.5 text-right">Barang</th>
                <th className="fn-label px-4 py-2.5 text-right">Nilai</th>
                <th className="fn-label px-4 py-2.5 text-right">Perputaran</th>
                <th className="fn-label px-4 py-2.5 text-right">Kapasitas</th>
                <th className="fn-label px-4 py-2.5 text-right">Cukup untuk</th>
                <th className="fn-label px-4 py-2.5 text-left">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {analytics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                analytics.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="fn-num px-4 py-2.5 text-sm text-gray-900 dark:text-white">{item.date}</td>
                    <td className="fn-num px-4 py-2.5 text-right text-sm text-gray-900 dark:text-white">
                      {(item.total_products || 0).toLocaleString('id-ID')}
                    </td>
                    {/* Rupiah, bukan dolar. */}
                    <td className="fn-num px-4 py-2.5 text-right text-sm text-gray-900 dark:text-white">
                      {formatRupiah(item.total_value || 0)}
                    </td>
                    <td className={`fn-num px-4 py-2.5 text-right text-sm font-medium ${item.inventory_turnover >= 4 ? 'text-emerald-700 dark:text-emerald-400' : item.inventory_turnover >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {item.inventory_turnover || 0}x
                    </td>
                    <td className={`fn-num px-4 py-2.5 text-right text-sm font-medium ${item.storage_utilization >= 80 ? 'text-red-600 dark:text-red-400' : item.storage_utilization >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {item.storage_utilization || 0}%
                    </td>
                    <td className="fn-num px-4 py-2.5 text-right text-sm text-gray-900 dark:text-white">
                      {item.days_of_supply || 0} hari
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {item.stockout_incidents > 0 && (
                          <StatusPill tone="bad">{item.stockout_incidents} kali habis</StatusPill>
                        )}
                        {item.overstock_incidents > 0 && (
                          <StatusPill tone="warn">{item.overstock_incidents} kali menumpuk</StatusPill>
                        )}
                        {item.expired_products > 0 && (
                          <StatusPill tone="warn">{item.expired_products} kedaluwarsa</StatusPill>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
