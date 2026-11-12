import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';
import { usePermissions } from '../../contexts/PermissionContext';
import { confirmDialog } from '../../components/ui';

interface Reimbursement {
  id: number;
  reimbursement_number: string;
  employee_name: string;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  has_steps?: boolean;
  assigned_user_id?: number | null;
  status: string;
  status_display: string;
  expense_count: number;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

const ReimbursementList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReimbursements();
  }, [page, statusFilter, searchTerm]);

  const fetchReimbursements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const { data } = await axiosInstance.get(`/api/expenses/reimbursements?${params}`);
      setReimbursements(data.reimbursements || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Gagal memuat data reimbursement');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reimbursementId: number) => {
    if (!(await confirmDialog('Setujui reimbursement ini?'))) return;
    try {
      await axiosInstance.post(`/api/expenses/reimbursements/${reimbursementId}/approve`, {});
      toast.success('Reimbursement berhasil disetujui');
      fetchReimbursements();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal menyetujui reimbursement');
    }
  };

  const [payFor, setPayFor] = useState<Reimbursement | null>(null);
  const [banks, setBanks] = useState<{ id: number; name: string }[]>([]);
  const [payBank, setPayBank] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const handlePay = async (r: Reimbursement) => {
    setPayFor(r); setPayRef(''); setPayBank(''); setPayDate(new Date().toISOString().slice(0, 10));
    if (banks.length === 0) {
      try {
        const res = await axiosInstance.get('/api/finance/chart-of-accounts');
        setBanks((res.data.accounts || []).filter((a: any) => a.is_cash_bank && !a.is_header && (a.currency || 'IDR') === 'IDR')
          .map((a: any) => ({ id: a.id, name: `${a.code} - ${a.name}` })));
      } catch { toast.error('Gagal memuat daftar akun kas/bank'); }
    }
  };

  const confirmPay = async () => {
    if (!payFor) return;
    if (!payBank) { toast.error('Pilih akun Kas/Bank sumber pembayaran'); return; }
    setPaying(true);
    try {
      await axiosInstance.post(`/api/expenses/reimbursements/${payFor.id}/pay`, {
        bank_account_id: Number(payBank), payment_date: payDate, payment_reference: payRef || undefined,
      });
      toast.success('Reimbursement dibayar dan dijurnal');
      setPayFor(null);
      fetchReimbursements();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal membayar reimbursement');
    } finally { setPaying(false); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'paid':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  if (!hasPermission('expense.view')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">Access Denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reimbursement</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage employee reimbursement batches</p>
        </div>
        {hasPermission('expense.create') && (
          <button
            onClick={() => navigate('/app/finance/reimbursements/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Reimbursement
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 dark:bg-gray-800">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search reimbursements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Reimbursement No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Employee
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Expense Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : reimbursements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No reimbursements found
                  </td>
                </tr>
              ) : (
                reimbursements.map((reimb) => (
                  <tr key={reimb.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {reimb.reimbursement_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {reimb.employee_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-medium dark:text-white">
                      Rp {reimb.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {reimb.expense_count} expenses
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {reimb.payment_method || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(reimb.status)}`}>
                        {reimb.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        {reimb.status === 'pending' && !reimb.has_steps && hasPermission('expense.approve') && (
                          <button
                            onClick={() => handleApprove(reimb.id)}
                            className="p-1 text-green-600 hover:text-green-800 dark:text-green-400"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {reimb.status === 'approved' && (hasPermission('expense.payment') || reimb.has_steps) && (
                          <button
                            onClick={() => handlePay(reimb)}
                            className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            title="Bayar"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/app/finance/reimbursements/${reimb.id}`)}
                          className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center dark:border-gray-700">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
            >
              Previous
            </button>
            <span className="text-gray-600 dark:text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
            >
              Next
            </button>
          </div>
        )}
      </div>
      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPayFor(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Bayar reimbursement</h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{payFor.reimbursement_number} · {payFor.employee_name} · Rp {Number(payFor.total_amount).toLocaleString('id-ID')}</p>
            <label className="mb-1 block text-sm font-medium">Dibayar dari akun Kas/Bank *</label>
            <select className="input-field mb-3" value={payBank} onChange={(e) => setPayBank(e.target.value)}>
              <option value="">Pilih akun kas/bank</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label className="mb-1 block text-sm font-medium">Tanggal pembayaran</label>
            <input type="date" className="input-field mb-3" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            <label className="mb-1 block text-sm font-medium">No. referensi transfer (opsional)</label>
            <input className="input-field mb-4" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="No. transfer atau bukti kas" />
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Jurnal: Hutang Karyawan didebit, akun Kas/Bank yang dipilih dikredit. Uang keluar tercatat di buku bank.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPayFor(null)}>Batal</button>
              <button type="button" className="btn-primary disabled:opacity-50" disabled={paying} onClick={confirmPay}>{paying ? 'Memproses...' : 'Bayar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReimbursementList;
