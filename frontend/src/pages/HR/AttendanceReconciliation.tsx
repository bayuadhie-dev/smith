import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck, CheckCircle, XCircle, Loader2, AlertTriangle, RefreshCw
} from 'lucide-react';
import axiosInstance from '../../utils/axiosConfig';

interface CorrectionRequest {
  id: number;
  employee_name: string;
  correction_date: string;
  reason: string;
  requested_change: {
    clock_in?: { old: string | null; new: string };
    clock_out?: { old: string | null; new: string };
  };
  status: string;
  created_at: string;
}

interface ReconciliationFlag {
  id: number;
  employee_name: string;
  flag_date: string;
  mismatch_type: 'missing_attendance' | 'missing_production_log';
  status: string;
  created_at: string;
}

const MISMATCH_LABEL: Record<string, string> = {
  missing_attendance: 'Ada log produksi, tapi tidak ada absensi (clock-in)',
  missing_production_log: 'Ada absensi (clock-in), tapi tidak ada log produksi',
};

const AttendanceReconciliation: React.FC = () => {
  const [tab, setTab] = useState<'correction' | 'reconciliation'>('correction');

  // Correction requests
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(true);

  const fetchCorrections = async () => {
    setLoadingCorrections(true);
    try {
      const res = await axiosInstance.get('/api/attendance/correction-requests', { params: { status: 'pending' } });
      setCorrections(res.data.correction_requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCorrections(false);
    }
  };

  const approveCorrection = async (id: number) => {
    if (!confirm('Setujui koreksi ini? Data absensi akan diperbarui.')) return;
    try {
      await axiosInstance.post(`/api/attendance/correction-requests/${id}/approve`);
      fetchCorrections();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Gagal menyetujui');
    }
  };

  const rejectCorrection = async (id: number) => {
    const notes = prompt('Alasan penolakan (opsional):') || 'Ditolak oleh admin';
    try {
      await axiosInstance.post(`/api/attendance/correction-requests/${id}/reject`, { notes });
      fetchCorrections();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Gagal menolak');
    }
  };

  // Reconciliation
  const [flags, setFlags] = useState<ReconciliationFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [running, setRunning] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  });

  const fetchFlags = async () => {
    setLoadingFlags(true);
    try {
      const res = await axiosInstance.get('/api/attendance/reconciliation', { params: { status: 'open' } });
      setFlags(res.data.flags || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFlags(false);
    }
  };

  const runReconciliation = async () => {
    setRunning(true);
    try {
      const res = await axiosInstance.post('/api/attendance/reconciliation/run', {
        start_date: dateRange.start, end_date: dateRange.end,
      });
      alert(res.data.message);
      fetchFlags();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Gagal menjalankan reconciliation');
    } finally {
      setRunning(false);
    }
  };

  const reviewFlag = async (id: number) => {
    const notes = prompt('Catatan review (opsional):') || '';
    try {
      await axiosInstance.post(`/api/attendance/reconciliation/${id}/review`, { notes });
      fetchFlags();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Gagal menandai review');
    }
  };

  useEffect(() => {
    fetchCorrections();
    fetchFlags();
  }, []);

  const formatDT = (iso: string | null) => iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
        <ClipboardCheck className="h-6 w-6" />
        Koreksi &amp; Rekonsiliasi Absensi
      </h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('correction')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'correction' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          Pengajuan Koreksi {corrections.length > 0 && `(${corrections.length})`}
        </button>
        <button
          onClick={() => setTab('reconciliation')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'reconciliation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          Rekonsiliasi vs Log Produksi {flags.length > 0 && `(${flags.length})`}
        </button>
      </div>

      {tab === 'correction' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loadingCorrections ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : corrections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Tidak ada pengajuan koreksi menunggu approval</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perubahan Diajukan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alasan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {corrections.map(c => (
                  <tr key={c.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.employee_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.correction_date).toLocaleDateString('id-ID')}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {c.requested_change.clock_in && (
                        <div>In: {formatDT(c.requested_change.clock_in.old)} &rarr; {formatDT(c.requested_change.clock_in.new)}</div>
                      )}
                      {c.requested_change.clock_out && (
                        <div>Out: {formatDT(c.requested_change.clock_out.old)} &rarr; {formatDT(c.requested_change.clock_out.new)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">{c.reason}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => approveCorrection(c.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Setujui">
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button onClick={() => rejectCorrection(c.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Tolak">
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'reconciliation' && (
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Dari</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Sampai</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg" />
            </div>
            <button
              onClick={runReconciliation}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:bg-gray-400"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Jalankan Cross-Check
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {loadingFlags ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : flags.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Tidak ada mismatch terbuka. Jalankan cross-check untuk memeriksa rentang tanggal di atas.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jenis Mismatch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {flags.map(f => (
                    <tr key={f.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{f.employee_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(f.flag_date).toLocaleDateString('id-ID')}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-4 w-4" /> {MISMATCH_LABEL[f.mismatch_type] || f.mismatch_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => reviewFlag(f.id)}
                          className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
                        >
                          Tandai Sudah Direview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReconciliation;
