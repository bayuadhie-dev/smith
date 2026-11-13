import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';
import { usePermissions } from '../../contexts/PermissionContext';
import { confirmDialog } from '../../components/ui';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

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

const COLUMNS: ListColumn<Reimbursement>[] = [
  { key: 'reimbursement_number', label: 'No. Pembayaran Klaim', value: (r) => r.reimbursement_number },
  { key: 'employee_name', label: 'Karyawan', value: (r) => r.employee_name },
  { key: 'total_amount', label: 'Total (Rp)', value: (r) => r.total_amount, type: 'number' },
  { key: 'expense_count', label: 'Jumlah Klaim', value: (r) => r.expense_count, type: 'number' },
  { key: 'payment_method', label: 'Metode Pembayaran', value: (r) => r.payment_method },
  { key: 'status', label: 'Status', value: (r) => r.status_display || r.status },
  { key: 'submitted_at', label: 'Tanggal Diajukan', value: (r) => r.submitted_at, type: 'date' },
  { key: 'approved_at', label: 'Tanggal Disetujui', value: (r) => r.approved_at, type: 'date' },
  { key: 'paid_at', label: 'Tanggal Dibayar', value: (r) => r.paid_at, type: 'date' },
];

const ReimbursementList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchReimbursements();
  }, [statusFilter]);

  const tools = useListTools<Reimbursement>(reimbursements, COLUMNS, { filename: 'Pembayaran_Klaim', initialSort: { key: 'reimbursement_number', dir: 'desc' } });

  const fetchReimbursements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        per_page: '1000',
      });

      if (statusFilter) params.append('status', statusFilter);

      const { data } = await axiosInstance.get(`/api/expenses/reimbursements?${params}`);
      setReimbursements(data.reimbursements || []);
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
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300';
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
          <p className="text-gray-600 dark:text-gray-300">Akses ditolak</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pembayaran Klaim</h1>
          <p className="text-gray-600 dark:text-gray-300">Persetujuan dan pembayaran klaim karyawan</p>
        </div>
        {hasPermission('expense.create') && (
          <button
            onClick={() => navigate('/app/finance/reimbursements/new')}
            className="btn-primary"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Buat Pembayaran Klaim
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
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="processing">Diproses</option>
            <option value="paid">Dibayar</option>
            <option value="cancelled">Batal</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <ListToolbar tools={tools} placeholder="Cari nomor, karyawan, metode, status" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="reimbursement_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">No. Pembayaran Klaim</SortTh>
                <SortTh tools={tools} col="employee_name" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Karyawan</SortTh>
                <SortTh tools={tools} col="total_amount" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Total</SortTh>
                <SortTh tools={tools} col="expense_count" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Jumlah Klaim</SortTh>
                <SortTh tools={tools} col="payment_method" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Metode Pembayaran</SortTh>
                <SortTh tools={tools} col="status" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</SortTh>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Memuat...
                  </td>
                </tr>
              ) : tools.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    {tools.total === 0 ? 'Belum ada pembayaran klaim' : 'Tidak ada data yang cocok'}
                  </td>
                </tr>
              ) : (
                tools.rows.map((reimb) => (
                  <tr key={reimb.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {reimb.reimbursement_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {reimb.employee_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-medium dark:text-white">
                      Rp {reimb.total_amount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                      {reimb.expense_count} klaim
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
                            title="Setujui"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {reimb.status === 'approved' && (hasPermission('expense.payment') || reimb.has_steps) && (
                          <button
                            onClick={() => handlePay(reimb)}
                            className="p-1 text-primary-700 hover:text-primary-800 dark:text-primary-300"
                            title="Bayar"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/app/finance/reimbursements/${reimb.id}`)}
                          className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                          title="Lihat detail"
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
