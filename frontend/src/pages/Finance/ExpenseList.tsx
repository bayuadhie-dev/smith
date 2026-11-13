import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';
import { usePermissions } from '../../contexts/PermissionContext';
import { confirmDialog } from '../../components/ui';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
import { Skeleton } from '../../components/ui/Skeleton'

interface Expense {
  id: number;
  expense_number: string;
  employee_name: string;
  expense_date: string;
  expense_category: string;
  expense_type: string;
  description: string;
  amount: number;
  currency: string;
  amount_base: number;
  status: string;
  status_display: string;
  manager_status: string;
  required_manager_id: number | null;
  receipt_file_name: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  reimbursement_number: string | null;
  reimbursement_status_display?: string | null;
  created_at: string;
}

const MANAGER_LABEL: Record<string, string> = { approved: 'Disetujui', rejected: 'Ditolak', pending: 'Menunggu' };

const COLUMNS: ListColumn<Expense>[] = [
  { key: 'expense_number', label: 'No. Klaim', value: (e) => e.expense_number },
  { key: 'employee_name', label: 'Karyawan', value: (e) => e.employee_name },
  { key: 'expense_date', label: 'Tanggal', value: (e) => e.expense_date, type: 'date' },
  { key: 'expense_category', label: 'Kategori', value: (e) => e.expense_category },
  { key: 'description', label: 'Keterangan', value: (e) => e.description },
  { key: 'amount_base', label: 'Jumlah (Rp)', value: (e) => e.amount_base, type: 'number' },
  { key: 'status', label: 'Status', value: (e) => e.status_display || e.status },
  { key: 'manager_status', label: 'Persetujuan Manager', value: (e) => (e.required_manager_id ? MANAGER_LABEL[e.manager_status] || e.manager_status : '') },
  { key: 'reimbursement_number', label: 'No. Pembayaran', value: (e) => e.reimbursement_number },
  { key: 'receipt', label: 'Bukti', value: (e) => (e.receipt_file_name ? 'Ada' : 'Tidak ada') },
];

