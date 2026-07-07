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

const FGConversionList: React.FC = () => {
  const [conversions, setConversions] = useState<FGConversion[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchConversions();
    fetchDashboardStats();
  }, [statusFilter, batchFilter, page]);

  const fetchConversions = async () => {
    try {
      setLoading(true);
      const params: any = { page, per_page: 20 };
      if (statusFilter) params.status = statusFilter;
      if (batchFilter) params.batch_number = batchFilter;

      const response = await axiosInstance.get('/api/fg-conversion/list', { params });
      setConversions(response.data.data || []);
      setTotalPages(response.data.pagination?.pages || 1);
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
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">In Progress</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Cancelled</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{status}</span>;
    }
  };

  const getQCStatusBadge = (qcStatus: string) => {
    switch (qcStatus) {
      case 'pass':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Pass</span>;
      case 'fail':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Fail</span>;
      case 'rework':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Rework</span>;
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Konversi WIP ke Finish Good</h1>
          <p className="text-gray-600 dark:text-gray-300">Kelola proses konversi dari WIP menjadi Finish Good</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchConversions}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <p className="text-2xl font-bold text-gray-600">{summary.draft}</p>
              </div>
              <ClockIcon className="h-10 w-10 text-gray-500" />
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 ${statusFilter === 'in_progress' ? 'border-blue-500' : 'border-transparent'}`}
            onClick={() => setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{summary.in_progress}</p>
              </div>
              <BeakerIcon className="h-10 w-10 text-blue-500" />
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 ${statusFilter === 'completed' ? 'border-green-500' : 'border-transparent'}`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? '' : 'completed')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600">{summary.completed}</p>
              </div>
              <CheckCircleIcon className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loss Rate</p>
                <p className="text-2xl font-bold text-red-600">{stats.totals.loss_percentage.toFixed(2)}%</p>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Total WIP Consumed</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totals.total_wip_qty.toLocaleString()} pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total FG Produced</p>
            <p className="text-xl font-bold text-green-600">{stats.totals.total_fg_qty.toLocaleString()} pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Loss</p>
            <p className="text-xl font-bold text-red-600">{stats.totals.total_loss_qty.toLocaleString()} pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Material Cost</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.totals.total_material_cost)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Filter by Batch Number..."
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        {(statusFilter || batchFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setBatchFilter('');
            }}
            className="px-4 py-2 text-sm text-blue-600 hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Conversions Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-600px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : conversions.length === 0 ? (
            <div className="text-center py-12">
              <CubeIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Tidak ada data konversi</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Konversi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Work Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch Number</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">QC Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">WIP Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FG Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Loss</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {conversions.map((conversion) => (
                  <tr key={conversion.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/app/production/fg-conversion/${conversion.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
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
                          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" title="Batch not validated" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getQCStatusBadge(conversion.qc_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {conversion.total_wip_qty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {conversion.total_fg_qty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
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
                        <div className="text-xs">Completed: {formatDate(conversion.completed_at)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Link
                        to={`/app/production/fg-conversion/${conversion.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FGConversionList;
