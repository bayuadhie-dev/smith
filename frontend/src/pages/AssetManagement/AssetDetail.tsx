import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface AssetDetail {
  id: number;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  category: string;
  description: string;
  status: string;
  purchase_date: string;
  purchase_cost: number;
  supplier_id: number;
  warranty_start_date: string;
  warranty_end_date: string;
  is_under_warranty: boolean;
  installation_date: string;
  location: string;
  depreciation_method: string;
  useful_life_years: number;
  salvage_value: number;
  accumulated_depreciation: number;
  net_book_value: number;
  annual_depreciation: number;
  monthly_depreciation: number;
  age_years: number;
  is_production_machine: boolean;
  machine_code: string;
  capacity: number;
  speed: number;
  last_maintenance_date: string;
  next_maintenance_date: string;
  total_maintenance_cost: number;
  total_downtime_hours: number;
}

interface MaintenanceHistory {
  id: number;
  record_number: string;
  maintenance_type: string;
  maintenance_date: string;
  status: string;
  cost: number;
  downtime_hours: number;
}

interface DepreciationSchedule {
  period_date: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  net_book_value: number;
  is_posted: boolean;
}

const AssetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [depreciationSchedule, setDepreciationSchedule] = useState<DepreciationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'depreciation' | 'maintenance'>('overview');

  useEffect(() => {
    fetchAssetDetail();
  }, [id]);

  const fetchAssetDetail = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/assets/${id}`);
      setAsset(res.data.asset);
      setMaintenanceHistory(res.data.maintenance_history || []);
      setDepreciationSchedule(res.data.depreciation_schedule || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      maintenance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      idle: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      retired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-gray-400">Aset tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/assets/list')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-slate-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
              {asset.asset_code}
            </h1>
            <p className="text-slate-500 dark:text-gray-400 mt-1">{asset.asset_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-lg font-medium ${getStatusBadge(asset.status)}`}>
            {asset.status}
          </span>
          <button
            onClick={() => navigate(`/app/assets/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PencilIcon className="h-5 w-5" />
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200 dark:border-gray-700">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('depreciation')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'depreciation'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
            }`}
          >
            Penyusutan
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'maintenance'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
            }`}
          >
            Maintenance
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Informasi Dasar</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Tipe Aset</p>
                  <p className="font-medium text-slate-800 dark:text-white capitalize">
                    {asset.asset_type.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Kategori</p>
                  <p className="font-medium text-slate-800 dark:text-white">{asset.category || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Lokasi</p>
                  <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4" />
                    {asset.location || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Umur Aset</p>
                  <p className="font-medium text-slate-800 dark:text-white">
                    {asset.age_years.toFixed(1)} tahun
                  </p>
                </div>
                {asset.is_production_machine && (
                  <>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Kode Mesin</p>
                      <p className="font-medium text-slate-800 dark:text-white">{asset.machine_code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Kapasitas</p>
                      <p className="font-medium text-slate-800 dark:text-white">
                        {asset.capacity} @ {asset.speed} pcs/jam
                      </p>
                    </div>
                  </>
                )}
              </div>
              {asset.description && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
                  <p className="text-sm text-slate-500 dark:text-gray-400">Deskripsi</p>
                  <p className="text-slate-800 dark:text-white mt-1">{asset.description}</p>
                </div>
              )}
            </div>

            {/* Procurement Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Pengadaan</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Tanggal Pembelian</p>
                  <p className="font-medium text-slate-800 dark:text-white">{formatDate(asset.purchase_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Harga Perolehan</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(asset.purchase_cost)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Tanggal Instalasi</p>
                  <p className="font-medium text-slate-800 dark:text-white">{formatDate(asset.installation_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Garansi</p>
                  {asset.is_under_warranty ? (
                    <p className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" />
                      Aktif s/d {formatDate(asset.warranty_end_date)}
                    </p>
                  ) : (
                    <p className="font-medium text-slate-500 dark:text-gray-400">Expired</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Financial Summary */}
          <div className="space-y-6">
            {/* Financial Cards */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <CurrencyDollarIcon className="h-5 w-5" />
                <p className="text-sm opacity-90">Nilai Buku Bersih</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(asset.net_book_value)}</p>
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between text-sm">
                  <span className="opacity-90">Akumulasi Penyusutan</span>
                  <span className="font-semibold">{formatCurrency(asset.accumulated_depreciation)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Penyusutan</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Metode</p>
                  <p className="font-medium text-slate-800 dark:text-white capitalize">
                    {asset.depreciation_method.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Masa Manfaat</p>
                  <p className="font-medium text-slate-800 dark:text-white">{asset.useful_life_years} tahun</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Penyusutan/Tahun</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(asset.annual_depreciation)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Penyusutan/Bulan</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(asset.monthly_depreciation)}</p>
                </div>
              </div>
            </div>

            {/* Maintenance Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <WrenchScrewdriverIcon className="h-5 w-5 text-orange-600" />
                Maintenance
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Terakhir</p>
                  <p className="font-medium text-slate-800 dark:text-white">{formatDate(asset.last_maintenance_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Berikutnya</p>
                  <p className="font-medium text-slate-800 dark:text-white">{formatDate(asset.next_maintenance_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Total Biaya</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(asset.total_maintenance_cost)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Total Downtime</p>
                  <p className="font-medium text-slate-800 dark:text-white">{asset.total_downtime_hours} jam</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Depreciation Tab */}
      {activeTab === 'depreciation' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Jadwal Penyusutan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Periode</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Penyusutan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Akumulasi</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Nilai Buku</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {depreciationSchedule.slice(0, 24).map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-slate-800 dark:text-white">
                      {new Date(item.period_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 dark:text-white">
                      {formatCurrency(item.depreciation_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 dark:text-white">
                      {formatCurrency(item.accumulated_depreciation)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">
                      {formatCurrency(item.net_book_value)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_posted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircleIcon className="h-4 w-4" />
                          Posted
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Riwayat Maintenance</h2>
          </div>
          {maintenanceHistory.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-gray-400">
              Belum ada riwayat maintenance
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">No. Record</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Tipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Biaya</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Downtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                  {maintenanceHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{item.record_number}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 capitalize">{item.maintenance_type}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{formatDate(item.maintenance_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          item.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800 dark:text-white">{formatCurrency(item.cost)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300">{item.downtime_hours} jam</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetDetail;
