import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface Asset {
  id: number;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  category: string;
  status: string;
  is_production_machine: boolean;
  machine_code: string;
  location: string;
  purchase_date: string;
  purchase_cost: number;
  accumulated_depreciation: number;
  net_book_value: number;
  is_under_warranty: boolean;
  next_maintenance_date: string;
}

const AssetList: React.FC = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchAssets();
  }, [filterType, filterStatus]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;

      const res = await axiosInstance.get('/api/assets', { params });
      setAssets(res.data.assets || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAssets();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Daftar Aset</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Kelola semua aset perusahaan
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

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kode atau nama aset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Semua Tipe</option>
            <option value="machinery">Machinery</option>
            <option value="building">Building</option>
            <option value="vehicle">Vehicle</option>
            <option value="IT_equipment">IT Equipment</option>
            <option value="furniture">Furniture</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Semua Status</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="idle">Idle</option>
            <option value="retired">Retired</option>
          </select>

          <button
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FunnelIcon className="h-5 w-5" />
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-gray-400">
            Tidak ada data aset
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Kode Aset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Nama Aset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Nilai Buku</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-white">{asset.asset_code}</div>
                      {asset.is_production_machine && asset.machine_code && (
                        <div className="text-xs text-slate-500 dark:text-gray-400">Mesin: {asset.machine_code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-white">{asset.asset_name}</div>
                      {asset.category && (
                        <div className="text-xs text-slate-500 dark:text-gray-400">{asset.category}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 dark:text-gray-300 capitalize">
                        {asset.asset_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-gray-300">
                      {asset.location || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(asset.status)}`}>
                        {asset.status}
                      </span>
                      {asset.is_under_warranty && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">Under Warranty</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-slate-800 dark:text-white">
                        {formatCurrency(asset.net_book_value)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        dari {formatCurrency(asset.purchase_cost)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/app/assets/${asset.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetList;
