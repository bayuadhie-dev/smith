import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface Changeover {
  id: number;
  changeover_number: string;
  from_wo_number: string;
  from_product_name: string;
  to_wo_number: string | null;
  to_product_name: string | null;
  machine_name: string;
  reason: string;
  reason_detail: string;
  from_wo_progress: number;
  from_wo_target: number;
  progress_percentage: number;
  changeover_start: string;
  changeover_end: string | null;
  setup_time_minutes: number;
  status: string;
  initiator_name: string;
  created_at: string;
}

const REASON_LABELS: Record<string, string> = {
  material_shortage: 'Kehabisan Bahan Baku',
  target_exceeded: 'Target Tercapai',
  priority_change: 'Perubahan Prioritas',
  quality_issue: 'Masalah Kualitas',
  customer_request: 'Permintaan Customer',
  other: 'Lainnya',
};

const STATUS_LABEL: Record<string, string> = { in_progress: 'Sedang Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan' };
const COLUMNS: ListColumn<Changeover>[] = [
  { key: 'changeover_number', label: 'No. Changeover', value: (c) => c.changeover_number },
  { key: 'from_wo_number', label: 'Dari SPK', value: (c) => c.from_wo_number },
  { key: 'from_product_name', label: 'Produk Asal', value: (c) => c.from_product_name, sortable: false },
  { key: 'to_wo_number', label: 'Ke SPK', value: (c) => c.to_wo_number },
  { key: 'to_product_name', label: 'Produk Tujuan', value: (c) => c.to_product_name, sortable: false },
  { key: 'machine_name', label: 'Mesin', value: (c) => c.machine_name },
  { key: 'reason', label: 'Alasan', value: (c) => c.reason, exportValue: (c) => REASON_LABELS[c.reason] || c.reason },
  { key: 'progress_percentage', label: 'Progres (%)', value: (c) => c.progress_percentage, type: 'number' },
  { key: 'changeover_start', label: 'Waktu Mulai', value: (c) => c.changeover_start, type: 'date' },
  { key: 'setup_time_minutes', label: 'Waktu Setup (menit)', value: (c) => c.setup_time_minutes, type: 'number', sortable: false },
  { key: 'status', label: 'Status', value: (c) => c.status, exportValue: (c) => STATUS_LABEL[c.status] || c.status },
];

const ChangeoverList: React.FC = () => {
  const [changeovers, setChangeovers] = useState<Changeover[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [summary, setSummary] = useState({ in_progress: 0, completed_today: 0 });

  useEffect(() => {
    fetchChangeovers();
  }, [statusFilter]);

  const tools = useListTools<Changeover>(changeovers, COLUMNS, { filename: 'Changeover', initialSort: { key: 'changeover_start', dir: 'desc' } });

  const fetchChangeovers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ per_page: '1000' });
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await axiosInstance.get(`/api/production/changeovers?${params}`);
      setChangeovers(response.data.changeovers || []);
      setSummary(response.data.summary || { in_progress: 0, completed_today: 0 });
    } catch (error) {
      console.error('Error fetching changeovers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1 dark:bg-yellow-900/30 dark:text-yellow-300">
            <ClockIcon className="h-3 w-3" />
            Sedang Berlangsung
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircleIcon className="h-3 w-3" />
            Selesai
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1 dark:bg-red-900/30 dark:text-red-300">
            <XCircleIcon className="h-3 w-3" />
            Dibatalkan
          </span>
        );
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800">{status}</span>;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ArrowPathIcon className="h-7 w-7 text-orange-500" />
          Product Changeover
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Riwayat pergantian produk di tengah produksi
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Sedang Berlangsung</p>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{summary.in_progress}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Selesai Hari Ini</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{summary.completed_today}</p>
            </div>
          </div>
        </div>
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 dark:bg-primary-900/20 dark:border-primary-800">
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="h-8 w-8 text-primary-500" />
            <div>
              <p className="text-sm text-primary-600 dark:text-primary-400">Total Changeover</p>
              <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{tools.total}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <ListToolbar tools={tools} placeholder="Cari nomor, SPK, produk, mesin, alasan" extra={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-800"
          >
            <option value="">Semua Status</option>
            <option value="in_progress">Sedang Berlangsung</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        } />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : tools.rows.length === 0 ? (
          <div className="text-center p-12 text-gray-500 dark:text-gray-400">
            <ArrowPathIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{tools.total === 0 ? 'Belum ada data changeover' : 'Tidak ada changeover yang cocok'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <SortTh tools={tools} col="changeover_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Changeover</SortTh>
                  <SortTh tools={tools} col="from_wo_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dari SPK</SortTh>
                  <SortTh tools={tools} col="to_wo_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ke SPK</SortTh>
                  <SortTh tools={tools} col="machine_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mesin</SortTh>
                  <SortTh tools={tools} col="reason" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alasan</SortTh>
                  <SortTh tools={tools} col="progress_percentage" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progres</SortTh>
                  <SortTh tools={tools} col="changeover_start" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Waktu</SortTh>
                  <SortTh tools={tools} col="status" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((co) => (
                  <tr key={co.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-4 py-3">
                      <span className="font-medium text-orange-600 dark:text-orange-400">{co.changeover_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{co.from_wo_number}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{co.from_product_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {co.to_wo_number ? (
                        <div>
                          <p className="font-medium">{co.to_wo_number}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{co.to_product_name}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{co.machine_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{REASON_LABELS[co.reason] || co.reason}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{co.progress_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ width: `${Math.min(co.progress_percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p>{formatDateTime(co.changeover_start)}</p>
                        {co.setup_time_minutes > 0 && (
                          <p className="text-gray-500 dark:text-gray-400">{co.setup_time_minutes} menit</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(co.status)}
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

export default ChangeoverList;
