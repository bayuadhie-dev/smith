import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { Calendar, Package, TrendingUp, AlertCircle, CheckCircle, Clock, Play, FileText } from 'lucide-react';
import { confirmDialog, showError, showSuccess } from '../../components/ui';
import NumberInput from '../../components/ui/NumberInput'
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
import { TableSkeleton } from '../../components/ui/Skeleton'

interface ProductionPlan {
  id: number;
  plan_number: string;
  plan_name: string;
  plan_type: string;
  period_start: string;
  period_end: string;
  product_name: string;
  product_code: string;
  planned_quantity: number;
  actual_quantity: number;
  completion_percentage: number;
  uom: string;
  status: string;
  priority: string;
  based_on: string;
  machine_name: string | null;
  created_at: string;
  created_by: string | null;
}

interface GenerateWOModal {
  show: boolean;
  planId: number | null;
  planNumber: string;
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', approved: 'Disetujui', released: 'Dirilis', completed: 'Selesai', cancelled: 'Dibatalkan' };
const PRIORITY_LABEL: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };
const TYPE_LABEL: Record<string, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };
const COLUMNS: ListColumn<ProductionPlan>[] = [
  { key: 'plan_number', label: 'No. Rencana', value: (p) => p.plan_number },
  { key: 'plan_type', label: 'Jenis', value: (p) => p.plan_type, exportValue: (p) => TYPE_LABEL[p.plan_type] || p.plan_type, sortable: false },
  { key: 'plan_name', label: 'Nama Rencana', value: (p) => p.plan_name },
  { key: 'product_name', label: 'Produk', value: (p) => p.product_name },
  { key: 'product_code', label: 'Kode Produk', value: (p) => p.product_code, sortable: false },
  { key: 'period_start', label: 'Periode Mulai', value: (p) => p.period_start, type: 'date' },
  { key: 'period_end', label: 'Periode Selesai', value: (p) => p.period_end, type: 'date', sortable: false },
  { key: 'planned_quantity', label: 'Qty Rencana', value: (p) => p.planned_quantity, type: 'number' },
  { key: 'actual_quantity', label: 'Qty Aktual', value: (p) => p.actual_quantity, type: 'number', sortable: false },
  { key: 'uom', label: 'Satuan', value: (p) => p.uom, sortable: false },
  { key: 'completion_percentage', label: 'Progres (%)', value: (p) => p.completion_percentage, type: 'number' },
  { key: 'status', label: 'Status', value: (p) => p.status, exportValue: (p) => STATUS_LABEL[p.status] || p.status },
  { key: 'priority', label: 'Prioritas', value: (p) => p.priority, exportValue: (p) => PRIORITY_LABEL[p.priority] || p.priority },
];

