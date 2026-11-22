import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { KpiStrip, PageHeader } from '../../components/ui/PageKit';
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  CubeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import SearchableSelect from '../../components/SearchableSelect';

interface ProductionData {
  product_id: number;
  product_code: string;
  product_name: string;
  total_produced: number;
  total_good: number;
  total_reject: number;
  total_waste: number;
  reject_rate: number;
  work_order_count: number;
  machine_hours: number;
  avg_output_per_hour: number;
}

interface PeriodSummary {
  period: string;
  period_label: string;
  total_produced: number;
  total_good: number;
  total_reject: number;
  products: ProductionData[];
}

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function ProductionByProductReport() {
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<PeriodSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [products, setProducts] = useState<{ id: number; code: string; name: string }[]>([]);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [periodType, startDate, endDate, selectedProduct]);

  const fetchProducts = async () => {
    try {
      const response = await axiosInstance.get('/api/products?all=true');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        period_type: periodType,
        start_date: startDate,
        end_date: endDate,
      });
      if (selectedProduct) {
        params.append('product_id', selectedProduct);
      }

      const response = await axiosInstance.get(`/api/reports/production-by-product?${params}`);
      setData(response.data.periods || []);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams({
        period_type: periodType,
        start_date: startDate,
        end_date: endDate,
        format: 'excel',
      });
      if (selectedProduct) {
        params.append('product_id', selectedProduct);
      }

      const response = await axiosInstance.get(`/api/reports/production-by-product/export?${params}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `production_report_${periodType}_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  // Calculate totals
  const totals = data.reduce(
    (acc, period) => ({
      total_produced: acc.total_produced + period.total_produced,
      total_good: acc.total_good + period.total_good,
      total_reject: acc.total_reject + period.total_reject,
    }),
    { total_produced: 0, total_good: 0, total_reject: 0 }
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="LAPORAN · PRODUKSI PER PRODUK"
        title="Laporan Produksi per Produk"
        subtitle="Hasil produksi dikelompokkan per produk dan per periode."
        actions={
          <button
            onClick={exportToExcel}
            className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Ekspor Excel
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-700 dark:text-gray-200">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Periode</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
              <option value="yearly">Tahunan</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Produk</label>
            <SearchableSelect
              options={products}
              value={selectedProduct || null}
              onChange={(value) => setSelectedProduct(value ? String(value) : '')}
              placeholder="Semua Produk"
              className="w-full"
            />
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              onClick={fetchReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Muat ulang
            </button>
          </div>
        </div>
      </div>

      <KpiStrip
        items={[
          { label: 'Total produksi', value: `${formatNumber(totals.total_produced)} pcs` },
          { label: 'Produk baik', value: `${formatNumber(totals.total_good)} pcs` },
          {
            label: 'Produk tidak lolos',
            value: `${formatNumber(totals.total_reject)} pcs`,
            tone: totals.total_reject > 0 ? 'warn' : undefined,
          },
          {
            label: 'Porsi tidak lolos',
            value: totals.total_produced > 0
              ? formatPercent((totals.total_reject / totals.total_produced) * 100)
              : '0%',
            hint: 'Dibanding total produksi',
          },
        ]}
      />

      {/* Data Table */}
      {loading ? (
        <LoadingSpinner />
      ) : data.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-12 text-center">
          <CubeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tidak ada data</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tidak ada data produksi untuk periode yang dipilih</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    Periode
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    Total produksi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    Baik
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    Reject
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    Porsi tidak lolos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.map((period) => (
                  <React.Fragment key={period.period}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">{period.period_label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatNumber(period.total_produced)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                        {formatNumber(period.total_good)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                        {formatNumber(period.total_reject)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            period.total_produced > 0 &&
                            (period.total_reject / period.total_produced) * 100 > 5
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          }`}
                        >
                          {period.total_produced > 0
                            ? formatPercent((period.total_reject / period.total_produced) * 100)
                            : '0%'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            setExpandedPeriod(expandedPeriod === period.period ? null : period.period)
                          }
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          {expandedPeriod === period.period ? (
                            <ChevronLeftIcon className="h-5 w-5 rotate-90" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5 rotate-90" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded Product Details */}
                    {expandedPeriod === period.period && period.products && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-gray-50 dark:bg-gray-900">
                          <div className="ml-6">
                            <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Detail per Produk:</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 dark:text-gray-400">
                                    <th className="text-left py-2">Kode</th>
                                    <th className="text-left py-2">Nama Produk</th>
                                    <th className="text-right py-2">Produksi</th>
                                    <th className="text-right py-2">Baik</th>
                                    <th className="text-right py-2">Reject</th>
                                    <th className="text-right py-2">Waste</th>
                                    <th className="text-right py-2">Reject Rate</th>
                                    <th className="text-right py-2">WO Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {period.products.map((product) => (
                                    <tr key={product.product_id} className="border-t border-gray-200 dark:border-gray-700">
                                      <td className="py-2 font-mono text-xs">{product.product_code}</td>
                                      <td className="py-2">{product.product_name}</td>
                                      <td className="py-2 text-right">{formatNumber(product.total_produced)}</td>
                                      <td className="py-2 text-right text-green-600 dark:text-green-400">
                                        {formatNumber(product.total_good)}
                                      </td>
                                      <td className="py-2 text-right text-red-600 dark:text-red-400">
                                        {formatNumber(product.total_reject)}
                                      </td>
                                      <td className="py-2 text-right text-orange-600 dark:text-orange-400">
                                        {formatNumber(product.total_waste)}
                                      </td>
                                      <td className="py-2 text-right">
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs ${
                                            product.reject_rate > 5
                                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                          }`}
                                        >
                                          {formatPercent(product.reject_rate)}
                                        </span>
                                      </td>
                                      <td className="py-2 text-right">{product.work_order_count}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {/* Footer Totals */}
              <tfoot className="bg-gray-100 dark:bg-gray-800 font-semibold">
                <tr>
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">{formatNumber(totals.total_produced)}</td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{formatNumber(totals.total_good)}</td>
                  <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{formatNumber(totals.total_reject)}</td>
                  <td className="px-4 py-3 text-right">
                    {totals.total_produced > 0
                      ? formatPercent((totals.total_reject / totals.total_produced) * 100)
                      : '0%'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
