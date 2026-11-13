import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowPathIcon,
  FunnelIcon,
  CubeIcon,
  BeakerIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

interface FGConversion {
  id: number;
  conversion_number: string;
  work_order_id: number;
  wo_number: string;
  batch_number: string;
  qc_status: string;
  qc_date: string | null;
  conversion_date: string;
  conversion_type: string;
  status: string;
  total_wip_qty: number;
  total_fg_qty: number;
  total_loss_qty: number;
  total_material_cost: number;
  batch_validated: boolean;
  created_by: string | null;
  completed_at: string | null;
}

interface Summary {
  draft: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

interface DashboardStats {
  total_conversions: number;
  status_counts: { [key: string]: number };
  totals: {
    total_wip_qty: number;
    total_fg_qty: number;
    total_loss_qty: number;
    total_material_cost: number;
    loss_percentage: number;
  };
  top_loss_reasons: Array<{
    reason: string;
    quantity: number;
    cost: number;
  }>;
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Dibatalkan' };
const QC_LABEL: Record<string, string> = { pass: 'Lolos', fail: 'Gagal', rework: 'Rework' };
const COLUMNS: ListColumn<FGConversion>[] = [
  { key: 'conversion_number', label: 'No. Konversi', value: (c) => c.conversion_number },
  { key: 'wo_number', label: 'SPK', value: (c) => c.wo_number },
  { key: 'batch_number', label: 'No. Batch', value: (c) => c.batch_number },
  { key: 'qc_status', label: 'Status QC', value: (c) => c.qc_status, exportValue: (c) => QC_LABEL[c.qc_status] || c.qc_status },
  { key: 'total_wip_qty', label: 'Qty WIP', value: (c) => c.total_wip_qty, type: 'number' },
  { key: 'total_fg_qty', label: 'Qty FG', value: (c) => c.total_fg_qty, type: 'number' },
  { key: 'total_loss_qty', label: 'Loss', value: (c) => c.total_loss_qty, type: 'number' },
  { key: 'status', label: 'Status', value: (c) => c.status, exportValue: (c) => STATUS_LABEL[c.status] || c.status },
  { key: 'conversion_date', label: 'Tanggal', value: (c) => c.conversion_date, type: 'date' },
  { key: 'completed_at', label: 'Tanggal Selesai', value: (c) => c.completed_at, type: 'date', sortable: false },
];

const FGConversionList: React.FC = () => {
  const [conversions, setConversions] = useState<FGConversion[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchConversions();
    fetchDashboardStats();
  }, [statusFilter]);

  const tools = useListTools<FGConversion>(conversions, COLUMNS, { filename: 'Konversi_FG', initialSort: { key: 'conversion_date', dir: 'desc' } });

  const fetchConversions = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, per_page: 1000 };
      if (statusFilter) params.status = statusFilter;

      const response = await axiosInstance.get('/api/fg-conversion/list', { params });
      setConversions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching conversions:', error);
      toast.error('Gagal memuat data konversi FG');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axiosInstance.get('/api/fg-conversion/dashboard-stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">Draft</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">Berjalan</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Selesai</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Dibatalkan</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{status}</span>;
    }
  };

  const getQCStatusBadge = (qcStatus: string) => {
    switch (qcStatus) {
      case 'pass':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Lolos</span>;
      case 'fail':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Gagal</span>;
      case 'rework':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Rework</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{qcStatus}</span>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const summary: Summary = {
    draft: stats?.status_counts?.draft || 0,
    in_progress: stats?.status_counts?.in_progress || 0,
    completed: stats?.status_counts?.completed || 0,
    cancelled: stats?.status_counts?.cancelled || 0
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Konversi Barang Jadi (FG)</h1>
          <p className="text-gray-600 dark:text-gray-300">Kelola proses konversi dari WIP menjadi Finish Good</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchConversions}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Muat Ulang
          </button>
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
            <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Konversi dibuat otomatis setelah QC Pass</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 ${statusFilter === 'draft' ? 'border-gray-500' : 'border-transparent'}`}
            onClick={() => setStatusFilter(statusFilter === 'draft' ? '' : 'draft')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Draft</p>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{summary.draft}</p>
              </div>
              <ClockIcon className="h-10 w-10 text-gray-500 dark:text-gray-400" />
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 ${statusFilter === 'in_progress' ? 'border-primary-500' : 'border-transparent'}`}
            onClick={() => setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Berjalan</p>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{summary.in_progress}</p>
              </div>
              <BeakerIcon className="h-10 w-10 text-primary-500" />
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 ${statusFilter === 'completed' ? 'border-green-500' : 'border-transparent'}`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? '' : 'completed')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Selesai</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.completed}</p>
              </div>
              <CheckCircleIcon className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tingkat Loss</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.totals.loss_percentage.toFixed(2)}%</p>
              </div>
              <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total WIP Terpakai</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totals.total_wip_qty.toLocaleString()} pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total FG Dihasilkan</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.totals.total_fg_qty.toLocaleString()} pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Loss</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.totals.total_loss_qty.toLocaleString()} pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Biaya Material</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats.totals.total_material_cost)}</p>
          </div>
        </div>
      )}

      <ListToolbar tools={tools} placeholder="Cari nomor konversi, SPK, atau batch" extra={statusFilter ? (
        <button type="button" onClick={() => setStatusFilter('')} className="px-3 py-2 text-sm text-primary-700 hover:underline dark:text-primary-300">Hapus filter status</button>
      ) : undefined} />

      {/* Conversions Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-600px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : tools.rows.length === 0 ? (
            <div className="text-center py-12">
              <CubeIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{tools.total === 0 ? 'Belum ada data konversi' : 'Tidak ada konversi yang cocok'}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <SortTh tools={tools} col="conversion_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Konversi</SortTh>
                  <SortTh tools={tools} col="wo_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SPK</SortTh>
                  <SortTh tools={tools} col="batch_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Batch</SortTh>
                  <SortTh tools={tools} col="qc_status" align="center" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status QC</SortTh>
                  <SortTh tools={tools} col="total_wip_qty" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty WIP</SortTh>
                  <SortTh tools={tools} col="total_fg_qty" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty FG</SortTh>
                  <SortTh tools={tools} col="total_loss_qty" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Loss</SortTh>
                  <SortTh tools={tools} col="status" align="center" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
                  <SortTh tools={tools} col="conversion_date" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</SortTh>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((conversion) => (
                  <tr key={conversion.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/app/production/fg-conversion/${conversion.id}`}
                        className="font-medium text-primary-600 hover:text-primary-800 hover:underline dark:text-primary-400"
                      >
                        {conversion.conversion_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {conversion.wo_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {conversion.batch_number}
                        {!conversion.batch_validated && (
                          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" title="Batch belum divalidasi" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getQCStatusBadge(conversion.qc_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {conversion.total_wip_qty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium dark:text-green-400">
                      {conversion.total_fg_qty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400">
                      {conversion.total_loss_qty.toLocaleString()}
                      {conversion.total_wip_qty > 0 && (
                        <span className="text-xs ml-1">
                          ({((conversion.total_loss_qty / conversion.total_wip_qty) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(conversion.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>{formatDate(conversion.conversion_date)}</div>
                      {conversion.completed_at && (
                        <div className="text-xs">Selesai: {formatDate(conversion.completed_at)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Link
                        to={`/app/production/fg-conversion/${conversion.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};

export default FGConversionList;