const ExpenseList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, [statusFilter, categoryFilter]);

  const tools = useListTools<Expense>(expenses, COLUMNS, { filename: 'Klaim_Karyawan', initialSort: { key: 'expense_date', dir: 'desc' } });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        per_page: '1000',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const { data } = await axiosInstance.get(`/api/expenses?${params}`);
      setExpenses(data.expenses || []);
    } catch (error) {
      toast.error('Gagal memuat data expense');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (expenseId: number, action: string) => {
    const actionConfig: Record<string, { url: string; body?: any; confirm?: string; success: string }> = {
      submit: { url: `/api/expenses/${expenseId}/submit`, success: 'Expense berhasil disubmit' },
      approve: { url: `/api/expenses/${expenseId}/approve`, success: 'Expense berhasil disetujui' },
      'manager-approve': { url: `/api/expenses/${expenseId}/manager-approve`, body: { decision: 'approved' }, success: 'Disetujui sebagai manager' },
      delete: { url: `/api/expenses/${expenseId}`, confirm: 'Hapus expense ini?', success: 'Expense berhasil dihapus' },
    };

    try {
      if (action === 'reject') {
        const reason = window.prompt('Alasan penolakan:');
        if (!reason) return;
        await axiosInstance.post(`/api/expenses/${expenseId}/reject`, { rejection_reason: reason });
        toast.success('Expense berhasil ditolak');
        fetchExpenses();
        return;
      }

      const config = actionConfig[action];
      if (!config) return;
      if (config.confirm && !(await confirmDialog(config.confirm))) return;

      if (action === 'delete') {
        await axiosInstance.delete(config.url);
      } else {
        await axiosInstance.post(config.url, config.body || {});
      }
      toast.success(config.success);
      fetchExpenses();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Aksi gagal diproses');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'paid':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  const categories = [
    'Travel',
    'Meals',
    'Office Supplies',
    'Transportation',
    'Accommodation',
    'Communication',
    'Training',
    'Entertainment',
    'Other',
  ];

  if (!hasPermission('expense.view')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Akses ditolak</h2>
          <p className="text-gray-500 dark:text-gray-400">Anda tidak punya izin untuk melihat klaim biaya</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Klaim Karyawan</h1>
          <p className="text-gray-600 dark:text-gray-300">Nota biaya yang diajukan karyawan</p>
        </div>
        {hasPermission('expense.create') && (
          <button
            onClick={() => navigate('/app/finance/expenses/new')}
            className="btn-primary"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Buat Klaim
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 dark:bg-gray-800">
        <div className="flex flex-wrap gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Diajukan</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="paid">Dibayar</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600"
          >
            <option value="">Semua kategori</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <ListToolbar tools={tools} placeholder="Cari nomor, karyawan, kategori, keterangan" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="expense_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">No. Klaim</SortTh>
                <SortTh tools={tools} col="employee_name" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Karyawan</SortTh>
                <SortTh tools={tools} col="expense_date" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tanggal</SortTh>
                <SortTh tools={tools} col="expense_category" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Kategori</SortTh>
                <SortTh tools={tools} col="description" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Keterangan</SortTh>
                <SortTh tools={tools} col="amount_base" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Jumlah</SortTh>
                <SortTh tools={tools} col="status" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</SortTh>
                <SortTh tools={tools} col="receipt" align="center" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Bukti</SortTh>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="space-y-2 px-6 py-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</td>
                </tr>
              ) : tools.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    {tools.total === 0 ? 'Belum ada klaim' : 'Tidak ada klaim yang cocok'}
                  </td>
                </tr>
              ) : (
                tools.rows.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {expense.expense_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {expense.employee_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {new Date(expense.expense_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {expense.expense_category}
                    </td>
                    <td className="px-6 py-4 text-gray-900 max-w-xs truncate dark:text-white">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-medium dark:text-white">
                      Rp {expense.amount_base.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                        {expense.status_display}
                      </span>
                      {expense.required_manager_id && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Manager: {MANAGER_LABEL[expense.manager_status] || expense.manager_status}
                        </div>
                      )}
                      {expense.reimbursement_number && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Pembayaran: {expense.reimbursement_status_display}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {expense.receipt_file_name ? (
                        <Eye className="w-5 h-5 text-primary-700 mx-auto cursor-pointer hover:text-primary-800 dark:text-primary-300" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        {expense.status === 'draft' && hasPermission('expense.submit') && (
                          <button
                            onClick={() => handleStatusChange(expense.id, 'submit')}
                            className="p-1 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400"
                            title="Ajukan"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {expense.status === 'submitted' && expense.manager_status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(expense.id, 'manager-approve')}
                            className="p-1 text-primary-700 hover:text-primary-800 dark:text-primary-300"
                            title="Setujui sebagai Manager Departemen"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {expense.status === 'submitted' && hasPermission('expense.approve') && (
                          <>
                            <button
                              onClick={() => handleStatusChange(expense.id, 'approve')}
                              className="p-1 text-green-600 hover:text-green-800 dark:text-green-400"
                              title={expense.manager_status === 'pending' ? 'Setujui (menunggu persetujuan manager dulu)' : 'Setujui'}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(expense.id, 'reject')}
                              className="p-1 text-red-600 hover:text-red-800 dark:text-red-400"
                              title="Tolak"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {expense.status === 'draft' && hasPermission('expense.edit') && (
                          <button
                            onClick={() => navigate(`/app/finance/expenses/${expense.id}/edit`)}
                            className="p-1 text-primary-700 hover:text-primary-800 dark:text-primary-300"
                            title="Ubah"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {(expense.status === 'draft' || expense.status === 'rejected') && hasPermission('expense.delete') && (
                          <button
                            onClick={() => handleStatusChange(expense.id, 'delete')}
                            className="p-1 text-red-600 hover:text-red-800 dark:text-red-400"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default ExpenseList;
