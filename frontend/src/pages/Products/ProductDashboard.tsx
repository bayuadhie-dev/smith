import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CategoryBars, KpiStrip, PageHeader, Panel, QuickLinks, StatusPill } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';
import { ChartBarIcon, PlusIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
interface ProductKPIs {
  total_products?: number;
  active_products?: number;
  inactive_products?: number;
  total_categories?: number;
  low_stock_products?: number;
  out_of_stock_products?: number;
  total_value?: number;
  avg_price?: number;
  products_with_threshold?: number;
}

interface ProductSalesData {
  product_name: string;
  sales_qty: number;
  sales_value: number;
  profit_margin: number;
}

interface CategoryData {
  category: string;
  product_count: number;
  total_value: number;
}

interface StockAlert {
  id: number;
  product_name: string;
  current_stock: number;
  min_stock: number;
  status: 'low_stock' | 'out_of_stock' | 'normal';
  last_updated?: string;
}

interface TrendData {
  month: string;
  new_products: number;
  sales_volume: number;
}

const ProductDashboard: React.FC = () => {
  const [kpis, setKpis] = useState<ProductKPIs>({
    total_products: 0,
    active_products: 0,
    inactive_products: 0,
    total_categories: 0,
    low_stock_products: 0,
    out_of_stock_products: 0,
    total_value: 0,
    avg_price: 0
  });

  const [topProducts, setTopProducts] = useState<ProductSalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [kpisRes, topProductsRes, categoriesRes, alertsRes, trendsRes] = await Promise.all([
        axiosInstance.get('/api/products/dashboard/kpis'),
        axiosInstance.get('/api/products/dashboard/top-products'),
        axiosInstance.get('/api/products/dashboard/categories'),
        axiosInstance.get('/api/products/dashboard/stock-alerts'),
        axiosInstance.get('/api/products/dashboard/trends')
      ]);

      setKpis(kpisRes.data?.kpis || {});
      
      // Validate and clean top products data
      const cleanTopProducts = (topProductsRes.data?.products || []).map((product: any) => ({
        ...product,
        sales_qty: isNaN(product.sales_qty) ? 0 : (product.sales_qty || 0),
        sales_value: isNaN(product.sales_value) ? 0 : (product.sales_value || 0),
        profit_margin: isNaN(product.profit_margin) ? 0 : (product.profit_margin || 0)
      }));
      setTopProducts(cleanTopProducts);
      
      setCategoryData(categoriesRes.data?.categories || []);
      setStockAlerts(alertsRes.data?.alerts || []);
      setTrendData(trendsRes.data?.trends || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // 2026-10-07: this used to fall back to a fake "No Data" product
      // (id=1 - a real id that could collide with an actual product/
      // stock-alert row) and 3 hardcoded Jan-Mar trend rows on ANY API
      // error. Honest empty arrays instead - the charts below already
      // render fine with empty data.
      setKpis({
        total_products: 0,
        active_products: 0,
        inactive_products: 0,
        total_categories: 0,
        low_stock_products: 0,
        out_of_stock_products: 0,
        total_value: 0,
        avg_price: 0
      });
      setTopProducts([]);
      setCategoryData([]);
      setStockAlerts([]);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return 'Rp 0';
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return new Intl.NumberFormat('id-ID').format(num);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div>
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Memuat dashboard produk...</span>
      </div>
    );
  }

  const peringatan = (kpis.low_stock_products ?? 0) + (kpis.out_of_stock_products ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="PRODUK · RINGKASAN"
        title="Dashboard Produk"
        subtitle="Ringkasan portofolio produk: jumlah, nilai, dan pergerakannya."
        actions={
          <>
            <Link
              to="/app/products/analytics"
              className="fn-press inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ChartBarIcon className="h-4 w-4" />
              Analitik
            </Link>
            <Link
              to="/app/products/new"
              className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <PlusIcon className="h-4 w-4" />
              Tambah produk
            </Link>
          </>
        }
      />

      <KpiStrip
        items={[
          {
            label: 'Total produk',
            value: formatNumber(kpis.total_products ?? 0),
            hint: `${formatNumber(kpis.active_products ?? 0)} aktif · ${formatNumber(kpis.inactive_products ?? 0)} nonaktif`,
            to: '/app/products/list',
          },
          {
            label: 'Kategori',
            value: formatNumber(kpis.total_categories ?? 0),
            hint: 'Kelola kategori produk',
            to: '/app/products/categories',
          },
          {
            label: 'Peringatan stok',
            value: formatNumber(peringatan),
            tone: peringatan > 0 ? 'warn' : undefined,
            // Tanpa ambang minimum, angka 0 bukan berarti stok aman - jadi
            // layar menyebut apa adanya.
            hint: (kpis.products_with_threshold ?? 0) === 0
              ? 'Ambang stok minimum belum diisi'
              : `${formatNumber(kpis.low_stock_products ?? 0)} menipis · ${formatNumber(kpis.out_of_stock_products ?? 0)} habis`,
            to: '/app/warehouse/inventory',
          },
          {
            label: 'Nilai portofolio',
            value: formatRupiah(kpis.total_value ?? 0),
            hint: `Harga rata-rata ${formatRupiah(kpis.avg_price ?? 0)}`,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Produk paling laku">
          <div className="p-4">
            {topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada penjualan tercatat.</p>
            ) : (
              <CategoryBars
                items={topProducts.map((p: any) => ({ label: p.product_name, value: Number(p.sales_qty || 0) }))}
                format={formatNumber}
                unit="satuan"
              />
            )}
          </div>
        </Panel>

        <Panel title="Produk menurut kategori">
          <div className="p-4">
            {categoryData.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada kategori.</p>
            ) : (
              <CategoryBars
                items={categoryData.map((c: any) => ({ label: c.category, value: Number(c.product_count || 0) }))}
                unit="produk"
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Peringatan stok"
          action={<Link to="/app/warehouse/inventory" className="fn-label hover:underline">Lihat semua</Link>}
        >
          {stockAlerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {(kpis.products_with_threshold ?? 0) === 0
                ? 'Belum ada produk yang ambang stok minimumnya diisi, jadi tidak ada yang bisa diperingatkan.'
                : 'Tidak ada stok yang perlu diperhatikan.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {stockAlerts.map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{alert.product_name}</p>
                    <p className="fn-label mt-0.5">
                      Stok {formatNumber(alert.current_stock)} / minimum {formatNumber(alert.min_stock)}
                    </p>
                  </div>
                  <StatusPill tone={alert.status === 'out_of_stock' ? 'bad' : 'warn'}>
                    {alert.status === 'out_of_stock' ? 'Habis' : 'Menipis'}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="lg:col-span-2">
          <Panel title="Pergerakan produk">
            <div className="px-4 pb-3 pt-1">
              {trendData.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data.</p>
              ) : (
                <RunChart
                  values={trendData.map((t: any) => Number(t.new_products || 0))}
                  axis={Array.from(new Set([0, Math.floor(trendData.length / 2), trendData.length - 1]))
                    .map((i: number) => String((trendData[i] as any)?.month || ''))
                    .filter(Boolean)}
                  rows={[
                    { label: 'Produk baru', values: trendData.map((t: any) => Number(t.new_products || 0)) },
                    { label: 'Volume jual', values: trendData.map((t: any) => Number(t.sales_volume || 0)) },
                  ]}
                  height={200}
                />
              )}
            </div>
          </Panel>
        </div>
      </div>

      <QuickLinks
        links={[
          { to: '/app/products/list', label: 'Daftar produk' },
          { to: '/app/products/new', label: 'Tambah produk' },
          { to: '/app/products/categories', label: 'Kategori produk' },
          { to: '/app/products/bom', label: 'BOM (Bill of Materials)' },
          { to: '/app/products/analytics', label: 'Analitik produk' },
          { to: '/app/products/lifecycle', label: 'Daur hidup produk' },
          { to: '/app/products/calculator', label: 'Kalkulator nonwoven' },
        ]}
      />
    </div>
  );
};

export default ProductDashboard;
