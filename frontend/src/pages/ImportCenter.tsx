import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../utils/axiosConfig';
import { formatRupiah } from '../utils/currencyUtils';
import { showError, showSuccess } from '../components/ui/Toast';

interface Kind {
  key: string;
  label: string;
  group: string;
  description: string;
  can_import: boolean;
  columns: { field: string; label: string; required: boolean }[];
  summary_columns: { key: string; label: string; type: string }[];
}
interface Tx {
  key: string;
  number: string | null;
  rows: number[];
  errors: string[];
  created: string | null;
  summary: Record<string, any> | null;
}
interface Result {
  committed: boolean;
  transactions: Tx[];
  summary: { total: number; ok: number; error: number; amount: number };
}

const ImportCenter: React.FC = () => {
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();

  useEffect(() => {
    axiosInstance.get('/api/imports/kinds')
      .then((r) => {
        setKinds(r.data.kinds || []);
        const wanted = (r.data.kinds || []).find((k: Kind) => k.key === params.get('kind') && k.can_import);
        const first = wanted || (r.data.kinds || []).find((k: Kind) => k.can_import);
        if (first) setSelected(first.key);
      })
      .catch(() => showError('Gagal memuat daftar impor'))
      .finally(() => setLoading(false));
  }, []);

  const kind = useMemo(() => kinds.find((k) => k.key === selected) || null, [kinds, selected]);
  const groups = useMemo(() => {
    const g: Record<string, Kind[]> = {};
    kinds.forEach((k) => { (g[k.group] = g[k.group] || []).push(k); });
    const order = ['Kas & Bank', 'Transaksi', 'Master'];
    return Object.fromEntries(Object.entries(g).sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)));
  }, [kinds]);

  const pick = (key: string) => { setSelected(key); setFile(null); setResult(null); };

  const downloadTemplate = async () => {
    if (!kind) return;
    try {
      const res = await axiosInstance.get(`/api/imports/${kind.key}/template`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_import_${kind.key}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showError('Gagal mengunduh template');
    }
  };

  const send = async (commit: boolean) => {
    if (!file || !kind) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('commit', commit ? '1' : '0');
      const res = await axiosInstance.post(`/api/imports/${kind.key}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      if (commit) showSuccess(`${res.data.summary.ok} dokumen berhasil diimpor${res.data.summary.error ? `, ${res.data.summary.error} gagal` : ''}`);
    } catch (e: any) {
      setResult(null);
      showError(e?.response?.data?.error || 'Impor gagal');
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = () => {
    if (!result) return;
    const lines = ['Baris,Dokumen,Masalah'];
    result.transactions.filter((t) => t.errors.length).forEach((t) => {
      lines.push([t.rows.join(' '), t.number || 'otomatis', t.errors.join('; ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masalah_import_${kind?.key || ''}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const cell = (t: Tx, col: { key: string; type: string }) => {
    const v = t.summary?.[col.key];
    if (v === undefined || v === null || v === '') return '-';
    return col.type === 'money' ? formatRupiah(Number(v)) : String(v);
  };

  const okCount = result?.summary.ok ?? 0;

  if (loading) return <div className="p-8 text-gray-500">Memuat...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pusat Impor</h1>
        <p className="text-sm text-gray-500">Masukkan banyak transaksi atau data master sekaligus dari Excel (.xlsx) atau CSV. Selalu diperiksa dulu, baru disimpan.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4 rounded-xl border bg-white p-3 dark:bg-gray-800">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <p className="mb-1 px-2 text-xs font-semibold uppercase text-gray-400">{g}</p>
              {list.map((k) => (
                <button key={k.key} type="button" onClick={() => pick(k.key)} disabled={!k.can_import}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40 ${selected === k.key ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50 dark:text-gray-200'}`}>
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section className="space-y-4 rounded-xl border bg-white p-5 dark:bg-gray-800">
          {!kind ? (
            <p className="text-gray-500">Pilih jenis impor di sebelah kiri.</p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{kind.label}</h2>
                {kind.description && <p className="text-sm text-gray-500">{kind.description}</p>}
                <p className="mt-2 text-xs text-gray-500">
                  Kolom: {kind.columns.map((c) => (c.required ? `${c.label}*` : c.label)).join(', ')} (* wajib)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded border border-emerald-600 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                  <ArrowDownTrayIcon className="h-4 w-4" /> Unduh Template
                </button>
                <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} />
                <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                  <ArrowUpTrayIcon className="h-4 w-4" /> {file ? 'Ganti file' : 'Pilih file'}
                </button>
                {file && <span className="text-sm text-gray-700">{file.name}</span>}
                <div className="ml-auto flex gap-2">
                  <button type="button" disabled={!file || busy} onClick={() => send(false)} className="rounded border border-gray-400 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
                    {busy && !result ? 'Memeriksa...' : 'Periksa'}
                  </button>
                  <button type="button" disabled={!file || busy || !result || result.committed || okCount === 0} onClick={() => send(true)} className="rounded bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800 disabled:opacity-50">
                    {busy && result ? 'Menyimpan...' : `Simpan${result && !result.committed && okCount ? ` ${okCount} dokumen` : ''}`}
                  </button>
                </div>
              </div>

              {result && (
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 rounded p-3 text-sm ${result.summary.error ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
                    {result.summary.error ? <ExclamationTriangleIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5" />}
                    <span>
                      {result.committed ? 'Hasil impor' : 'Hasil pemeriksaan (belum disimpan)'}: {result.summary.total} dokumen, {result.summary.ok} {result.committed ? 'tersimpan' : 'valid'}
                      {result.summary.amount ? ` (total ${formatRupiah(result.summary.amount)})` : ''}, {result.summary.error} bermasalah.
                    </span>
                    {result.summary.error > 0 && (
                      <button type="button" onClick={downloadErrors} className="ml-auto rounded border border-amber-600 px-2 py-1 text-xs hover:bg-amber-100">Unduh masalah (.csv)</button>
                    )}
                  </div>
                  <div className="max-h-[28rem] overflow-auto rounded border">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Baris</th>
                          <th className="px-3 py-2 text-left">Dokumen</th>
                          {kind.summary_columns.map((c) => <th key={c.key} className={`px-3 py-2 ${c.type === 'money' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
                          <th className="px-3 py-2 text-left">Hasil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.transactions.map((t, i) => (
                          <tr key={i} className="border-t align-top">
                            <td className="px-3 py-1.5">{t.rows.length > 4 ? `${t.rows[0]}-${t.rows[t.rows.length - 1]}` : t.rows.join(', ')}</td>
                            <td className="px-3 py-1.5">{t.created || t.number || 'otomatis'}</td>
                            {kind.summary_columns.map((c) => <td key={c.key} className={`px-3 py-1.5 ${c.type === 'money' ? 'text-right' : ''}`}>{cell(t, c)}</td>)}
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
            </>
          )}
        </section>
      </div>

    </div>
  );
};

export default ImportCenter;
