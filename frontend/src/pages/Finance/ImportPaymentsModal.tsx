import React, { useRef, useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { showError, showSuccess } from '../../components/ui/Toast';

interface Tx {
  number: string | null;
  rows: number[];
  errors: string[];
  created: string | null;
  summary: { date: string; bank: string; total: number; lines: number } | null;
}
interface Result {
  committed: boolean;
  transactions: Tx[];
  summary: { total: number; ok: number; error: number; amount: number };
}

interface Props {
  type: 'receipt' | 'payment';
  source: 'kas' | 'invoice';
  onClose: () => void;
  onImported: () => void;
}

const ImportPaymentsModal: React.FC<Props> = ({ type, source, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const label = type === 'receipt' ? 'Penerimaan' : 'Pembayaran';

  const downloadTemplate = async () => {
    try {
      const res = await axiosInstance.get('/api/finance/payment-import/template', { params: { type, source }, responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_import_${type === 'receipt' ? 'penerimaan' : 'pembayaran'}_${source}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showError('Gagal mengunduh template');
    }
  };

  const send = async (commit: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);
      form.append('source', source);
      form.append('commit', commit ? '1' : '0');
      const res = await axiosInstance.post('/api/finance/payment-import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      if (commit) {
        showSuccess(`${res.data.summary.ok} transaksi berhasil diimpor${res.data.summary.error ? `, ${res.data.summary.error} gagal` : ''}`);
        if (res.data.summary.ok) onImported();
      }
    } catch (e: any) {
      setResult(null);
      showError(e?.response?.data?.error || 'Impor gagal');
    } finally {
      setBusy(false);
    }
  };

  const okCount = result?.summary.ok ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">Import {label} {source === 'kas' ? 'Kas/Bank' : 'Faktur'}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-gray-600">
            <li>Unduh template, isi datanya (nilai boleh negatif, tidak boleh 0). Baris dengan No. Bukti sama digabung jadi satu transaksi.</li>
            <li>Pilih file .xlsx atau .csv, klik <b>Periksa</b> untuk melihat hasil validasi. Belum ada yang tersimpan.</li>
            <li>Kalau sudah benar, klik <b>Simpan</b>. Transaksi yang bermasalah dilewati dan dilaporkan.</li>
          </ol>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded border border-emerald-600 px-3 py-2 text-emerald-700 hover:bg-emerald-50">
              <ArrowDownTrayIcon className="h-4 w-4" /> Unduh Template
            </button>
            <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} />
            <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-2 hover:bg-gray-50">
              <ArrowUpTrayIcon className="h-4 w-4" /> {file ? 'Ganti file' : 'Pilih file'}
            </button>
            {file && <span className="text-gray-700">{file.name}</span>}
          </div>

          {result && (
            <div className="space-y-2">
              <div className={`rounded p-3 ${result.summary.error ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
                {result.committed ? 'Hasil impor' : 'Hasil pemeriksaan'}: {result.summary.total} transaksi, {result.summary.ok} {result.committed ? 'tersimpan' : 'valid'} (total {formatRupiah(result.summary.amount)}), {result.summary.error} bermasalah.
              </div>
              <div className="max-h-72 overflow-auto rounded border">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Baris</th><th className="px-3 py-2 text-left">No. Bukti</th><th className="px-3 py-2 text-left">Kas/Bank</th><th className="px-3 py-2 text-right">Nilai</th><th className="px-3 py-2 text-left">Hasil</th></tr></thead>
                  <tbody>
                    {result.transactions.map((t, i) => (
                      <tr key={i} className="border-t align-top">
                        <td className="px-3 py-1.5">{t.rows.join(', ')}</td>
                        <td className="px-3 py-1.5">{t.created || t.number || 'otomatis'}</td>
                        <td className="px-3 py-1.5">{t.summary?.bank || '-'}</td>
                        <td className="px-3 py-1.5 text-right">{t.summary ? formatRupiah(t.summary.total) : '-'}</td>
                        <td className="px-3 py-1.5">
                          {t.errors.length ? <span className="text-red-600">{t.errors.join('; ')}</span>
                            : <span className="text-green-700">{result.committed ? 'Tersimpan' : 'Valid'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 hover:bg-gray-50">{result?.committed ? 'Selesai' : 'Batal'}</button>
          {!result?.committed && (
            <>
              <button type="button" disabled={!file || busy} onClick={() => send(false)} className="rounded border border-gray-400 px-4 py-2 hover:bg-gray-50 disabled:opacity-50">
                {busy && !result ? 'Memeriksa...' : 'Periksa'}
              </button>
              <button type="button" disabled={!file || busy || !result || okCount === 0} onClick={() => send(true)} className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-50">
                {busy && result ? 'Menyimpan...' : `Simpan${result && okCount ? ` ${okCount} transaksi` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPaymentsModal;
