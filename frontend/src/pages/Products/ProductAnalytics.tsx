import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { showInfo } from '../../components/ui';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  EyeIcon,
  FunnelIcon

} from '@heroicons/react/24/outline';
import { CategoryBars, PageHeader, Panel } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';

interface ProductPerformance {
  product_id: number;
  product_name: string;
  category: string;
  sales_qty: number;
  sales_value: number;
  profit_margin: number;
  growth_rate: number;
  stock_turnover: number;
  last_sale_date: string;
}

interface SalesTimeline {
  production_qty?: number;
  date: string;
  sales_qty: number;
  sales_value: number;
  profit: number;
}

interface CategoryAnalysis {
  category: string;
  total_products: number;
  total_sales: number;
  avg_margin: number;
  growth_rate: number;
}

interface ProfitabilityData {
  product_name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number;
}

interface SeasonalityData {
  month: string;
  sales_2023: number;
  sales_2024: number;
  growth: number;
}

const ProductAnalytics: React.FC = () => {
  const { t } = useLanguage();

  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([]);
  const [salesTimeline, setSalesTimeline] = useState<SalesTimeline[]>([]);
  const [categoryAnalysis, setCategoryAnalysis] = useState<CategoryAnalysis[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityData[]>([]);
  const [seasonalityData, setSeasonalityData] = useState<SeasonalityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('3months');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod, selectedCategory]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const [performanceRes, timelineRes, categoryRes, profitRes, seasonalRes] = await Promise.all([
        axiosInstance.get(`/api/products/analytics/performance?period=${selectedPeriod}&category=${selectedCategory}`),
        axiosInstance.get(`/api/products/analytics/timeline?period=${selectedPeriod}`),
        axiosInstance.get(`/api/products/analytics/categories?period=${selectedPeriod}`),
        axiosInstance.get(`/api/products/analytics/profitability?period=${selectedPeriod}`),
        axiosInstance.get(`/api/products/analytics/seasonality`)
      ]);

      setProductPerformance(performanceRes.data?.products || []);
      setSalesTimeline(timelineRes.data?.timeline || []);
      setCategoryAnalysis(categoryRes.data?.categories || []);
      setProfitabilityData(profitRes.data?.profitability || []);
      setSeasonalityData(seasonalRes.data?.seasonality || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      // Show empty state instead of mock data
      setProductPerformance([]);
      setSalesTimeline([]);
      setCategoryAnalysis([]);
      setProfitabilityData([]);
      setSeasonalityData([]);
    } finally {
      setLoading(false);
    }
  };

  // 2026-10-07: these used to call .format()/.toFixed() directly on
  // whatever the API sent, which crashed the whole page (ErrorBoundary,
  // blank screen) whenever a numeric field the backend didn't yet send
  // came through as undefined - defend with `?? 0` like formatRupiah
  // elsewhere in this codebase already does.
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount ?? 0);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num ?? 0);
  };

  const formatPercent = (num: number) => {
    return `${(num ?? 0).toFixed(1)}%`;
  };

  const exportData = () => {
    // Mock export functionality
    showInfo('Export functionality will be implemented with backend integration');
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Memuat analitik produk...</span>
      </div>
    );
  }

  const adaPenjualanWaktu = salesTimeline.some((t: any) => Number(t.sales_value || 0) > 0);
  const adaPenjualanKategori = categoryAnalysis.some((c: any) => Number(c.total_sales || 0) > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="PRODUK · ANALITIK"
        title="Analitik Produk"
        subtitle="Kinerja produk: penjualan, kategori, dan keuntungannya."
        actions={
          <>
            <Link
              to="/app/products/dashboard"
              className="fn-press inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Kembali ke dashboard
            </Link>
            <button
              onClick={exportData}
              className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Ekspor
            </button>
          </>
        }
      />

      {/* Penyaring */}
      <div className="fn-card flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-gray-400" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="1month">1 bulan terakhir</option>
            <option value="3months">3 bulan terakhir</option>
            <option value="6months">6 bulan terakhir</option>
            <option value="1year">1 tahun terakhir</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          {/* Pilihan kategori diambil dari data yang benar-benar ada di
              database - daftar tetap yang lama ("Nonwoven Fabrics",
              "Geotextiles", dst) tidak pernah cocok dengan isi tabel
              sehingga penyaringnya selalu mengosongkan hasil. */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">Semua kategori</option>
            {categoryAnalysis.map((c: any) => (
              <option key={c.category} value={c.category}>{c.category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Sama seperti panel kategori: tanpa faktur penjualan, yang nyata
            pada rentang ini adalah kuantitas produksinya. */}
        <Panel title={adaPenjualanWaktu ? 'Penjualan dari waktu ke waktu' : 'Produksi dari waktu ke waktu'}>
          <div className="px-4 pb-3 pt-1">
            {salesTimeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data pada rentang ini.</p>
            ) : (
              <>
                {!adaPenjualanWaktu && (
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    Belum ada penjualan tercatat pada rentang ini, jadi yang ditampilkan kuantitas produksinya.
                  </p>
                )}
                <RunChart
                  values={salesTimeline.map((t: any) => Number((adaPenjualanWaktu ? t.sales_value : t.production_qty) || 0))}
                  axis={Array.from(new Set([0, Math.floor(salesTimeline.length / 2), salesTimeline.length - 1]))
                    .map((i: number) => String((salesTimeline[i] as any)?.date || '').slice(5))
                    .filter(Boolean)}
                  rows={adaPenjualanWaktu ? [
                    { label: 'Nilai jual', values: salesTimeline.map((t: any) => Number(t.sales_value || 0)) },
                    { label: 'Laba', values: salesTimeline.map((t: any) => Number(t.profit || 0)) },
                  ] : [
                    { label: 'Kuantitas produksi', values: salesTimeline.map((t: any) => Number(t.production_qty || 0)) },
                  ]}
                  height={200}
                  unit={adaPenjualanWaktu ? 'rupiah' : 'satuan'}
                />
              </>
            )}
          </div>
        </Panel>

        {/* Kalau belum ada penjualan sama sekali, memajang belasan batang
            Rp 0 tidak memberi tahu apa-apa - yang nyata pada rentang itu
            adalah produksinya. */}
        <Panel title={adaPenjualanKategori ? 'Penjualan per kategori' : 'Produksi per kategori'}>
          <div className="p-4">
            {categoryAnalysis.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data kategori.</p>
            ) : (
              <>
                {!adaPenjualanKategori && (
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Belum ada penjualan tercatat pada rentang ini, jadi yang ditampilkan jumlah produksinya.
                  </p>
                )}
                <CategoryBars
                  items={categoryAnalysis.slice(0, 12).map((c: any) => (
                    adaPenjualanKategori
                      ? {
                        label: c.category,
                        value: Number(c.total_sales || 0),
                        hint: `margin ${formatPercent(Number(c.avg_margin || 0))}`,
                      }
                      : {
                        label: c.category,
                        value: Number(c.total_produced || 0),
                        hint: `${Number(c.total_products || 0).toLocaleString('id-ID')} produk`,
                      }
                  ))}
                  format={adaPenjualanKategori ? formatRupiah : (n: number) => n.toLocaleString('id-ID')}
                  unit={adaPenjualanKategori ? undefined : 'satuan'}
                />
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Tabel kinerja. Kolom produksi ditambahkan 2026-11-22: tanpa itu,
          di pabrik yang fakturnya belum masuk ERP seluruh tabel ini hanya
          berisi nol padahal data produksinya ada. */}
      <div className="fn-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Kinerja produk</h3>
          <div className="fn-label">{productPerformance.length} produk ditampilkan</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                <th className="fn-label px-3 py-2 text-left">Produk</th>
                <th className="fn-label px-3 py-2 text-left">Kategori</th>
                <th className="fn-label px-3 py-2 text-right">Diproduksi</th>
                <th className="fn-label px-3 py-2 text-right">Lolos QC</th>
                <th className="fn-label px-3 py-2 text-right">SPK</th>
                <th className="fn-label px-3 py-2 text-right">Jumlah jual</th>
                <th className="fn-label px-3 py-2 text-right">Nilai jual</th>
                <th className="fn-label px-3 py-2 text-right">Pertumbuhan</th>
                <th className="fn-label px-3 py-2 text-right">Perputaran stok</th>
                <th className="fn-label px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {productPerformance.map((product: any) => (
                <tr key={product.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900 dark:text-white">{product.product_name}</div>
                    <div className="fn-label mt-0.5">{product.product_code}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{product.category}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-900 dark:text-white">{formatNumber(product.total_produced || 0)}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">
                    {product.total_produced ? formatPercent(product.quality_rate || 0) : '-'}
                  </td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatNumber(product.work_order_count || 0)}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-900 dark:text-white">{formatNumber(product.sales_qty || 0)}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-900 dark:text-white">{formatRupiah(product.sales_value || 0)}</td>
                  <td className="fn-num px-3 py-2.5 text-right">
                    {/* Tanpa penjualan periode sebelumnya, pertumbuhan tidak
                        bisa dihitung - panah hijau 0,0% dulu bikin seolah
                        datanya ada. */}
                    {product.sales_value > 0 && product.growth_rate !== 0 ? (
                      <span className={product.growth_rate > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {product.growth_rate > 0 ? '+' : '-'}{formatPercent(Math.abs(product.growth_rate))}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">
                    {product.stock_turnover ? `${product.stock_turnover.toFixed(1)}x` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      to={`/app/products/${product.product_id}`}
                      className="inline-flex text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      title="Lihat produk"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {productPerformance.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Belum ada produk dengan kegiatan produksi pada rentang ini.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Laba per produk">
          <div className="p-4">
            {profitabilityData.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data laba.</p>
            ) : (
              <CategoryBars
                items={profitabilityData.slice(0, 10).map((d: any) => ({
                  label: d.product_name || d.product || '-',
                  value: Number(d.profit || 0),
                  tone: Number(d.profit || 0) < 0 ? 'bad' : undefined,
                  hint: d.revenue !== undefined ? `omzet ${formatRupiah(Number(d.revenue))}` : undefined,
                }))}
                format={formatRupiah}
              />
            )}
          </div>
        </Panel>

        {/* Analisis musiman belum ada di backend - endpoint-nya mengembalikan
            daftar kosong ("to be implemented"), jadi diagramnya dulu selalu
            kosong tanpa penjelasan. */}
        <Panel title="Pola musiman">
          <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Analisis musiman belum tersedia. Datanya belum dihitung sistem.
          </p>
        </Panel>
      </div>
    </div>
  );
};

export default ProductAnalytics;
