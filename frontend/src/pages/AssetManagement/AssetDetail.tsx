import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { useUrlState } from '../../hooks/useUrlState';
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail';
import { toast } from 'react-hot-toast';
import { PageHeader, Segmented, StatusPill, type Tone } from '../../components/ui/PageKit';
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
  functional_location_id: number | null;
  functional_location_name: string | null;
  functional_location_path: string | null;
  depreciation_method: string;
  useful_life_years: number;
  salvage_value: number;
  accumulated_depreciation: number;
  net_book_value: number;
  annual_depreciation: number;
  monthly_depreciation: number;
  age_years: number;
  tax_depreciation_method: string | null;
  tax_useful_life_years: number | null;
  tax_accumulated_depreciation: number;
  has_fiscal_schedule: boolean;
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
  const [scheduleBook, setScheduleBook] = useState<'commercial' | 'fiscal'>('commercial');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useUrlState<'overview' | 'depreciation' | 'maintenance'>('tab', 'overview', ['overview', 'depreciation', 'maintenance']);
  useBreadcrumbTrail(activeTab === 'overview' ? [] : [{ label: { depreciation: 'Penyusutan', maintenance: 'Perawatan' }[activeTab] }]);

  useEffect(() => {
    fetchAssetDetail();
  }, [id]);

  useEffect(() => {
    if (scheduleBook === 'commercial') return; // already loaded from asset detail
    axiosInstance.get(`/api/assets/${id}/depreciation-schedule`, { params: { book_type: 'fiscal' } })
      .then((res) => setDepreciationSchedule(res.data.schedules || []))
      .catch(() => toast.error('Gagal memuat jadwal fiskal'));
  }, [scheduleBook, id]);

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

  const labelTipe: Record<string, string> = {
    machinery: 'Mesin',
    building: 'Bangunan',
    vehicle: 'Kendaraan',
    IT_equipment: 'Perangkat TI',
    it_equipment: 'Perangkat TI',
    equipment: 'Peralatan',
    furniture: 'Perabot',
  };

  const labelStatus: Record<string, string> = {
    active: 'Aktif',
    maintenance: 'Perawatan',
    idle: 'Menganggur',
    retired: 'Tidak dipakai',
    disposed: 'Dilepas',
  };

  const toneStatus = (status: string): Tone =>
    status === 'active' ? 'ok' : status === 'maintenance' ? 'warn' : status === 'retired' || status === 'disposed' ? 'bad' : 'muted';

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      maintenance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      idle: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      retired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
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
      <div className="mx-auto max-w-6xl space-y-4 pb-10">
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-gray-400">Aset tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="ASET · RINCIAN"
        title={asset.asset_code}
        subtitle={asset.asset_name}
        actions={
          <>
            <button
              onClick={() => navigate('/app/assets/list')}
              className="fn-press inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Daftar aset
            </button>
            <StatusPill tone={toneStatus(asset.status)}>{labelStatus[asset.status] || asset.status}</StatusPill>
            <button
              onClick={() => navigate(`/app/assets/${id}/edit`)}
              className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <PencilIcon className="h-4 w-4" />
              Ubah
            </button>
          </>
        }
      />

      <Segmented
        value={activeTab}
        onChange={(v) => setActiveTab(v)}
        options={[
          { value: 'overview', label: 'Ringkasan' },
          { value: 'depreciation', label: 'Penyusutan' },
          { value: 'maintenance', label: 'Perawatan' },
        ]}
      />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="fn-card p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Informasi Dasar</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Tipe Aset</p>
                  <p className="font-medium text-slate-800 dark:text-white capitalize">
                    {labelTipe[asset.asset_type] || asset.asset_type.replace(/_/g, ' ')}
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
                  {asset.functional_location_path && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{asset.functional_location_path}</p>
                  )}
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
            <div className="fn-card p-6">
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
                    <p className="font-medium text-slate-500 dark:text-gray-400">Sudah habis</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Financial Summary */}
          <div className="space-y-6">
            {/* Financial Cards */}
            <div className="fn-card p-6">
              <p className="fn-label">Nilai buku bersih</p>
              <p className="fn-num mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(asset.net_book_value)}
              </p>
              <div className="mt-4 flex justify-between border-t border-gray-200/70 pt-3 text-sm dark:border-gray-700/70">
                <span className="text-gray-500 dark:text-gray-400">Akumulasi penyusutan</span>
                <span className="fn-num font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(asset.accumulated_depreciation)}
                </span>
              </div>
            </div>

            <div className="fn-card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Penyusutan</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Metode</p>
                  <p className="font-medium text-slate-800 dark:text-white">
                    {{ straight_line: 'Garis lurus', declining_balance: 'Saldo menurun' }[asset.depreciation_method] || asset.depreciation_method}
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
            <div className="fn-card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <WrenchScrewdriverIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                Perawatan
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
        <div className="fn-card overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Jadwal Penyusutan</h2>
            {asset.has_fiscal_schedule && (
              <div className="flex rounded-lg border border-slate-300 dark:border-gray-600 overflow-hidden text-sm">
                <button
                  onClick={() => setScheduleBook('commercial')}
                  className={`px-3 py-1.5 ${scheduleBook === 'commercial' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-300'}`}
                >
                  Komersial
                </button>
                <button
                  onClick={() => setScheduleBook('fiscal')}
                  className={`px-3 py-1.5 ${scheduleBook === 'fiscal' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-300'}`}
                >
                  Fiskal (Pajak)
                </button>
              </div>
            )}
          </div>
          {scheduleBook === 'fiscal' && (
            <div className="px-6 py-2 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
              Jadwal fiskal hanya untuk pelaporan pajak - tidak diposting ke GL.
            </div>
          )}
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
                          Dibukukan
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Belum dibukukan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Jadwal penyusutan dibuat saat asetnya disimpan; aset lama hasil
                impor sering belum punya satu baris pun. Lebih baik mengaku
                daripada memajang tabel kosong tanpa penjelasan. */}
            {depreciationSchedule.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Jadwal penyusutan aset ini belum pernah dibuat.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div className="fn-card overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Riwayat perawatan</h2>
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
