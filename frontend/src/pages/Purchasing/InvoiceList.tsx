import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  MagnifyingGlassIcon, ArrowPathIcon, DocumentCurrencyDollarIcon,
  BanknotesIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  posted:    { label: 'Posted',     color: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Lunas',      color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Batal',      color: 'bg-red-100 text-red-700' },
};

const PAY_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid:  { label: 'Belum Bayar', color: 'bg-orange-100 text-orange-700' },
  partial: { label: 'Sebagian',    color: 'bg-yellow-100 text-yellow-700' },
  paid:    { label: 'Lunas',       color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Lewat Tempo', color: 'bg-red-100 text-red-700' },
};

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [payModal, setPayModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('transfer');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 25 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/purchasing/purchase-invoices/summary', { params });
      setInvoices(res.data.invoices || []);
      setTotal(res.data.total || 0);
    } catch {
      // fallback to regular invoice endpoint
      try {
        const res = await axiosInstance.get('/api/purchasing/purchase-invoices', {
          params: { page, per_page: 25, status: statusFilter || undefined, search: search || undefined },
        });
        setInvoices(res.data.purchase_invoices || res.data.invoices || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!payModal) return;
    setPaying(true);
    try {
      const res = await axiosInstance.post(
        `/api/purchasing/purchase-invoices/${payModal.id}/record-payment`,
        { amount: parseFloat(payAmount), payment_method: payMethod, notes: payNotes }
      );
      toast.success(res.data.message);
      setPayModal(null);
      setPayAmount('');
      setPayNotes('');
      fetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal mencatat pembayaran');
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [page, statusFilter]);
  useEffect(() => {
    const t = setTimeout(fetchInvoices, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Invoice</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tagihan supplier & 3-Way Matching — {total} total</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Memuat...
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DocumentCurrencyDollarIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Belum ada invoice</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. PO</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Jatuh Tempo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">GRN</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pembayaran</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {invoices.map((inv) => {
                const status = STATUS_CONFIG[inv.status] || { label: inv.status, color: 'bg-gray-100 text-gray-700' };
                const pay = PAY_CONFIG[inv.payment_status] || { label: inv.payment_status, color: 'bg-gray-100 text-gray-700' };
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.payment_status !== 'paid';
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/invoices/${inv.id}/match`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{inv.po_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{inv.supplier_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('id-ID') : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '—'}
                      {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                      Rp {Number(inv.total_amount).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${(inv.grn_count || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {inv.grn_count || 0} GRN
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${pay.color}`}>{pay.label}</span>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/app/purchasing/invoices/${inv.id}/match`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        3-Way Match
                      </Link>
                      {inv.payment_status !== 'paid' && (
                        <button
                          onClick={() => { setPayModal(inv); setPayAmount(String(inv.total_amount || '')); }}
                          className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                        >
                          <BanknotesIcon className="h-3.5 w-3.5" /> Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">💳 Catat Pembayaran</h2>
              <button onClick={() => setPayModal(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="text-sm text-gray-500">
              <p>Invoice: <strong className="text-gray-800 dark:text-white">{payModal.invoice_number}</strong></p>
              <p>Total: <strong>Rp {Number(payModal.total_amount).toLocaleString('id-ID')}</strong></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah Bayar (Rp)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metode Pembayaran</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="transfer">Transfer Bank</option>
                  <option value="cash">Tunai</option>
                  <option value="giro">Giro</option>
                  <option value="cek">Cek</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  placeholder="No. referensi, keterangan..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">Batal</button>
              <button
                onClick={handlePayment}
                disabled={paying || !payAmount}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {paying ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <BanknotesIcon className="h-4 w-4" />}
                Catat Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {total > 25 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">Hal {page}</span>
          <button disabled={invoices.length < 25} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
