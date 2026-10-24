import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import DocumentGenerateButton from '../../components/DocumentGenerateButton';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { showSuccess, showError } from '../../components/ui/Toast';

interface GLEntry {
  id: number;
  entry_number: string;
  account_code: string | null;
  account_name: string | null;
  debit_amount: number;
  credit_amount: number;
  description: string | null;
}

interface PaymentDetailData {
  id: number;
  payment_number: string;
  payment_type: string;
  payment_date: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  notes: string | null;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_total_amount: number | null;
  invoice_status: string | null;
  customer_id: number | null;
  customer_name: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  bank_account_id: number | null;
  bank_account_name: string | null;
  bank_account_code: string | null;
  received_by_name: string | null;
  created_at: string | null;
  voided_by: number | null;
  voided_at: string | null;
  void_reason: string | null;
  allocations: { invoice_id: number; invoice_number: string | null; invoice_total_amount: number | null; amount: number }[];
  lines: { account_id?: number; account_code: string | null; account_name: string | null; amount: number; description: string | null }[];
  gl_entries: GLEntry[];
}

const formatRupiah = (value: number | null | undefined) =>
  `Rp ${Math.round(value || 0).toLocaleString('id-ID')}`;

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'cleared':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'bounced':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  }
};

export default function PaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/finance/payments/${id}`);
        setPayment(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Gagal memuat data pembayaran');
      } finally {
        setLoading(false);
      }
    };
    fetchPayment();
  }, [id]);

  const handleVoid = async () => {
    if (!payment) return;
    if (!(await confirmDialog(`Void ${payment.payment_number}? Jurnal akan dibalik dan saldo faktur dikembalikan.`, { title: 'Void Transaksi', confirmText: 'Ya, Void' }))) return;
    try {
      await axiosInstance.post(`/api/finance/payments/${payment.id}/void`, { reason: voidReason || undefined });
      showSuccess('Transaksi berhasil di-void');
      const res = await axiosInstance.get(`/api/finance/payments/${payment.id}`);
      setPayment(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal void transaksi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-red-600 dark:text-red-400">{error || 'Payment tidak ditemukan'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          Kembali
        </button>
      </div>
    );
  }

  // payment_type values are inconsistent in real production data ('receipt'
  // vs 'received' both exist for the same AR concept) - customer_id vs
  // supplier_id is the reliable signal for which side of the transaction
  // this is, same as the backend's own create_payment() logic.
  const isReceipt = payment.customer_id != null || (payment.supplier_id == null && payment.payment_type === 'receipt');
  const isInvoiceBased = (payment.allocations?.length ?? 0) > 0 || !!payment.invoice_id;
  const editHref = `${isInvoiceBased ? (isReceipt ? '/app/finance/penerimaan-penjualan/new' : '/app/finance/pembayaran-pembelian/new') : (isReceipt ? '/app/finance/penerimaan/new' : '/app/finance/pembayaran/new')}?edit=${payment.id}`;
  const totalDebit = payment.gl_entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0);
  const totalCredit = payment.gl_entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{payment.payment_number}</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {isReceipt ? 'Penerimaan dari Pelanggan (AR)' : 'Pembayaran ke Supplier (AP)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass(payment.status)}`}>
            {payment.status.toUpperCase()}
          </span>
          <button onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
            Kembali
          </button>
        </div>
      </div>

      {payment.status !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <DocumentGenerateButton
            transactionType="payment"
            transactionId={payment.id}
            transactionNumber={payment.payment_number}
            label="Cetak Bukti"
          />
          <button
            onClick={() => navigate(editHref)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Ubah
          </button>
          <input
            className="input w-64"
            placeholder="Alasan void (opsional)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <button onClick={handleVoid} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Void
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Jumlah</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatRupiah(payment.amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tanggal Pembayaran</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('id-ID') : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Metode Pembayaran</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{payment.payment_method.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No. Referensi</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{payment.reference_number || '-'}</p>
          </div>
        </div>

        {payment.allocations?.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Pelunasan Invoice</p>
            <table className="w-full text-sm text-blue-900 dark:text-blue-100">
              <thead>
                <tr className="text-left text-xs uppercase opacity-70">
                  <th className="py-1">No. Invoice</th>
                  <th className="py-1 text-right">Total Invoice</th>
                  <th className="py-1 text-right">Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {payment.allocations.map((a) => (
                  <tr key={a.invoice_id}>
                    <td className="py-1">
                      <a href={`/app/finance/invoices/${a.invoice_id}`} className="underline hover:text-blue-600">{a.invoice_number}</a>
                    </td>
                    <td className="py-1 text-right">{formatRupiah(a.invoice_total_amount)}</td>
                    <td className="py-1 text-right font-medium">{formatRupiah(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {payment.lines?.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Rincian Akun</p>
            <table className="w-full text-sm text-gray-900 dark:text-gray-100">
              <thead>
                <tr className="text-left text-xs uppercase opacity-70">
                  <th className="py-1">Akun</th>
                  <th className="py-1">Keterangan</th>
                  <th className="py-1 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {payment.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1">{l.account_code} - {l.account_name}</td>
                    <td className="py-1">{l.description || '-'}</td>
                    <td className="py-1 text-right font-medium">{formatRupiah(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{isReceipt ? 'Pelanggan' : 'Supplier'}</p>
            <p className="text-base text-gray-900 dark:text-white">
              {isReceipt ? (payment.customer_name || '-') : (payment.supplier_name || '-')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Akun Kas/Bank</p>
            <p className="text-base text-gray-900 dark:text-white">
              {payment.bank_account_code ? `${payment.bank_account_code} - ${payment.bank_account_name}` : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Diterima/Diinput Oleh</p>
            <p className="text-base text-gray-900 dark:text-white">{payment.received_by_name || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Dibuat Pada</p>
            <p className="text-base text-gray-900 dark:text-white">
              {payment.created_at ? new Date(payment.created_at).toLocaleString('id-ID') : '-'}
            </p>
          </div>
        </div>

        {payment.notes && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Catatan</p>
            <p className="text-base text-gray-900 dark:text-white">{payment.notes}</p>
          </div>
        )}

        {payment.status === 'cancelled' && payment.void_reason && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Dibatalkan (void):</strong> {payment.void_reason}
              {payment.voided_at && ` — ${new Date(payment.voided_at).toLocaleString('id-ID')}`}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Jurnal Akuntansi (General Ledger)</h2>
        {payment.gl_entries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Belum ada jurnal terkait pembayaran ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Jurnal</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Akun</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deskripsi</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Debit</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payment.gl_entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{e.entry_number}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{e.account_code} - {e.account_name}</td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{e.description}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">{e.debit_amount > 0 ? formatRupiah(e.debit_amount) : '-'}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">{e.credit_amount > 0 ? formatRupiah(e.credit_amount) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">Total (Seimbang)</td>
                  <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">{formatRupiah(totalDebit)}</td>
                  <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">{formatRupiah(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
