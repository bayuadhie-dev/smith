import React, { useState, useEffect, useCallback, Fragment } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { ClockIcon } from '@heroicons/react/24/outline';

interface AgingInvoice {
  invoice_id: number;
  invoice_number: string;
  due_date: string;
  days_overdue: number;
  currency: string;
  balance: number;
  balance_idr: number;
}

interface AgingParty {
  party_id: number | null;
  party_name: string;
  total: number;
  buckets: Record<string, number>;
  invoices: AgingInvoice[];
}

interface AgingData {
  type: 'receivable' | 'payable';
  as_of: string;
  buckets: { key: string; label: string }[];
  parties: AgingParty[];
  totals: Record<string, number>;
  gl_control_balance: number;
  difference: number;
  unexplained_difference?: number;
  credit_memo_balance?: number;
}

const AgingReport: React.FC = () => {
  const [kind, setKind] = useState<'receivable' | 'payable'>('receivable');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null | undefined>(undefined);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`/api/finance/reports/aging?type=${kind}&as_of=${asOf}`);
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memuat laporan umur');
    } finally {
      setLoading(false);
    }
  }, [kind, asOf]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const label = kind === 'receivable' ? 'Piutang' : 'Hutang';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ClockIcon className="w-6 h-6 text-green-700" />
        <h1 className="text-2xl font-bold">Umur Piutang &amp; Hutang</h1>
      </div>
      <p className="text-gray-500 text-sm">
        Sisa tagihan yang belum lunas dikelompokkan menurut keterlambatan dari jatuh tempo, dalam Rupiah (faktur valas
        dikonversi dengan kurs faktur). Total dicocokkan dengan saldo akun {label.toLowerCase()} di buku besar.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded p-1">
          {(['receivable', 'payable'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded text-sm ${kind === k ? 'bg-white dark:bg-gray-900 shadow font-medium' : 'text-gray-500'}`}
            >
              {k === 'receivable' ? 'Umur Piutang' : 'Umur Hutang'}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Per Tanggal</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="border rounded px-3 py-2" />
        </div>
        <button onClick={fetchReport} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          Tampilkan
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="bg-red-50 text-red-700 rounded p-3">{error}</div>}

      {data && !loading && (
        <>
          {!!data.credit_memo_balance && (
            <div className="bg-blue-50 text-blue-800 rounded p-3 text-sm">
              Ada Nota Kredit customer yang belum dipakai sebesar {formatRupiah(data.credit_memo_balance)}; ini mengurangi saldo piutang di buku besar
              tetapi tidak muncul di daftar faktur di bawah. Pakai ke faktur atau kembalikan lewat menu Nota Kredit Customer.
            </div>
          )}
          {Math.abs(data.unexplained_difference ?? data.difference) > 1 && (
            <div className="bg-yellow-50 text-yellow-800 rounded p-3 text-sm">
              Total daftar {label.toLowerCase()} ({formatRupiah(data.totals.total)}) berbeda {formatRupiah(data.unexplained_difference ?? data.difference)} dari saldo
              buku besar ({formatRupiah(data.gl_control_balance)}) di luar nota kredit. Biasanya karena jurnal manual ke akun kontrol atau data lama.
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-2">{kind === 'receivable' ? 'Customer' : 'Supplier'}</th>
                  {data.buckets.map((b) => (
                    <th key={b.key} className="text-right px-4 py-2">{b.label}</th>
                  ))}
                  <th className="text-right px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.parties.length === 0 && (
                  <tr><td colSpan={data.buckets.length + 2} className="text-center text-gray-500 py-6">Tidak ada {label.toLowerCase()} terbuka</td></tr>
                )}
                {data.parties.map((p) => (
                  <Fragment key={String(p.party_id)}>
                    <tr className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setOpen(open === p.party_id ? undefined : p.party_id)}>
                      <td className="px-4 py-2 font-medium">{p.party_name}</td>
                      {data.buckets.map((b) => (
                        <td key={b.key} className="text-right px-4 py-2">{p.buckets[b.key] ? formatRupiah(p.buckets[b.key]) : '-'}</td>
                      ))}
                      <td className="text-right px-4 py-2 font-semibold">{formatRupiah(p.total)}</td>
                    </tr>
                    {open === p.party_id && p.invoices.map((i) => (
                      <tr key={i.invoice_id} className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                        <td className="px-8 py-1" colSpan={data.buckets.length}>
                          {i.invoice_number} · jatuh tempo {i.due_date}
                          {i.days_overdue > 0 ? ` · terlambat ${i.days_overdue} hari` : ''}
                          {i.currency !== 'IDR' ? ` · ${i.currency} ${i.balance.toLocaleString('id-ID')}` : ''}
                        </td>
                        <td className="text-right px-4 py-1" colSpan={2}>{formatRupiah(i.balance_idr)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                <tr>
                  <td className="px-4 py-2">Total</td>
                  {data.buckets.map((b) => (
                    <td key={b.key} className="text-right px-4 py-2">{formatRupiah(data.totals[b.key] || 0)}</td>
                  ))}
                  <td className="text-right px-4 py-2">{formatRupiah(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AgingReport;
