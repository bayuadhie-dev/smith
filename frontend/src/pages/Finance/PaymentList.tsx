import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { BanknotesIcon, PlusIcon } from '@heroicons/react/24/outline';

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
  pending: 'Pending',
  cleared: 'Cleared',
  bounced: 'Bounced',
  cancelled: 'Dibatalkan',
};

const PaymentList: React.FC<PaymentListProps> = ({ type, source }) => {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        `/api/finance/payments?type=${type}&source=${source}&date_from=${dateFrom}&date_to=${dateTo}`
      );
      setRows(res.data.payments || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [type, source, dateFrom, dateTo]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const total = rows
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-green-700" />
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <Link
          to={newHref}
          className="flex items-center gap-1 bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
        >
          <PlusIcon className="w-4 h-4" />
          Catat {isReceipt ? 'Penerimaan' : 'Pembayaran'}
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <button onClick={fetchRows} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800">
          Tampilkan
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">No. Transaksi</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
                <th className="px-4 py-2 text-left">Kas/Bank</th>
                <th className="px-4 py-2 text-left">{partyLabel}</th>
                <th className="px-4 py-2 text-left">Keterangan</th>
                <th className="px-4 py-2 text-right">Nilai</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Tidak ada {isReceipt ? 'penerimaan' : 'pembayaran'} pada periode ini.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={`border-t ${r.status === 'cancelled' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2">
                    <Link to={`/app/finance/payments/${r.id}`} className="text-blue-600 hover:underline">
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
                      <div className="text-xs text-blue-700">Pelunasan: {r.invoice_numbers.join(', ')}</div>
                    )}
                    {(r.account_lines ?? 0) > 1 && (
                      <div className="text-xs text-gray-500">{r.account_lines} akun</div>
                    )}
                    {r.notes || r.reference_number || (r.invoice_numbers?.length ? '' : '-')}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupiah(r.amount)}</td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        r.status === 'cancelled'
                          ? 'bg-red-50 text-red-600'
                          : r.status === 'cleared'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {statusLabel[r.status] || r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t-2">
              <tr>
                <td className="px-4 py-2" colSpan={5}>TOTAL ({isReceipt ? 'tidak termasuk yang dibatalkan' : 'tidak termasuk yang dibatalkan'})</td>
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