const ProductionPlanningList: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    plan_type: ''
  });
  const tools = useListTools<ProductionPlan>(plans, COLUMNS, { filename: 'Rencana_Produksi', initialSort: { key: 'period_start', dir: 'desc' } });

  const [generateModal, setGenerateModal] = useState<GenerateWOModal>({
    show: false,
    planId: null,
    planNumber: ''
  });

  const [woGenerateOptions, setWoGenerateOptions] = useState({
    split_by: 'single',
    batch_size: 0
  });

  useEffect(() => {
    fetchPlans();
  }, [filters]);

  const fetchPlans = async () => {
    try {
      const params = new URLSearchParams();
      
      params.append('per_page', '1000');
      if (filters.status) params.append('status', filters.status);
      if (filters.plan_type) params.append('plan_type', filters.plan_type);

      const response = await axiosInstance.get(
        `/api/production-planning/production-plans?${params.toString()}`
      );

      setPlans(response.data.plans || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePlan = async (planId: number) => {
    if (!(await confirmDialog('Setujui rencana produksi ini?'))) return;

    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post(
        `/api/production-planning/production-plans/${planId}/approve`,
        {}
      );

      showSuccess('Rencana produksi disetujui');
      fetchPlans();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal menyetujui rencana');
    }
  };

  const handleGenerateWO = async () => {
    if (!generateModal.planId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axiosInstance.post(
        `/api/production-planning/production-plans/${generateModal.planId}/generate-work-orders`,
        woGenerateOptions
      );

      showSuccess(`${response.data.data.work_orders.length} SPK berhasil dibuat`);
      setGenerateModal({ show: false, planId: null, planNumber: '' });
      fetchPlans();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal membuat SPK');
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!(await confirmDialog('Hapus rencana produksi ini?'))) return;

    try {
      const token = localStorage.getItem('token');
      await axiosInstance.delete(
        `/api/production-planning/production-plans/${planId}`
      );

      showSuccess('Rencana produksi dihapus');
      fetchPlans();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal menghapus rencana');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      released: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };
    return badges[status] || badges.draft;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
      normal: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };
    return badges[priority] || badges.normal;
  };

  if (loading) {
    return (
      <TableSkeleton rows={8} cols={7} />
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Perencanaan Produksi</h1>
            <p className="text-gray-600 dark:text-gray-300">Jadwal Induk Produksi (MPS)</p>
          </div>
          <button
            onClick={() => navigate('/app/production/planning/create')}
            className="px-4 py-2 bg-cta-600 text-white rounded-lg hover:bg-cta-700 flex items-center gap-2"
          >
            <FileText size={20} />
            Buat Rencana
          </button>
        </div>
      </div>

      <div className="mb-4"><ListToolbar tools={tools} placeholder="Cari nomor rencana, nama, atau produk" /></div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="approved">Disetujui</option>
            <option value="released">Dirilis</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

          <select
            value={filters.plan_type}
            onChange={(e) => setFilters({ ...filters, plan_type: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Semua Jenis</option>
            <option value="daily">Harian</option>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
          </select>

          <button
            onClick={() => navigate('/app/production/planning/dashboard')}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:bg-gray-700 flex items-center gap-2 justify-center dark:hover:bg-gray-600"
          >
            <TrendingUp size={20} />
            Dashboard
          </button>
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortTh tools={tools} col="plan_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Rencana</SortTh>
              <SortTh tools={tools} col="plan_name" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama Rencana</SortTh>
              <SortTh tools={tools} col="product_name" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</SortTh>
              <SortTh tools={tools} col="period_start" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Periode</SortTh>
              <SortTh tools={tools} col="planned_quantity" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Jumlah</SortTh>
              <SortTh tools={tools} col="completion_percentage" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progres</SortTh>
              <SortTh tools={tools} col="status" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
              <SortTh tools={tools} col="priority" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prioritas</SortTh>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {tools.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  {tools.total === 0 ? 'Belum ada rencana produksi' : 'Tidak ada rencana yang cocok'}
                </td>
              </tr>
            ) : (
              tools.rows.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{plan.plan_number}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{plan.plan_type}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{plan.plan_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Dasar: {plan.based_on}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{plan.product_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{plan.product_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {new Date(plan.period_start).toLocaleDateString('id-ID')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      s/d {new Date(plan.period_end).toLocaleDateString('id-ID')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {plan.planned_quantity.toLocaleString()} {plan.uom}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Aktual: {plan.actual_quantity.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${plan.completion_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">{plan.completion_percentage}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(plan.status)}`}>
                      {STATUS_LABEL[plan.status] || plan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getPriorityBadge(plan.priority)}`}>
                      {PRIORITY_LABEL[plan.priority] || plan.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {plan.status === 'draft' && (
                        <button
                          onClick={() => handleApprovePlan(plan.id)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400"
                          title="Setujui"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                      {plan.status === 'approved' && (
                        <button
                          onClick={() => setGenerateModal({ show: true, planId: plan.id, planNumber: plan.plan_number })}
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400"
                          title="Buat SPK"
                        >
                          <Play size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/app/production/planning/edit/${plan.id}`)}
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400"
                        title="Ubah"
                      >
                        Ubah
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        title="Hapus"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Generate WO Modal */}
      {generateModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Buat SPK
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Rencana: {generateModal.planNumber}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Cara Pemecahan
              </label>
              <select
                value={woGenerateOptions.split_by}
                onChange={(e) => setWoGenerateOptions({ ...woGenerateOptions, split_by: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="single">Satu SPK</option>
                <option value="week">Pecah per Minggu</option>
                <option value="batch">Pecah per Ukuran Batch</option>
              </select>
            </div>

            {woGenerateOptions.split_by === 'batch' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Ukuran Batch
                </label>
                <NumberInput
                  value={woGenerateOptions.batch_size}
                  onChange={(e) => setWoGenerateOptions({ ...woGenerateOptions, batch_size: Number(e.target.value) })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setGenerateModal({ show: false, planId: null, planNumber: '' })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateWO}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Buat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionPlanningList;
