import React, { useState } from 'react';
import { useGetQualityAnalyticsQuery, useGetProductsQuery } from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import { Panel } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ChartBarIcon,
  FunnelIcon

} from '@heroicons/react/24/outline';
import { useUrlFilter } from '../../hooks/useUrlState'
export default function QualityAnalytics() {
  const [period, setPeriod] = useUrlFilter<string>('periode', 'monthly')
  const [productId, setProductId] = useState<number | undefined>();

  const { data: analyticsData, isLoading } = useGetQualityAnalyticsQuery({
    period,
    product_id: productId
  });
  const { data: productsData } = useGetProductsQuery({});

  const analytics = analyticsData?.analytics || [];
  const summary = analyticsData?.summary || {};

  const sumbuTanggal = analytics.length
    ? Array.from(new Set([0, Math.floor(analytics.length / 2), analytics.length - 1]))
        .map((i: number) => String((analytics[i] as any)?.date || '').slice(5))
        .filter(Boolean)
    : []


  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') {
      return <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />;
    } else if (trend === 'declining') {
      return <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />;
    }
    return <div className="h-5 w-5 bg-gray-300 rounded-full dark:bg-gray-600"></div>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center flex-wrap justify-between gap-3">
        <div>
          <div className="fn-label mb-1.5">MUTU · ANALITIK MUTU</div>
          <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">Analitik Mutu</h1>
          <p className="text-gray-600 dark:text-gray-300">Ukuran mutu dan pergerakannya dari waktu ke waktu</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <SearchableSelect
              options={(productsData?.products || []).map((p: any) => ({ id: p.id, code: p.code, name: p.name }))}
              value={productId ?? null}
              onChange={(value) => setProductId(value ? Number(value) : undefined)}
              placeholder="Semua produk"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Tingkat kelulusan</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.overall_pass_rate ? `${summary.overall_pass_rate}%` : 'No Data'}
              </p>
            </div>
            {summary.overall_pass_rate ? getTrendIcon('improving') : <div className="h-5 w-5 bg-gray-300 rounded-full dark:bg-gray-600"></div>}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {summary.overall_pass_rate ? '+2.3% from last period' : 'No data available'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total pemeriksaan</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {summary.total_inspected || 0}
              </p>
            </div>
            <ChartBarIcon className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">periode ini</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Tingkat cacat</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {summary.defect_rate ? `${summary.defect_rate}%` : 'No Data'}
              </p>
            </div>
            {summary.defect_rate ? getTrendIcon('declining') : <div className="h-5 w-5 bg-gray-300 rounded-full dark:bg-gray-600"></div>}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {summary.defect_rate ? '-0.5% from last period' : 'No data available'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Biaya mutu</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {summary.cost_of_quality ? `$${summary.cost_of_quality}` : 'No Data'}
              </p>
            </div>
            {summary.cost_of_quality ? getTrendIcon('improving') : <div className="h-5 w-5 bg-gray-300 rounded-full dark:bg-gray-600"></div>}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {summary.cost_of_quality ? '-8.2% from last period' : 'No data available'}
          </p>
        </div>
      </div>

      {/* Empat panel di sini dulu menggambar kolom yang tidak pernah dikirim
          API: sebaran jenis cacat tanpa sumber data sama sekali, biaya mutu
          dari kolom prevention/appraisal/internal_failure/external_failure
          yang tidak ada (dan bersatuan dolar), serta volume inspeksi yang
          membaca `inspections` padahal API mengirim `total_inspected`.
          Sekarang semuanya memakai kolom yang benar-benar ada. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Tingkat kelulusan">
          <div className="px-4 pb-3 pt-1">
            {analytics.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data mutu.</p>
            ) : (
              <RunChart
                values={analytics.map((a: any) => Number(a.pass_rate || 0))}
                axis={sumbuTanggal}
                height={200}
                unit="%"
              />
            )}
          </div>
        </Panel>

        <Panel title="Kepadatan cacat">
          <div className="px-4 pb-3 pt-1">
            {analytics.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data cacat.</p>
            ) : (
              <RunChart
                values={analytics.map((a: any) => Number(a.defect_density || 0))}
                axis={sumbuTanggal}
                height={200}
                unit="per satuan"
              />
            )}
          </div>
        </Panel>

        <Panel title="Biaya mutu buruk">
          <div className="px-4 pb-3 pt-1">
            {analytics.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada biaya tercatat.</p>
            ) : (
              <RunChart
                values={analytics.map((a: any) => Number(a.cost_of_poor_quality || 0))}
                axis={sumbuTanggal}
                height={200}
                unit="rupiah"
              />
            )}
          </div>
        </Panel>

        <Panel title="Jumlah diperiksa dibanding diproduksi">
          <div className="px-4 pb-3 pt-1">
            {analytics.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada inspeksi.</p>
            ) : (
              <RunChart
                values={analytics.map((a: any) => Number(a.total_inspected || 0))}
                axis={sumbuTanggal}
                rows={[
                  { label: 'Diproduksi', values: analytics.map((a: any) => Number(a.total_production || 0)) },
                  { label: 'Diperiksa', values: analytics.map((a: any) => Number(a.total_inspected || 0)) },
                ]}
                height={200}
                unit="satuan"
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Quality Metrics Table */}
      <div className="fn-card">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rincian ukuran mutu</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pass Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  First Pass Yield
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Defect Density
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cost of Quality
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {analytics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p>Belum ada data mutu</p>
                    <p className="text-sm">Angka muncul setelah ada pemeriksaan mutu yang tercatat</p>
                  </td>
                </tr>
              ) : (
                analytics.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {item.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.inspections || item.total_inspected || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <span className={`font-medium ${item.pass_rate >= 95 ? 'text-green-600 dark:text-green-400' : item.pass_rate >= 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {item.pass_rate || item.overall_pass_rate || 0}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.first_pass_yield ? `${item.first_pass_yield}%` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.defect_density ? `${item.defect_density} DPM` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.cost_of_poor_quality ? `$${item.cost_of_poor_quality}` : '-'}
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
