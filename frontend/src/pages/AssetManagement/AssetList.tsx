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
import { useUrlFilter } from '../../hooks/useUrlState'
import { PageHeader, StatusPill, type Tone } from '../../components/ui/PageKit';

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
  const [search, setSearch] = useUrlFilter<string>('cari', '')
  const [filterType, setFilterType] = useUrlFilter<string>('tipe', '')
  const [filterStatus, setFilterStatus] = useUrlFilter<string>('status', '')

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

  const labelStatus: Record<string, string> = {
    active: 'Aktif',
    maintenance: 'Perawatan',
    idle: 'Menganggur',
    retired: 'Tidak dipakai',
    disposed: 'Dilepas',
  };

  const labelTipe: Record<string, string> = {
    machinery: 'Mesin',
    building: 'Bangunan',
    vehicle: 'Kendaraan',
    IT_equipment: 'Perangkat TI',
    it_equipment: 'Perangkat TI',
    equipment: 'Peralatan',
    furniture: 'Perabot',
  };

  const tone = (status: string): Tone =>
    status === 'active' ? 'ok' : status === 'maintenance' ? 'warn' : status === 'retired' || status === 'disposed' ? 'bad' : 'muted';

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="ASET · DAFTAR"
        title="Daftar Aset"
        subtitle={loading ? 'Memuat aset...' : `${assets.length.toLocaleString('id-ID')} aset terdaftar.`}
        actions={
          <button
            onClick={() => navigate('/app/assets/new')}
            className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <PlusIcon className="h-4 w-4" />
            Tambah aset
          </button>
        }
      />

      <div className="fn-card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama aset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Semua tipe</option>
          <option value="machinery">Mesin</option>
          <option value="building">Bangunan</option>
          <option value="vehicle">Kendaraan</option>
          <option value="equipment">Peralatan</option>
          <option value="IT_equipment">Perangkat TI</option>
          <option value="furniture">Perabot</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="maintenance">Perawatan</option>
          <option value="idle">Menganggur</option>
          <option value="retired">Tidak dipakai</option>
        </select>

        <button
          onClick={handleSearch}
          className="fn-press inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <FunnelIcon className="h-4 w-4" />
          Terapkan
        </button>
      </div>

      <div className="fn-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div>
          </div>
        ) : assets.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Tidak ada aset yang cocok dengan pencarian atau penyaringnya.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                  <th className="fn-label px-4 py-2.5 text-left">Kode aset</th>
                  <th className="fn-label px-4 py-2.5 text-left">Nama aset</th>
                  <th className="fn-label px-4 py-2.5 text-left">Tipe</th>
                  <th className="fn-label px-4 py-2.5 text-left">Lokasi</th>
                  <th className="fn-label px-4 py-2.5 text-left">Status</th>
                  <th className="fn-label px-4 py-2.5 text-right">Nilai buku</th>
                  <th className="fn-label px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{asset.asset_code}</div>
                      {asset.is_production_machine && asset.machine_code && (
                        <div className="fn-label mt-0.5">Mesin {asset.machine_code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{asset.asset_name}</div>
                      {asset.category && <div className="fn-label mt-0.5">{asset.category}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {labelTipe[asset.asset_type] || asset.asset_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{asset.location || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={tone(asset.status)}>{labelStatus[asset.status] || asset.status}</StatusPill>
                      {asset.is_under_warranty && (
                        <div className="mt-1 text-xs text-green-600 dark:text-green-400">Masih bergaransi</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="fn-num font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(asset.net_book_value)}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">dari {formatCurrency(asset.purchase_cost)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/app/assets/${asset.id}`)}
                        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        title="Lihat rincian"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Rincian
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
