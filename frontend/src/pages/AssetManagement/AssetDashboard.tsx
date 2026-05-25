import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  BuildingOfficeIcon,
  CogIcon,
  TruckIcon,
  ComputerDesktopIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface AssetSummary {
  by_type: Array<{
    asset_type: string;
    count: number;
    total_cost: number;
    total_depreciation: number;
  }>;
  by_status: Array<{
    status: string;
    count: number;
  }>;
  totals: {
    total_assets: number;
    total_acquisition_cost: number;
    total_depreciation: number;
    total_net_book_value: number;
  };
}

interface MaintenanceDue {
  overdue: Array<{
    id: number;
    asset_code: string;
    asset_name: string;
    next_maintenance_date: string;
    days_overdue: number;
  }>;
  due_soon: Array<{
    id: number;
    asset_code: string;
    asset_name: string;
    next_maintenance_date: string;
    days_until_due: number;
  }>;
}

const AssetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [maintenanceDue, setMaintenanceDue] = useState<MaintenanceDue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, maintenanceRes] = await Promise.all([
        axiosInstance.get('/api/assets/reports/summary'),
        axiosInstance.get('/api/assets/reports/maintenance-due')
      ]);
      setSummary(summaryRes.data);
      setMaintenanceDue(maintenanceRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'machinery':
        return <CogIcon className="h-8 w-8" />;
      case 'building':
        return <BuildingOfficeIcon className="h-8 w-8" />;
      case 'vehicle':
        return <TruckIcon className="h-8 w-8" />;
      case 'it_equipment':
        return <ComputerDesktopIcon className="h-8 w-8" />;
      default:
        return <ChartBarIcon className="h-8 w-8" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
            Asset Management
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Manajemen Siklus Hidup Aset Terpadu
          </p>
        </div>
        <button
          onClick={() => navigate('/app/assets/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Tambah Aset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Total Aset</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                {summary?.totals.total_assets || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Nilai Perolehan</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                {formatCurrency(summary?.totals.total_acquisition_cost || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Akumulasi Penyusutan</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                {formatCurrency(summary?.totals.total_depreciation || 0)}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <ArrowTrendingDownIcon className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Nilai Buku Bersih</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                {formatCurrency(summary?.totals.total_net_book_value || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ArrowTrendingUpIcon className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Assets by Type */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Aset per Kategori
          </h2>
          <div className="space-y-4">
            {summary?.by_type.map((item) => (
              <div key={item.asset_type} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-blue-600">
                    {getAssetTypeIcon(item.asset_type)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white capitalize">
                      {item.asset_type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-gray-400">
                      {item.count} aset
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {formatCurrency(item.total_cost)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    NBV: {formatCurrency(item.total_cost - item.total_depreciation)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <WrenchScrewdriverIcon className="h-5 w-5 text-orange-600" />
            Maintenance Alert
          </h2>
          
          {/* Overdue */}
          {maintenanceDue && maintenanceDue.overdue.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Overdue ({maintenanceDue.overdue.length})
              </h3>
              <div className="space-y-2">
                {maintenanceDue.overdue.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/app/assets/${item.id}`)}
                    className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <p className="font-medium text-slate-800 dark:text-white text-sm">
                      {item.asset_code} - {item.asset_name}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Terlambat {item.days_overdue} hari
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due Soon */}
          {maintenanceDue && maintenanceDue.due_soon.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
                Jatuh Tempo (30 Hari) ({maintenanceDue.due_soon.length})
              </h3>
              <div className="space-y-2">
                {maintenanceDue.due_soon.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/app/assets/${item.id}`)}
                    className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                  >
                    <p className="font-medium text-slate-800 dark:text-white text-sm">
                      {item.asset_code} - {item.asset_name}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {item.days_until_due} hari lagi
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {maintenanceDue && maintenanceDue.overdue.length === 0 && maintenanceDue.due_soon.length === 0 && (
            <p className="text-center text-slate-500 dark:text-gray-400 py-8">
              Semua maintenance up-to-date ✓
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/app/assets/list')}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left"
        >
          <ChartBarIcon className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-white">Daftar Aset</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Lihat semua aset dan detailnya
          </p>
        </button>

        <button
          onClick={() => navigate('/app/assets/depreciation')}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left"
        >
          <CurrencyDollarIcon className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-white">Laporan Penyusutan</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Jadwal dan laporan depreciation
          </p>
        </button>

        <button
          onClick={() => navigate('/app/assets/spare-parts')}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left"
        >
          <WrenchScrewdriverIcon className="h-8 w-8 text-orange-600 mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-white">Suku Cadang</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Inventaris spare parts & MRO
          </p>
        </button>
      </div>
    </div>
  );
};

export default AssetDashboard;
