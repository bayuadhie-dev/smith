import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
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
  receipt_file_name: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  reimbursement_number: string | null;
  created_at: string;
}

const ExpenseList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchExpenses();
  }, [page, statusFilter, categoryFilter, searchTerm]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);

      const { data } = await axiosInstance.get(`/api/expenses?${params}`);
      setExpenses(data.expenses || []);
      setTotalPages(data.pagination?.pages || 1);
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
      if (config.confirm && !window.confirm(config.confirm)) return;

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
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view expenses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600">Manage employee expense claims</p>
        </div>
        {hasPermission('expense.create') && (
          <button
            onClick={() => navigate('/app/finance/expenses/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Expense
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expense No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No expenses found
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {expense.expense_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {expense.employee_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {expense.expense_category}
                    </td>
                    <td className="px-6 py-4 text-gray-900 max-w-xs truncate">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-medium">
                      Rp {expense.amount_base.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                        {expense.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {expense.receipt_file_name ? (
                        <Eye className="w-5 h-5 text-blue-600 mx-auto cursor-pointer hover:text-blue-800" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        {expense.status === 'draft' && hasPermission('expense.submit') && (
                          <button
                            onClick={() => handleStatusChange(expense.id, 'submit')}
                            className="p-1 text-yellow-600 hover:text-yellow-800"
                            title="Submit"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {expense.status === 'submitted' && hasPermission('expense.approve') && (
                          <>
                            <button
                              onClick={() => handleStatusChange(expense.id, 'approve')}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(expense.id, 'reject')}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {expense.status === 'draft' && hasPermission('expense.edit') && (
                          <button
                            onClick={() => navigate(`/app/finance/expenses/${expense.id}/edit`)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {(expense.status === 'draft' || expense.status === 'rejected') && hasPermission('expense.delete') && (
                          <button
                            onClick={() => handleStatusChange(expense.id, 'delete')}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Delete"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseList;
