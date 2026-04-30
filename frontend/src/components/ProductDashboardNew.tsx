import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ChartPieIcon,
  CubeIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
interface DashboardStats {
  total_products: number;
  active_products: number;
  inactive_products: number;
  spunlace_distribution: Array<{ type: string; count: number }>;
  process_distribution: Array<{ process: string; count: number }>;
  recent_products: Array<{
    id: number;
    kode_produk: string;
    nama_produk: string;
    created_at: string;
    is_active: boolean;
  }>;
}

const ProductDashboardNew: React.FC = () => {
  const { t } = useLanguage();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchDashboardStats();
  }, [timeRange]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products-excel/dashboard?time_range=${timeRange}`);
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      } else {
        console.error('Error fetching dashboard stats:', data.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-300">Gagal memuat data dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Produk</h1>
          <p className="text-gray-600 dark:text-gray-300">Ringkasan data master produk</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Waktu</option>
            <option value="7d">7 Hari Terakhir</option>
            <option value="30d">30 Hari Terakhir</option>
            <option value="90d">90 Hari Terakhir</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Produk</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_products.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <CubeIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Produk Aktif</p>
              <p className="text-2xl font-bold text-green-600">{stats.active_products.toLocaleString('id-ID')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {((stats.active_products / stats.total_products) * 100).toFixed(1)}% dari total
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Produk Tidak Aktif</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive_products.toLocaleString('id-ID')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {((stats.inactive_products / stats.total_products) * 100).toFixed(1)}% dari total
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Jenis Spunlace</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.spunlace_distribution?.length || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tipe berbeda</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <ChartBarIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spunlace Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <ChartPieIcon className="w-5 h-5 mr-2" />
            Distribusi Jenis Spunlace
          </h3>
          {stats?.spunlace_distribution?.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-300 text-center py-4">Tidak ada data spunlace</p>
          ) : (
            <div className="space-y-3">
              {stats?.spunlace_distribution?.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ 
                        backgroundColor: [
                          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
                        ][index % 6]
                      }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.type}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{item.count} produk</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({((item.count / stats.total_products) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Process Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <ArrowTrendingUpIcon className="w-5 h-5 mr-2" />
            Distribusi Process Produksi
          </h3>
          {stats?.process_distribution?.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-300 text-center py-4">Tidak ada data process</p>
          ) : (
            <div className="space-y-3">
              {stats?.process_distribution?.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ 
                        backgroundColor: [
                          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
                        ][index % 6]
                      }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={item.process}>
                      {item.process}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{item.count} produk</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({((item.count / stats.total_products) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Products */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Produk Terbaru</h3>
          {stats?.recent_products?.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-300 text-center py-4">Tidak ada produk baru</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Kode Produk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nama Produk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tanggal Dibuat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stats?.recent_products?.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {product.kode_produk}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div className="max-w-xs truncate" title={product.nama_produk}>
                          {product.nama_produk}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(product.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.is_active ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors text-left">
            <CubeIcon className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Tambah Produk Baru</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Tambah produk master baru</p>
          </button>
          <button className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors text-left">
            <FunnelIcon className="w-6 h-6 text-green-600 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">FunnelIcon Produk</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Cari dan filter produk</p>
          </button>
          <button className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors text-left">
            <ChartBarIcon className="w-6 h-6 text-purple-600 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Lihat Analitik</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Analisis data produk</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDashboardNew;
