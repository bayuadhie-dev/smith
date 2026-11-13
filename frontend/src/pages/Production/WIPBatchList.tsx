import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CogIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon
,
  PlusIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
interface WIPBatch {
  id: number;
  wip_batch_no: string;
  work_order_no: string;
  product_name: string;
  current_stage: string;
  machine_name?: string;
  line_name?: string;
  qty_started: number;
  qty_completed: number;
  qty_rejected: number;
  qty_in_process: number;
  completion_percentage: number;
  rejection_rate: number;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_wip_value: number;
  status: string;
  operator_name?: string;
  shift?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
}

interface Filters {
  status: string;
  stage: string;
  work_order_id: string;
  date_from: string;
  date_to: string;
  search: string;
}

const STATUS_LABEL: Record<string, string> = { open: 'Dibuka', in_progress: 'Berjalan', completed: 'Selesai', closed: 'Ditutup' };
const COLUMNS: ListColumn<WIPBatch>[] = [
  { key: 'wip_batch_no', label: 'No. Batch WIP', value: (b) => b.wip_batch_no },
  { key: 'work_order_no', label: 'SPK', value: (b) => b.work_order_no },
  { key: 'product_name', label: 'Produk', value: (b) => b.product_name },
  { key: 'current_stage', label: 'Tahap Saat Ini', value: (b) => b.current_stage },
  { key: 'completion_percentage', label: 'Progres (%)', value: (b) => b.completion_percentage, type: 'number' },
  { key: 'qty_started', label: 'Qty Mulai', value: (b) => b.qty_started, type: 'number' },
  { key: 'qty_completed', label: 'Qty Baik', value: (b) => b.qty_completed, type: 'number' },
  { key: 'qty_rejected', label: 'Qty Reject', value: (b) => b.qty_rejected, type: 'number' },
  { key: 'qty_in_process', label: 'Qty Proses', value: (b) => b.qty_in_process, type: 'number' },
  { key: 'total_wip_value', label: 'Nilai WIP (Rp)', value: (b) => b.total_wip_value, type: 'number' },
  { key: 'status', label: 'Status', value: (b) => b.status, exportValue: (b) => STATUS_LABEL[b.status] || b.status },
  { key: 'started_at', label: 'Dimulai', value: (b) => b.started_at, type: 'date' },
];

