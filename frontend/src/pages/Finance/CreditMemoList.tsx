import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { showSuccess, showError } from '../../components/ui';
import { ReceiptRefundIcon } from '@heroicons/react/24/outline';

interface Memo {
  id: number;
  memo_number: string;
  customer_name: string | null;
  memo_date: string;
  amount: number;
  amount_applied: number;
  amount_refunded: number;
  balance: number;
  status: 'open' | 'closed';
  notes: string | null;
  applications?: { id: number; kind: string; amount: number; applied_date: string; invoice_number: string | null }[];
  open_invoices?: { id: number; invoice_number: string; balance_due: number }[];
}

const CreditMemoList: React.FC = () => {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [openBalance, setOpenBalance] = useState(0);
  const [status, setStatus] = useState<'open' | 'closed' | ''>('open');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<Memo | null>(null);
  const [mode, setMode] = useState<'apply' | 'refund'>('apply');
  const [invoiceId, setInvoiceId] = useState('');
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [banks, setBanks] = useState<{ id: number; account_code: string; account_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/finance/credit-memos', { params: status ? { status } : {} });
      setMemos(res.data.credit_memos);
      setOpenBalance(res.data.open_balance);
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal memuat nota kredit');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    axiosInstance.get('/api/finance/chart-of-accounts').then((res) => {
      setBanks((res.data.accounts || []).filter((a: any) => a.is_cash_bank));
    }).catch(() => setBanks([]));
  }, []);

  const openDialog = async (memo: Memo, m: 'apply' | 'refund') => {
    try {
      const res = await axiosInstance.get(`/api/finance/credit-memos/${memo.id}`);
      setActive(res.data);
      setMode(m);
      setAmount(String(res.data.balance));
      setInvoiceId('');
      setBankId('');
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal memuat nota kredit');
    }
  };

  const submit = async () => {
    if (!active) return;
    setSaving(true);
    try {
      if (mode === 'apply') {
        await axiosInstance.post(`/api/finance/credit-memos/${active.id}/apply`, { invoice_id: Number(invoiceId), amount: Number(amount) });
        showSuccess('Nota kredit diterapkan ke faktur');
      } else {
        await axiosInstance.post(`/api/finance/credit-memos/${active.id}/refund`, { bank_account_id: Number(bankId), amount: Number(amount) });
        showSuccess('Pengembalian dana dicatat');
      }
      setActive(null);
      load();
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Number(amount) > 0 && (mode === 'apply' ? !!invoiceId : !!bankId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ReceiptRefundIcon className="w-6 h-6 text-green-700" />
        <h1 className="text-2xl font-bold">Nota Kredit Customer</h1>
      </div>
      <p className="text-gray-500 text-sm">
        Kredit dari retur penjualan yang belum terpakai (melebihi sisa faktur atau tidak terhubung ke faktur). Pakai untuk mengurangi
        faktur customer yang sama, atau kembalikan dananya lewat kas/bank.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="border rounded px-3 py-2">
          <option value="open">Masih ada sisa</option>
          <option value="closed">Sudah habis dipakai</option>
          <option value="">Semua</option>
        </select>
        <div className="ml-auto text-sm">Total sisa kredit: <span className="font-bold">{formatRupiah(openBalance)}</span></div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-2">No. Nota Kredit</th>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2">Tanggal</th>
                <th className="text-right px-4 py-2">Nilai</th>
                <th className="text-right px-4 py-2">Dipakai</th>
                <th className="text-right px-4 py-2">Dikembalikan</th>
                <th className="text-right px-4 py-2">Sisa</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-500 py-6">Tidak ada nota kredit</td></tr>
              )}
              {memos.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{m.memo_number}</td>
                  <td className="px-4 py-2">{m.customer_name}</td>
                  <td className="px-4 py-2">{m.memo_date}</td>
                  <td className="text-right px-4 py-2">{formatRupiah(m.amount)}</td>
                  <td className="text-right px-4 py-2">{formatRupiah(m.amount_applied)}</td>
                  <td className="text-right px-4 py-2">{formatRupiah(m.amount_refunded)}</td>
                  <td className="text-right px-4 py-2 font-semibold">{formatRupiah(m.balance)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {m.status === 'open' && (
                      <>
                        <button onClick={() => openDialog(m, 'apply')} className="text-green-700 hover:underline mr-3">Pakai ke faktur</button>
                        <button onClick={() => openDialog(m, 'refund')} className="text-blue-700 hover:underline">Kembalikan dana</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              {mode === 'apply' ? 'Pakai ke faktur' : 'Kembalikan dana'} — {active.memo_number}
            </h2>
            <p className="text-sm text-gray-500">{active.customer_name} · sisa {formatRupiah(active.balance)}</p>
            {mode === 'apply' ? (
              <div>
                <label className="block text-sm mb-1">Faktur</label>
                <select value={invoiceId} onChange={(e) => {
                  setInvoiceId(e.target.value);
                  const inv = active.open_invoices?.find((i) => String(i.id) === e.target.value);
                  if (inv) setAmount(String(Math.min(active.balance, inv.balance_due)));
                }} className="border rounded px-3 py-2 w-full">
                  <option value="">Pilih faktur…</option>
                  {(active.open_invoices || []).map((i) => (
                    <option key={i.id} value={i.id}>{i.invoice_number} — sisa {formatRupiah(i.balance_due)}</option>
                  ))}
                </select>
                {(active.open_invoices || []).length === 0 && <p className="text-xs text-gray-500 mt-1">Customer ini tidak punya faktur terbuka.</p>}
              </div>
            ) : (
              <div>
                <label className="block text-sm mb-1">Dibayar dari akun</label>
                <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="border rounded px-3 py-2 w-full">
                  <option value="">Pilih kas/bank…</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.account_code} — {b.account_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm mb-1">Jumlah (Rp)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
            {(active.applications || []).length > 0 && (
              <div className="text-xs text-gray-500">
                Riwayat: {active.applications!.map((a) => `${a.kind === 'refund' ? 'dikembalikan' : `dipakai ${a.invoice_number}`} ${formatRupiah(a.amount)}`).join(' · ')}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setActive(null)} className="px-4 py-2 rounded border">Batal</button>
              <button onClick={submit} disabled={!canSubmit || saving} className="px-4 py-2 rounded bg-green-700 text-white disabled:opacity-50">
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditMemoList;
