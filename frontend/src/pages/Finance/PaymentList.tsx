import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { BanknotesIcon, PlusIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

interface PaymentRow {
  id: number;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  bank_account: { code: string; name: string } | null;
  party_name: string | null;
  notes: string | null;
  invoice_numbers?: string[];
  account_lines?: number;
  reference_number: string | null;
  status: string;
}

interface PaymentListProps {
  type: 'receipt' | 'payment';
  source: 'kas' | 'invoice';
}

const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function firstDayOfMonth(): string {
  const d = new Date();
  return localISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

function today(): string {
  return localISO(new Date());
}

const statusLabel: Record<string, string> = {
  pending: 'Belum Direkonsiliasi',
  cleared: 'Sudah Direkonsiliasi',
  bounced: 'Bounced',
  cancelled: 'Dibatalkan',
};

const PaymentList: React.FC<PaymentListProps> = ({ type, source }) => {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankId, setBankId] = useState('');
  const [banks, setBanks] = useState<{ id: number; code: string; name: string }[]>([]);

  useEffect(() => {
    axiosInstance.get('/api/finance/reports/cash-accounts').then((r) => setBanks(r.data.accounts || [])).catch(() => setBanks([]));
  }, []);

  const isReceipt = type === 'receipt';
  const title = source === 'kas'
    ? (isReceipt ? 'Penerimaan Kas/Bank' : 'Pembayaran Kas/Bank')
    : (isReceipt ? 'Penerimaan Penjualan (Piutang)' : 'Pembayaran Pembelian (Hutang)');
  const newHref = source === 'kas'
    ? (isReceipt ? '/app/finance/penerimaan/new' : '/app/finance/pembayaran/new')
    : (isReceipt ? '/app/finance/penerimaan-penjualan/new' : '/app/finance/pembayaran-pembelian/new');
  const partyLabel = isReceipt ? 'Pelanggan' : 'Pemasok';

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(
        `/api/finance/payments?type=${type}&source=${source}&date_from=${dateFrom}&date_to=${dateTo}${bankId ? `&bank_account_id=${bankId}` : ''}`
      );
      setRows(res.data.payments || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [type, source, dateFrom, dateTo, bankId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns = React.useMemo<ListColumn<PaymentRow>[]>(() => [
    { key: 'payment_number', label: 'No. Transaksi', value: (r) => r.payment_number },
    { key: 'payment_date', label: 'Tanggal', value: (r) => r.payment_date, type: 'date' },
    { key: 'bank', label: 'Kas/Bank', value: (r) => (r.bank_account ? `${r.bank_account.code} ${r.bank_account.name}` : '') },
    { key: 'party_name', label: partyLabel, value: (r) => r.party_name },
    { key: 'description', label: 'Keterangan', value: (r) => [r.invoice_numbers?.length ? `Pelunasan: ${r.invoice_numbers.join(', ')}` : '', r.notes || r.reference_number].filter(Boolean).join(' ') },
    { key: 'reference_number', label: 'No. Referensi', value: (r) => r.reference_number },
    { key: 'amount', label: 'Nilai', value: (r) => r.amount, type: 'number' },
    { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => statusLabel[r.status] || r.status },
  ], [partyLabel]);
  const tools = useListTools<PaymentRow>(rows, columns, {
    filename: source === 'kas' ? (isReceipt ? 'Penerimaan_Kas_Bank' : 'Pembayaran_Kas_Bank') : (isReceipt ? 'Penerimaan_Penjualan' : 'Pembayaran_Pembelian'),
    initialSort: { key: 'payment_date', dir: 'desc' },
  });

  const total = tools.rows
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-primary-700 dark:text-primary-300" />
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
        <Link
          to={`/app/imports?kind=${type}_${source}`}
          className="flex items-center gap-1 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
          title="Buka Pusat Impor & Ekspor Data"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          Impor
        </Link>
        <Link
          to={`/app/imports?kind=${type}_${source}&mode=export`}
          className="flex items-center gap-1 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
          title="Buka Pusat Ekspor (pilih rentang tanggal dan format)"
        >
          Pusat Ekspor
        </Link>
        <Link
          to={newHref}
          className="btn-primary"
        >
          <PlusIcon className="w-4 h-4" />
          Catat {isReceipt ? 'Penerimaan' : 'Pembayaran'}
        </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4 dark:bg-gray-800">
        <div>
          <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Dari Tanggal</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Sampai Tanggal</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Kas/Bank</label>
          <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="border rounded px-3 py-2 min-w-[14rem]">
            <option value="">Semua Kas/Bank</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
          </select>
        </div>
        <button onClick={fetchRows} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800">
          Tampilkan
        </button>
      </div>

      <ListToolbar tools={tools} placeholder="No. bukti, pihak, kas/bank, faktur, keterangan, nominal" />

      {loading && <LoadingSpinner />}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-x-auto dark:bg-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="payment_number" className="px-4 py-2 text-left">No. Transaksi</SortTh>
                <SortTh tools={tools} col="payment_date" className="px-4 py-2 text-left">Tanggal</SortTh>
                <SortTh tools={tools} col="bank" className="px-4 py-2 text-left">Kas/Bank</SortTh>
                <SortTh tools={tools} col="party_name" className="px-4 py-2 text-left">{partyLabel}</SortTh>
                <SortTh tools={tools} col="description" className="px-4 py-2 text-left">Keterangan</SortTh>
                <SortTh tools={tools} col="reference_number" className="px-4 py-2 text-left">No. Referensi</SortTh>
                <SortTh tools={tools} col="amount" align="right" className="px-4 py-2 text-right">Nilai</SortTh>
                <SortTh tools={tools} col="status" align="center" className="px-4 py-2 text-center">Status</SortTh>
              </tr>
            </thead>
            <tbody>
              {tools.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Tidak ada {isReceipt ? 'penerimaan' : 'pembayaran'} {tools.query.trim() ? 'yang cocok dengan pencarian' : 'pada periode ini'}.
                  </td>
                </tr>
              )}
              {tools.rows.map((r) => (
                <tr key={r.id} className={`border-t ${r.status === 'cancelled' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2">
                    <Link to={`/app/finance/payments/${r.id}`} className="text-primary-700 hover:underline dark:text-primary-300">
                      {r.payment_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{r.payment_date}</td>
                  <td className="px-4 py-2">
                    {r.bank_account ? `${r.bank_account.code} - ${r.bank_account.name}` : '-'}
                  </td>
                  <td className="px-4 py-2">{r.party_name || '-'}</td>
                  <td className="px-4 py-2">
                    {r.invoice_numbers && r.invoice_numbers.length > 0 && (
                      <div className="text-xs text-blue-700 dark:text-blue-300">Pelunasan: {r.invoice_numbers.join(', ')}</div>
                    )}
                    {(r.account_lines ?? 0) > 1 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{r.account_lines} akun</div>
                    )}
                    {r.notes || r.reference_number || (r.invoice_numbers?.length ? '' : '-')}
                  </td>
                  <td className="px-4 py-2">{r.reference_number || '-'}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(r.amount)}</td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        r.status === 'cancelled'
                          ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                          : r.status === 'cleared'
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                      } dark:bg-red-900/20 dark:bg-green-900/20 dark:bg-yellow-900/20 dark:text-red-400 dark:text-green-300 dark:text-yellow-300`}
                      title={r.status === 'pending' ? 'Transaksi sudah dijurnal (tidak perlu approval). Status berubah otomatis setelah dicocokkan dengan mutasi bank di Rekonsiliasi Bank.' : undefined}
                    >
                      {statusLabel[r.status] || r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t-2 dark:bg-gray-900">
              <tr>
                <td className="px-4 py-2" colSpan={5}>TOTAL ({isReceipt ? 'tidak termasuk yang dibatalkan' : 'tidak termasuk yang dibatalkan'})</td>
                <td></td>
                <td className="px-4 py-2 text-right">{formatRupiah(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

    </div>
  );
};

export default PaymentList;
