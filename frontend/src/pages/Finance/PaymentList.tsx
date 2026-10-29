import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { BanknotesIcon, PlusIcon, ArrowUpTrayIcon, ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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

type SortKey = 'payment_number' | 'payment_date' | 'bank' | 'party_name' | 'description' | 'amount' | 'status';
const SORT_TEXT = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

const sortValue = (r: PaymentRow, key: SortKey): string | number => {
  switch (key) {
    case 'bank': return r.bank_account ? `${r.bank_account.code} ${r.bank_account.name}` : '';
    case 'description': return [r.invoice_numbers?.join(', '), r.notes || r.reference_number].filter(Boolean).join(' ');
    case 'amount': return r.amount;
    case 'party_name': return r.party_name || '';
    default: return String(r[key] ?? '');
  }
};

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
  const [search, setSearch] = useState('');
  const [banks, setBanks] = useState<{ id: number; code: string; name: string }[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    axiosInstance.get('/api/finance/reports/cash-accounts').then((r) => setBanks(r.data.accounts || [])).catch(() => setBanks([]));
  }, []);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

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

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    const digits = q.replace(/[.\s]/g, '').replace(',', '.');
    return rows.filter((r) => {
      const hay = [r.payment_number, r.payment_date, r.party_name, r.notes, r.reference_number, (r as any).paid_to,
        r.invoice_numbers?.join(' '), r.bank_account ? `${r.bank_account.code} ${r.bank_account.name}` : '',
        statusLabel[r.status] || r.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q) || (digits !== '' && /^[0-9.]+$/.test(digits) && String(Math.abs(r.amount)).includes(digits));
    });
  }, [rows, search]);

  const sortedRows = React.useMemo(() => {
    if (!sort) return filteredRows;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : SORT_TEXT.compare(String(x), String(y))) * sign;
    });
  }, [filteredRows, sort]);

  const total = filteredRows
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-green-700" />
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
        <Link
          to={`/app/imports?kind=${type}_${source}`}
          className="flex items-center gap-1 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
          title="Buka Pusat Impor & Ekspor Data"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          Import
        </Link>
        <Link
          to={`/app/imports?kind=${type}_${source}&mode=export`}
          className="flex items-center gap-1 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
          title="Ekspor ke Excel (pilih rentang tanggal)"
        >
          Ekspor
        </Link>
        <Link
          to={newHref}
          className="flex items-center gap-1 bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
        >
          <PlusIcon className="w-4 h-4" />
          Catat {isReceipt ? 'Penerimaan' : 'Pembayaran'}
        </Link>
        </div>
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
        <div>
          <label className="block text-sm text-gray-600 mb-1">Kas/Bank</label>
          <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="border rounded px-3 py-2 min-w-[14rem]">
            <option value="">Semua Kas/Bank</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[16rem]">
          <label className="block text-sm text-gray-600 mb-1">Cari</label>
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="No. bukti, pihak, kas/bank, faktur, keterangan, nominal..."
              className="border rounded pl-9 pr-3 py-2 w-full"
            />
          </div>
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
                <th className="px-4 py-2 text-left" aria-sort={sort?.key === 'payment_number' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('payment_number')} className="inline-flex w-full items-center gap-1 justify-start font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    No. Transaksi
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'payment_number' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'payment_number' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-left" aria-sort={sort?.key === 'payment_date' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('payment_date')} className="inline-flex w-full items-center gap-1 justify-start font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    Tanggal
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'payment_date' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'payment_date' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-left" aria-sort={sort?.key === 'bank' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('bank')} className="inline-flex w-full items-center gap-1 justify-start font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    Kas/Bank
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'bank' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'bank' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-left" aria-sort={sort?.key === 'party_name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('party_name')} className="inline-flex w-full items-center gap-1 justify-start font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    {partyLabel}
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'party_name' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'party_name' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-left" aria-sort={sort?.key === 'description' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('description')} className="inline-flex w-full items-center gap-1 justify-start font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    Keterangan
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'description' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'description' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-right" aria-sort={sort?.key === 'amount' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('amount')} className="inline-flex w-full items-center gap-1 justify-end font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    Nilai
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'amount' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'amount' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-center" aria-sort={sort?.key === 'status' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort('status')} className="inline-flex w-full items-center gap-1 justify-center font-semibold hover:text-green-700" title="Klik untuk urutkan A-Z / Z-A">
                    Status
                    <span className="flex flex-col leading-none">
                      <ChevronUpIcon className={`h-3 w-3 ${sort?.key === 'status' && sort.dir === 'asc' ? 'text-green-700' : 'text-gray-300'}`} />
                      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sort?.key === 'status' && sort.dir === 'desc' ? 'text-green-700' : 'text-gray-300'}`} />
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Tidak ada {isReceipt ? 'penerimaan' : 'pembayaran'} {search.trim() ? 'yang cocok dengan pencarian' : 'pada periode ini'}.
                  </td>
                </tr>
              )}
              {sortedRows.map((r) => (
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
                      title={r.status === 'pending' ? 'Transaksi sudah dijurnal (tidak perlu approval). Status berubah otomatis setelah dicocokkan dengan mutasi bank di Rekonsiliasi Bank.' : undefined}
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