const WIPBatchList: React.FC = () => {
  const { t } = useLanguage();

  const [wipBatches, setWipBatches] = useState<WIPBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: '',
    stage: '',
    work_order_id: '',
    date_from: '',
    date_to: '',
    search: ''
  });

  const [stages, setStages] = useState<Array<{ value: string; label: string }>>([]);
  const tools = useListTools<WIPBatch>(wipBatches, COLUMNS, { filename: 'Batch_WIP', initialSort: { key: 'started_at', dir: 'desc' } });

  useEffect(() => {
    fetchWipBatches();
    fetchProductionStages();
  }, [filters]);

  const fetchWipBatches = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.status) params.status = filters.status;
      if (filters.stage) params.stage = filters.stage;
      if (filters.work_order_id) params.work_order_id = filters.work_order_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const response = await axiosInstance.get('/api/wip/wip-batches', { params: { ...params, per_page: 1000 } });
      const batches = response.data.wip_batches || [];

      setWipBatches(batches);
      setError(null);
    } catch (error: any) {
      console.error('Failed to fetch WIP batches:', error);
      setError(error.response?.data?.error || 'Gagal memuat batch WIP');
      setWipBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionStages = async () => {
    try {
      const response = await axiosInstance.get('/api/wip/production-stages');
      setStages(response.data.stages || []);
    } catch (error) {
      console.error('Failed to fetch production stages:', error);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      stage: '',
      work_order_id: '',
      date_from: '',
      date_to: '',
      search: ''
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <PlayIcon className="h-4 w-4 text-primary-500" />;
      case 'in_progress':
        return <CogIcon className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'closed':
        return <PauseIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      default:
        return <PauseIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      open: { bg: 'bg-primary-100 dark:bg-primary-900/30', text: 'text-primary-800 dark:text-primary-300' },
      in_progress: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
      completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' },
      closed: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-100' }
    };
    const config = statusConfig[status] || statusConfig.open;
    return `px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`;
  };

  const getStageBadge = (stage: string) => {
    const stageColors: Record<string, string> = {
      ready_to_start: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
      cutting: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      filling: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      sealing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      packing: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      quality_check: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      finished: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    };
    const color = stageColors[stage] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    return `px-2 py-1 rounded-full text-xs font-medium ${color}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batch WIP</h1>
          <p className="text-gray-600 dark:text-gray-300">Pelacakan dan pengelolaan batch barang dalam proses (WIP)</p>
        </div>
        <Link to="/app/production/wip-batches/new" className="btn-primary inline-flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Buat Batch WIP
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari batch WIP, SPK, produk, tahap" />

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1" />

            {/* FunnelIcon Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <FunnelIcon className="h-5 w-5" />
              Filter
            </button>

            {/* Refresh */}
            <button
              onClick={fetchWipBatches}
              className="btn-secondary inline-flex items-center gap-2"
              disabled={loading}
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.status')}</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Semua Status</option>
                    <option value="open">Dibuka</option>
                    <option value="in_progress">Berjalan</option>
                    <option value="completed">Selesai</option>
                    <option value="closed">Ditutup</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tahap</label>
                  <select
                    value={filters.stage}
                    onChange={(e) => handleFilterChange('stage', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Semua Tahap</option>
                    {stages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Dari Tanggal</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="btn-secondary w-full"
                  >
                    Hapus Filter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">
              Batch WIP ({tools.rows.length})
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Nilai WIP: {formatCurrency(tools.rows.reduce((sum, batch) => sum + batch.total_wip_value, 0))}
            </div>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Memuat batch WIP...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4 dark:text-red-400">
                <ExclamationTriangleIcon className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Gagal Memuat Batch WIP</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
              <button onClick={fetchWipBatches} className="btn-primary">
              </button>
            </div>
          ) : tools.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh tools={tools} col="wip_batch_no">No. Batch WIP</SortTh>
                    <SortTh tools={tools} col="work_order_no">SPK</SortTh>
                    <SortTh tools={tools} col="product_name">Produk</SortTh>
                    <SortTh tools={tools} col="current_stage">Tahap Saat Ini</SortTh>
                    <SortTh tools={tools} col="completion_percentage">Progres</SortTh>
                    <SortTh tools={tools} col="qty_started">Jumlah</SortTh>
                    <SortTh tools={tools} col="total_wip_value">Nilai WIP</SortTh>
                    <SortTh tools={tools} col="status">Status</SortTh>
                    <SortTh tools={tools} col="started_at">Dimulai</SortTh>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.rows.map((batch) => (
                    <tr key={batch.id}>
                      <td className="font-medium">{batch.wip_batch_no}</td>
                      <td>{batch.work_order_no}</td>
                      <td>{batch.product_name}</td>
                      <td>
                        <span className={getStageBadge(batch.current_stage)}>
                          {batch.current_stage.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{ width: `${batch.completion_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {batch.completion_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs">
                          <div>Mulai: {batch.qty_started}</div>
                          <div className="text-green-600 dark:text-green-400">Baik: {batch.qty_completed}</div>
                          <div className="text-red-600 dark:text-red-400">Reject: {batch.qty_rejected}</div>
                          <div className="text-primary-600 dark:text-primary-400">Proses: {batch.qty_in_process}</div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div className="font-medium">{formatCurrency(batch.total_wip_value)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            M: {formatCurrency(batch.material_cost)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            L: {formatCurrency(batch.labor_cost)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            O: {formatCurrency(batch.overhead_cost)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center">
                          {getStatusIcon(batch.status)}
                          <span className={getStatusBadge(batch.status)}>
                            {STATUS_LABEL[batch.status] || batch.status}
                          </span>
                        </div>
                      </td>
                      <td className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(batch.started_at)}
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/app/production/wip-batches/${batch.id}`}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400"
                            title="Lihat Detail"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Batch WIP tidak ditemukan</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {Object.values(filters).some(f => f) 
                  ? 'Tidak ada batch WIP yang cocok dengan filter atau pencarian.'
                  : 'Belum ada batch WIP.'
                }
              </p>
              <div className="flex justify-center space-x-4">
                {Object.values(filters).some(f => f) && (
                  <button onClick={clearFilters} className="btn-secondary">
                    Hapus Filter
                  </button>
                )}
                <Link to="/app/production/wip-batches/new" className="btn-primary">
                  Buat Batch WIP Pertama
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WIPBatchList;
