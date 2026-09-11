import React, { useEffect, useState } from 'react';
import axios from '../../lib/axios';

interface PeriodCloseRecord {
  id: number;
  period_year: number;
  period_month: number;
  closed_at: string | null;
  depreciation_summary: { assets_processed: number; total_depreciation: number; skipped: number } | null;
  notes: string | null;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * "Proses Akhir Bulan" UI - mirrors Accurate's Period End feature. Lets an
 * admin close a month (computing + posting depreciation, then locking the
 * period against new/edited transactions dated within it) and reopen a
 * closed period if a correction is needed (hard lock, no automatic grace
 * period, per the 2026-08-16 decision).
 */
const PeriodClose: React.FC = () => {
  const now = new Date();
  const [records, setRecords] = useState<PeriodCloseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [reopeningId, setReopeningId] = useState<number | null>(null);

  const loadRecords = () => {
    axios
      .get('/finance/period-close')
      .then((res) => {
        setRecords(res.data?.period_closes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleClose = async () => {
    setClosing(true);
    setMessage(null);
    try {
      const res = await axios.post('/finance/period-close', {
        period_year: selectedYear,
        period_month: selectedMonth,
        notes: notes || undefined,
      });
      setMessage({ type: 'success', text: res.data?.message || 'Periode berhasil ditutup.' });
      setNotes('');
      setConfirmingClose(false);
      loadRecords();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal menutup periode.' });
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async (id: number) => {
    setMessage(null);
    try {
      const res = await axios.delete(`/finance/period-close/${id}`);
      setMessage({ type: 'success', text: res.data?.message || 'Periode berhasil dibuka kembali.' });
      setReopeningId(null);
      loadRecords();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal membuka periode.' });
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Proses Akhir Bulan</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Menutup periode akuntansi: menghitung dan mencatat penyusutan aset tetap bulan berjalan, lalu
        mengunci periode tersebut agar transaksi baru tidak bisa dibuat dengan tanggal di dalamnya.
        Tidak ada tenggang waktu otomatis - jika perlu koreksi setelah ditutup, gunakan tombol
        "Buka Kembali" di riwayat di bawah.
      </p>

      {message && (
        <div
          className={`p-3 rounded-md text-sm mb-6 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tutup Periode Baru</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tahun</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Catatan (opsional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
          />
        </div>

        {!confirmingClose ? (
          <button
            onClick={() => setConfirmingClose(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Tutup {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </button>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800 mb-3">
              Yakin ingin menutup periode {MONTH_NAMES[selectedMonth - 1]} {selectedYear}? Setelah ditutup,
              transaksi baru dengan tanggal di bulan ini tidak bisa dibuat sampai periode dibuka kembali
              secara manual.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                disabled={closing}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {closing ? 'Memproses...' : 'Ya, Tutup Periode'}
              </button>
              <button
                onClick={() => setConfirmingClose(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Riwayat Penutupan</h2>
        {records.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada periode yang ditutup.</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {MONTH_NAMES[r.period_month - 1]} {r.period_year}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ditutup: {r.closed_at ? new Date(r.closed_at).toLocaleString('id-ID') : '-'}
                  </div>
                  {r.depreciation_summary && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {r.depreciation_summary.assets_processed} aset diproses,{' '}
                      {r.depreciation_summary.skipped} dilewati, total penyusutan Rp
                      {r.depreciation_summary.total_depreciation.toLocaleString('id-ID')}
                    </div>
                  )}
                  {r.notes && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{r.notes}</div>}
                </div>
                {reopeningId === r.id ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleReopen(r.id)}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                    >
                      Ya, Buka Kembali
                    </button>
                    <button
                      onClick={() => setReopeningId(null)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setReopeningId(r.id)}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:underline"
                  >
                    Buka Kembali
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeriodClose;
