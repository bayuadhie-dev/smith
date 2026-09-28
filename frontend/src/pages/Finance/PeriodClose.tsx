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

interface ChecklistItem {
  code: string;
  label: string;
  description: string | null;
  is_required: boolean;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
}

interface TransactionLock {
  id: number;
  period_year: number;
  period_month: number;
  transaction_type: string;
  locked_at: string | null;
  notes: string | null;
}

interface NegativeStockItem {
  inventory_id: number;
  item_name: string;
  quantity_on_hand: number;
  batch_number: string | null;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  purchase_invoice: 'Faktur Pembelian', sales_invoice: 'Faktur Penjualan',
  payment: 'Pembayaran', expense: 'Pengeluaran', reimbursement: 'Reimbursement',
  asset: 'Aset Tetap', asset_disposal: 'Pelepasan Aset', payroll: 'Payroll',
  journal_entry: 'Jurnal Manual', stock_opname: 'Stock Opname',
  goods_receipt: 'Penerimaan Barang (GRN)', purchase_return: 'Retur Pembelian',
  sales_delivery: 'Pengiriman (COGS)', work_order: 'Work Order',
  recurring_payment: 'Pembayaran Rutin',
};

/**
 * "Proses Akhir Bulan" UI - mirrors Accurate's Period End feature, extended
 * 2026-09-28 into a lightweight "Closing Cockpit" (SAP's term): a checklist
 * that must be completed (or explicitly force-overridden) before closing,
 * plus partial per-transaction-type locks as an alternative to a full close.
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

  // Checklist (2026-09-28)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [missingRequired, setMissingRequired] = useState<{ code: string; label: string }[] | null>(null);
  const [negativeStockWarning, setNegativeStockWarning] = useState<NegativeStockItem[] | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ code: '', label: '', description: '', is_required: true });

  // Partial lock (2026-09-28)
  const [locks, setLocks] = useState<TransactionLock[]>([]);
  const [locksLoading, setLocksLoading] = useState(true);
  const [newLockType, setNewLockType] = useState('');
  const [newLockNotes, setNewLockNotes] = useState('');

  const loadRecords = () => {
    axios.get('/finance/period-close').then((res) => {
      setRecords(res.data?.period_closes || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const loadChecklist = () => {
    setChecklistLoading(true);
    axios.get('/finance/closing-tasks/status', { params: { period_year: selectedYear, period_month: selectedMonth } })
      .then((res) => setChecklist(res.data?.checklist || []))
      .catch(() => setChecklist([]))
      .finally(() => setChecklistLoading(false));
  };

  const loadLocks = () => {
    setLocksLoading(true);
    axios.get('/finance/period-transaction-locks', { params: { period_year: selectedYear, period_month: selectedMonth } })
      .then((res) => setLocks(res.data?.locks || []))
      .catch(() => setLocks([]))
      .finally(() => setLocksLoading(false));
  };

  useEffect(() => { loadRecords(); }, []);
  useEffect(() => {
    loadChecklist();
    loadLocks();
    setMissingRequired(null);
    setNegativeStockWarning(null);
  }, [selectedYear, selectedMonth]);

  const toggleTask = async (code: string, isCompleted: boolean) => {
    try {
      await axios.post('/finance/closing-tasks/status', {
        period_year: selectedYear, period_month: selectedMonth, task_code: code, is_completed: isCompleted,
      });
      loadChecklist();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal update checklist.' });
    }
  };

  const handleAddTask = async () => {
    if (!newTask.code.trim() || !newTask.label.trim()) return;
    try {
      await axios.post('/finance/closing-tasks', newTask);
      setNewTask({ code: '', label: '', description: '', is_required: true });
      setShowAddTask(false);
      loadChecklist();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal menambah task.' });
    }
  };

  const handleDeactivateTask = async (code: string) => {
    if (!confirm(`Nonaktifkan checklist item "${code}"?`)) return;
    try {
      await axios.delete(`/finance/closing-tasks/${code}`);
      loadChecklist();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal menonaktifkan task.' });
    }
  };

  const handleAddLock = async () => {
    if (!newLockType) return;
    try {
      await axios.post('/finance/period-transaction-locks', {
        period_year: selectedYear, period_month: selectedMonth,
        transaction_type: newLockType, notes: newLockNotes || undefined,
      });
      setNewLockType(''); setNewLockNotes('');
      loadLocks();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal mengunci jenis transaksi.' });
    }
  };

  const handleRemoveLock = async (id: number) => {
    try {
      await axios.delete(`/finance/period-transaction-locks/${id}`);
      loadLocks();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal membuka kunci.' });
    }
  };

  const handleClose = async (force = false) => {
    setClosing(true);
    setMessage(null);
    setMissingRequired(null);
    try {
      const res = await axios.post('/finance/period-close', {
        period_year: selectedYear,
        period_month: selectedMonth,
        notes: notes || undefined,
        force,
      });
      setMessage({ type: 'success', text: res.data?.message || 'Periode berhasil ditutup.' });
      setNegativeStockWarning(res.data?.negative_stock_warning?.length ? res.data.negative_stock_warning : null);
      setNotes('');
      setConfirmingClose(false);
      loadRecords();
    } catch (e: any) {
      if (e?.response?.data?.missing_tasks) {
        setMissingRequired(e.response.data.missing_tasks);
        setMessage({ type: 'error', text: e.response.data.error });
      } else {
        setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal menutup periode.' });
      }
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

  const availableLockTypes = Object.keys(TRANSACTION_TYPE_LABELS).filter(
    (t) => !locks.some((l) => l.transaction_type === t)
  );

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
        "Buka Kembali" di riwayat di bawah (hanya bisa kalau periode setelahnya belum ditutup).
      </p>

      {message && (
        <div className={`p-3 rounded-md text-sm mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {negativeStockWarning && (
        <div className="p-4 rounded-md text-sm mb-6 bg-amber-50 border border-amber-200 text-amber-800">
          <p className="font-medium mb-2">⚠️ Peringatan: {negativeStockWarning.length} item stok bernilai negatif (advisory, periode tetap berhasil ditutup)</p>
          <ul className="list-disc list-inside space-y-0.5">
            {negativeStockWarning.slice(0, 10).map((item) => (
              <li key={item.inventory_id}>{item.item_name}{item.batch_number ? ` (batch ${item.batch_number})` : ''}: {item.quantity_on_hand}</li>
            ))}
          </ul>
          {negativeStockWarning.length > 10 && <p className="mt-1 italic">...dan {negativeStockWarning.length - 10} lainnya.</p>}
        </div>
      )}

      {/* Period selector - dipakai bersama oleh checklist, partial lock, dan form tutup periode */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
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
      </div>

      {/* Checklist Closing */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Checklist Closing - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </h2>
          <button onClick={() => setShowAddTask((v) => !v)} className="text-sm text-primary-600 hover:underline">
            {showAddTask ? 'Batal' : '+ Tambah Item'}
          </button>
        </div>

        {showAddTask && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="code (mis. tax_review)" value={newTask.code}
                onChange={(e) => setNewTask({ ...newTask, code: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm" />
              <input placeholder="Label" value={newTask.label}
                onChange={(e) => setNewTask({ ...newTask, label: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm" />
            </div>
            <input placeholder="Deskripsi (opsional)" value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm" />
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={newTask.is_required}
                onChange={(e) => setNewTask({ ...newTask, is_required: e.target.checked })} />
              Wajib (blokir closing kalau belum selesai)
            </label>
            <button onClick={handleAddTask} className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700">
              Simpan Item
            </button>
          </div>
        )}

        {checklistLoading ? (
          <p className="text-sm text-gray-500">Memuat checklist...</p>
        ) : checklist.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada item checklist. Tambahkan lewat "+ Tambah Item" di atas.</p>
        ) : (
          <div className="space-y-2">
            {checklist.map((item) => {
              const isMissing = missingRequired?.some((m) => m.code === item.code);
              return (
                <div key={item.code} className={`flex items-start justify-between p-2 rounded-md ${isMissing ? 'bg-red-50 border border-red-200' : ''}`}>
                  <label className="flex items-start gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={(e) => toggleTask(item.code, e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {item.label} {item.is_required && <span className="text-xs text-red-500">*wajib</span>}
                      </div>
                      {item.description && <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>}
                    </div>
                  </label>
                  <button onClick={() => handleDeactivateTask(item.code)} className="text-xs text-gray-400 hover:text-red-600 ml-2">
                    hapus
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Kunci Parsial per Jenis Transaksi */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Kunci Parsial - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Kunci jenis transaksi tertentu tanpa menutup periode secara penuh (mis. kunci Faktur Pembelian, tapi
          Jurnal Manual masih boleh untuk penyesuaian).
        </p>

        {locksLoading ? (
          <p className="text-sm text-gray-500">Memuat...</p>
        ) : (
          <>
            {locks.length > 0 && (
              <div className="space-y-2 mb-4">
                {locks.map((lock) => (
                  <div key={lock.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <div>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {TRANSACTION_TYPE_LABELS[lock.transaction_type] || lock.transaction_type}
                      </span>
                      {lock.notes && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 italic">({lock.notes})</span>}
                    </div>
                    <button onClick={() => handleRemoveLock(lock.id)} className="text-xs text-gray-400 hover:text-red-600">
                      buka kunci
                    </button>
                  </div>
                ))}
              </div>
            )}
            {availableLockTypes.length > 0 && (
              <div className="flex gap-2">
                <select value={newLockType} onChange={(e) => setNewLockType(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm flex-1">
                  <option value="">Pilih jenis transaksi...</option>
                  {availableLockTypes.map((t) => (
                    <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input placeholder="Catatan (opsional)" value={newLockNotes}
                  onChange={(e) => setNewLockNotes(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm flex-1" />
                <button onClick={handleAddLock} disabled={!newLockType}
                  className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50">
                  Kunci
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tutup Periode */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tutup Periode Penuh</h2>
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
                onClick={() => handleClose(false)}
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

        {missingRequired && missingRequired.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700 mb-2">Checklist wajib belum selesai (dicentang merah di atas). Bisa lanjut tutup paksa tanpa checklist lengkap:</p>
            <button
              onClick={() => handleClose(true)}
              disabled={closing}
              className="px-3 py-1.5 bg-red-700 text-white text-sm rounded-md hover:bg-red-800 disabled:opacity-50"
            >
              Tutup Paksa (Abaikan Checklist)
            </button>
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
