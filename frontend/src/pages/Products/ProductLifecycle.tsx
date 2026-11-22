import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowLeftIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon
,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { CategoryBars, PageHeader, Panel } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';
import { useUrlFilter } from '../../hooks/useUrlState'

interface ProductLifecycleData {
  product_id: number;
  product_name: string;
  product_code: string;
  category: string;
  launch_date: string;
  current_stage: 'introduction' | 'growth' | 'maturity' | 'decline' | 'discontinued';
  stage_duration: number; // hari sejak SPK pertama
  total_produced: number;
  total_planned: number;
  completion_rate: number | null;
  total_revenue: number;
  production_share: number;
  growth_rate: number | null;
  work_order_count: number;
  recent_activity: boolean;
}

interface StageMetrics {
  stage: string;
  product_count: number;
  total_produced: number;
  avg_duration: number;
  avg_completion: number | null;
}

interface LifecycleTimeline {
  date: string;
  active_products: number;
  new_products: number;
  work_orders: number;
  produced: number;
}

interface ProductTransition {
  product_id: number;
  product_name: string;
  from_stage: string;
  to_stage: string;
  transition_date: string;
  reason: string;
  impact_score: number;
}

const ProductLifecycle: React.FC = () => {
  const { t } = useLanguage();

  const [products, setProducts] = useState<ProductLifecycleData[]>([]);
  const [stageMetrics, setStageMetrics] = useState<StageMetrics[]>([]);
  const [timeline, setTimeline] = useState<LifecycleTimeline[]>([]);
  const [transitions, setTransitions] = useState<ProductTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useUrlFilter<string>('cari', '')
  const [stageFilter, setStageFilter] = useUrlFilter<string>('tahap', 'all')
  const [categoryFilter, setCategoryFilter] = useUrlFilter<string>('kategori', 'all')
  const [selectedPeriod, setSelectedPeriod] = useState('6months');

  useEffect(() => {
    loadLifecycleData();
  }, [selectedPeriod]);

  const loadLifecycleData = async () => {
    try {
      setLoading(true);
      
      const [productsRes, metricsRes, timelineRes, transitionsRes] = await Promise.all([
        axiosInstance.get(`/api/products/lifecycle/products?period=${selectedPeriod}`),
        axiosInstance.get(`/api/products/lifecycle/stage-metrics?period=${selectedPeriod}`),
        axiosInstance.get(`/api/products/lifecycle/timeline?period=${selectedPeriod}`),
        axiosInstance.get(`/api/products/lifecycle/transitions?period=${selectedPeriod}`)
      ]);

      setProducts(productsRes.data?.products || []);
      setStageMetrics(metricsRes.data?.metrics || []);
      setTimeline(timelineRes.data?.timeline || []);
      setTransitions(transitionsRes.data?.transitions || []);
    } catch (error) {
      console.error('Failed to load lifecycle data:', error);
      // Show empty state instead of mock data
      setProducts([]);
      setStageMetrics([]);
      setTimeline([]);
      setTransitions([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.product_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'all' || product.current_stage === stageFilter;
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    
    return matchesSearch && matchesStage && matchesCategory;
  });

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'introduction': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'growth': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'maturity': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'decline': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'discontinued': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'introduction': return <SparklesIcon className="h-4 w-4" />;
      case 'growth': return <ArrowTrendingUpIcon className="h-4 w-4" />;
      case 'maturity': return <CheckCircleIcon className="h-4 w-4" />;
      case 'decline': return <ArrowTrendingDownIcon className="h-4 w-4" />;
      case 'discontinued': return <XCircleIcon className="h-4 w-4" />;
      default: return <ClockIcon className="h-4 w-4" />;
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number | string | null | undefined) => {
    const n = Number(num) || 0;
    return new Intl.NumberFormat('id-ID').format(n);
  };

  const formatPercent = (num: number | string | null | undefined) => {
    const n = Number(num) || 0;
    return `${n.toFixed(1)}%`;
  };

  const formatDuration = (days: number | string | null | undefined) => {
    const d = Number(days) || 0;
    if (d < 30) return `${d} hari`;
    if (d < 365) return `${Math.round(d / 30)} bulan`;
    return `${Math.round(d / 365)} tahun`;
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Memuat data daur hidup...</span>
      </div>
    );
  }

  const namaTahap: Record<string, string> = {
    introduction: 'Perkenalan',
    growth: 'Tumbuh',
    maturity: 'Matang',
    decline: 'Menurun',
    discontinued: 'Dihentikan',
  };

  // Pilihan kategori diambil dari data, bukan daftar tetap yang tidak pernah
  // cocok dengan isi database.
  const daftarKategori = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="PRODUK · DAUR HIDUP"
        title="Daur Hidup Produk"
        subtitle="Tahap tiap produk ditebak dari kegiatan produksinya: jumlah SPK, kuantitas, dan kapan terakhir dibuat."
        actions={
          <>
            <Link
              to="/app/products/dashboard"
              className="fn-press inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Kembali ke dashboard
            </Link>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="3months">3 bulan terakhir</option>
              <option value="6months">6 bulan terakhir</option>
              <option value="1year">1 tahun terakhir</option>
              <option value="2years">2 tahun terakhir</option>
            </select>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stageMetrics.map((metric) => (
          <div key={metric.stage} className="fn-card p-4">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${getStageColor(metric.stage.toLowerCase())}`}>
                {getStageIcon(metric.stage.toLowerCase())}
                {namaTahap[metric.stage.toLowerCase()] || metric.stage}
              </span>
              <span className="fn-num text-2xl font-semibold text-gray-900 dark:text-white">{metric.product_count}</span>
            </div>
            <dl className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between gap-2">
                <dt>Diproduksi</dt>
                <dd className="fn-num text-gray-700 dark:text-gray-200">{formatNumber(metric.total_produced)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Rata-rata umur</dt>
                <dd className="text-gray-700 dark:text-gray-200">{formatDuration(metric.avg_duration)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Penyelesaian SPK</dt>
                <dd className="fn-num text-gray-700 dark:text-gray-200">
                  {metric.avg_completion === null || metric.avg_completion === undefined ? '-' : formatPercent(metric.avg_completion)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Sebelumnya panel ini menggambar lima garis tahap daur hidup yang
            isinya angka karangan backend. ERP belum menyimpan riwayat tahap
            per bulan, jadi yang ditampilkan kegiatan produksi yang memang
            tercatat. */}
        <Panel title="Kegiatan produksi per bulan">
          <div className="px-4 pb-3 pt-1">
            {timeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada kegiatan produksi pada rentang ini.</p>
            ) : (
              <RunChart
                values={timeline.map((t) => Number(t.produced || 0))}
                axis={Array.from(new Set([0, Math.floor(timeline.length / 2), timeline.length - 1]))
                  .map((i: number) => String(timeline[i]?.date || '').slice(2))
                  .filter(Boolean)}
                rows={[
                  { label: 'Produk berproduksi', values: timeline.map((t) => Number(t.active_products || 0)) },
                  { label: 'Pertama kali produksi', values: timeline.map((t) => Number(t.new_products || 0)) },
                  { label: 'Jumlah SPK', values: timeline.map((t) => Number(t.work_orders || 0)) },
                ]}
                height={220}
                unit="satuan"
              />
            )}
          </div>
        </Panel>

        <Panel title="Sebaran tahap">
          <div className="p-4">
            {stageMetrics.every((m) => !m.product_count) ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada produk terklasifikasi.</p>
            ) : (
              <CategoryBars
                items={stageMetrics.map((m) => ({
                  label: namaTahap[m.stage.toLowerCase()] || m.stage,
                  value: Number(m.product_count || 0),
                  hint: `${formatNumber(m.total_produced)} satuan diproduksi`,
                }))}
                unit="produk"
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Penyaring */}
      <div className="fn-card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-64 flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">Semua tahap</option>
            <option value="introduction">Perkenalan</option>
            <option value="growth">Tumbuh</option>
            <option value="maturity">Matang</option>
            <option value="decline">Menurun</option>
          </select>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="all">Semua kategori</option>
          {daftarKategori.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {/* Tabel produk */}
      <div className="fn-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tahap tiap produk</h3>
          <div className="fn-label">{filteredProducts.length} dari {products.length} produk</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                <th className="fn-label px-3 py-2 text-left">Produk</th>
                <th className="fn-label px-3 py-2 text-left">Tahap</th>
                <th className="fn-label px-3 py-2 text-right">Umur sejak SPK pertama</th>
                <th className="fn-label px-3 py-2 text-right">Diproduksi</th>
                <th className="fn-label px-3 py-2 text-right">SPK</th>
                <th className="fn-label px-3 py-2 text-right">Dibanding periode lalu</th>
                <th className="fn-label px-3 py-2 text-right">Pangsa produksi</th>
                <th className="fn-label px-3 py-2 text-right">Omzet</th>
                <th className="fn-label px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {filteredProducts.map((product) => (
                <tr key={product.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900 dark:text-white">{product.product_name}</div>
                    <div className="fn-label mt-0.5">{product.product_code} · {product.category}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getStageColor(product.current_stage)}`}>
                      {getStageIcon(product.current_stage)}
                      {namaTahap[product.current_stage] || product.current_stage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatDuration(product.stage_duration)}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-900 dark:text-white">{formatNumber(product.total_produced)}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatNumber(product.work_order_count)}</td>
                  <td className="fn-num px-3 py-2.5 text-right">
                    {/* null = tidak ada produksi di periode sebelumnya, jadi
                        tidak ada yang bisa dibandingkan. */}
                    {product.growth_rate === null || product.growth_rate === undefined ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span className={product.growth_rate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {product.growth_rate >= 0 ? '+' : '-'}{formatPercent(Math.abs(product.growth_rate))}
                      </span>
                    )}
                  </td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatPercent(product.production_share)}</td>
                  <td className="fn-num px-3 py-2.5 text-right text-gray-900 dark:text-white">{formatRupiah(product.total_revenue)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      to={`/app/products-v2?view=detail&code=${product.product_code}`}
                      className="inline-flex text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      title="Lihat detail produk"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {products.length === 0
                ? 'Belum ada produk dengan kegiatan produksi pada rentang ini.'
                : 'Tidak ada produk yang cocok dengan pencarian atau penyaring.'}
            </p>
          )}
        </div>
      </div>

      {/* Perpindahan tahap - ERP belum menyimpan riwayatnya, jadi bagian ini
          hanya muncul kalau backend benar-benar mengirim isinya. */}
      {transitions.length > 0 && (
        <div className="fn-card p-4">
          <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Perpindahan tahap terakhir</h3>
          <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
            {transitions.map((transition, index) => (
              <li key={index} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white">{transition.product_name}</div>
                  <div className="fn-label mt-0.5">
                    {namaTahap[transition.from_stage] || transition.from_stage} &rarr; {namaTahap[transition.to_stage] || transition.to_stage}
                  </div>
                </div>
                <div className="fn-label shrink-0">
                  {new Date(transition.transition_date).toLocaleDateString('id-ID')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProductLifecycle;
