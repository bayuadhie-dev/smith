import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  RefreshCw, CheckCircle2, Printer, Pencil, X, AlertTriangle, Eye, Download, Filter,
} from 'lucide-react';

interface Batch {
  id: number;
  batch_number: string;
  work_order_id: number;
  wo_number: string | null;
  machine_id: number;
  machine_code: string | null;
  recipe_id: number;
  product_id: number | null;
  product_name: string | null;
  product_code: string | null;
  required_date: string | null;
  scheduled_date: string | null;
  shift_number: number | null;
  sequence_in_shift: number | null;
  planned_qty: number | null;
  realized_qty: number | null;
  status: string;
  is_over_capacity_warning: boolean;
  spk_document_id: number | null;
  spk_is_outdated: boolean;
}

interface Recipe {
  id: number;
  product_id: number;
  machine_id: number;
  machine_code: string | null;
  machine_name: string | null;
  batch_size: number;
  rate_per_hour: number;
  duration_hours: number | null;
  is_default: boolean;
  is_active: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  unplaceable: 'Tidak Bisa Dijadwalkan',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  unplaceable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const DocumentPreviewModal: React.FC<{ documentId: number; onClose: () => void }> = ({ documentId, onClose }) => {
  const [doc, setDoc] = useState<{ id: number; document_number: string; html_content: string; status: string; is_superseded: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get(`/api/documents/${documentId}/preview`)
      .then((res) => setDoc(res.data.document))
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleDownload = async () => {
    const res = await axiosInstance.get(`/api/documents/${documentId}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc?.document_number || 'spk'}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="font-medium">{doc?.document_number || 'Memuat...'}</div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="p-2 text-gray-500 hover:text-blue-600" title="Unduh PDF">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {loading && <div className="p-8 text-center text-gray-500">Memuat dokumen...</div>}
        {!loading && doc?.is_superseded && (
          <div className="m-4 p-4 bg-red-600 text-white font-bold text-center rounded-lg border-2 border-red-900">
            DOKUMEN INI SUDAH USANG — nomor batch sudah berubah, JANGAN DIPAKAI. Minta cetak ulang SPK yang berlaku saat ini.
          </div>
        )}
        {!loading && doc && (
          <div className="p-4" dangerouslySetInnerHTML={{ __html: doc.html_content }} />
        )}
      </div>
    </div>
  );
};

const BatchPlanning: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const woFilter = searchParams.get('work_order_id');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [replanning, setReplanning] = useState(false);
  // Kalau datang dari panel "Batch/SPK terkait" di WorkOrderDetail (Temuan 2,
  // UX_AUDIT_REPORT.md), tampilkan SEMUA status batch WO ini, bukan cuma draft.
  const [statusFilter, setStatusFilter] = useState(woFilter ? '' : 'draft');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [replanResult, setReplanResult] = useState<any>(null);
  const [editingNumberId, setEditingNumberId] = useState<number | null>(null);
  const [numberDraft, setNumberDraft] = useState('');
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipesByProduct, setRecipesByProduct] = useState<Record<number, Recipe[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (woFilter) params.work_order_id = woFilter;
      const res = await axiosInstance.get('/api/batch-scheduling/batches', { params });
      const loadedBatches: Batch[] = res.data.batches || [];
      setBatches(loadedBatches);
      setSelected(new Set());

      // Ambil daftar resep per produk (dropdown "mesin" sekarang sebenarnya dropdown resep -
      // 1 resep = 1 kombinasi mesin+kecepatan+ukuran batch tertentu untuk produk itu).
      const productIds = Array.from(new Set(
        loadedBatches
          .filter((b) => b.status === 'draft' && b.product_id != null)
          .map((b) => b.product_id as number)
      ));
      if (productIds.length > 0) {
        const results = await Promise.all(
          productIds.map((pid) =>
            axiosInstance.get('/api/batch-scheduling/recipes', { params: { product_id: pid } })
              .then((r) => [pid, r.data.recipes || []] as [number, Recipe[]])
              .catch(() => [pid, []] as [number, Recipe[]])
          )
        );
        setRecipesByProduct((prev) => {
          const next = { ...prev };
          for (const [pid, recipes] of results) next[pid] = recipes;
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, woFilter]);

  useEffect(() => { load(); }, [load]);

  const handleReplan = async () => {
    setReplanning(true);
    setError(null);
    setReplanResult(null);
    try {
      const res = await axiosInstance.post('/api/batch-scheduling/generate-replan');
      setReplanResult(res.data);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal menjalankan Generate/Re-plan.');
    } finally {
      setReplanning(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const eligible = batches.filter((b) => b.status === 'draft').map((b) => b.id);
    setSelected((prev) => (prev.size === eligible.length ? new Set() : new Set(eligible)));
  };

  const handleApprove = async () => {
    if (selected.size === 0) return;
    setError(null);
    try {
      const res = await axiosInstance.post('/api/batch-scheduling/batches/approve', { batch_ids: Array.from(selected) });
      if (res.data.errors?.length) {
        setError(res.data.errors.map((e: any) => `Batch #${e.batch_id}: ${e.error}`).join('; '));
      }
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal approve batch.');
    }
  };

  const handleReschedule = async (batch: Batch, patch: Partial<Pick<Batch, 'scheduled_date' | 'shift_number'>> & { recipe_id?: number }) => {
    setBusyId(batch.id);
    setError(null);
    try {
      await axiosInstance.put(`/api/batch-scheduling/batches/${batch.id}/reschedule`, patch);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal menggeser jadwal batch.');
    } finally {
      setBusyId(null);
    }
  };

  const startEditNumber = (batch: Batch) => {
    setEditingNumberId(batch.id);
    setNumberDraft(batch.batch_number);
  };

  const saveNumber = async (batch: Batch) => {
    setError(null);
    try {
      await axiosInstance.put(`/api/batch-scheduling/batches/${batch.id}/batch-number`, { batch_number: numberDraft });
      setEditingNumberId(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal mengubah nomor batch.');
    }
  };

  const handleReprint = async (batch: Batch) => {
    setBusyId(batch.id);
    setError(null);
    try {
      await axiosInstance.post(`/api/batch-scheduling/batches/${batch.id}/reprint-spk`);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal cetak ulang SPK.');
    } finally {
      setBusyId(null);
    }
  };

  const eligibleForApprove = batches.filter((b) => b.status === 'draft').length;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Batch Planning</h1>
          <p className="text-sm text-gray-500">Usulan jadwal batch produksi — hasil Generate/Re-plan, review lalu Approve.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReplan}
            disabled={replanning}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${replanning ? 'animate-spin' : ''}`} />
            {replanning ? 'Memproses...' : 'Generate / Re-plan'}
          </button>
          <button
            onClick={handleApprove}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> Approve ({selected.size})
          </button>
        </div>
      </div>

      {woFilter && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm rounded-lg flex items-center justify-between">
          <span>Menampilkan batch/SPK untuk SPK #{woFilter} saja.</span>
          <button onClick={() => setSearchParams({})} className="underline hover:no-underline">Tampilkan semua</button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg">{error}</div>
      )}

      {replanResult && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 text-sm rounded-lg">
          Selesai: {replanResult.released_draft_count} draft lama dilepas, {replanResult.created_count} batch baru dibuat.
          {replanResult.unplaceable?.length > 0 && (
            <div className="mt-1 text-red-600">{replanResult.unplaceable.length} kebutuhan tidak bisa dijadwalkan (kapasitas mesin penuh 365 hari) — cek kalender mesin terkait.</div>
          )}
          {replanResult.skipped_no_recipe?.length > 0 && (
            <div className="mt-1 text-amber-600">{replanResult.skipped_no_recipe.length} SPK dilewati karena belum ada resep produk+mesin.</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-gray-400" />
        {['draft', 'approved', 'in_progress', 'completed', 'unplaceable', ''].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-full border ${statusFilter === s ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
          >
            {s ? STATUS_LABEL[s] : 'Semua'}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={selected.size > 0 && selected.size === eligibleForApprove} onChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Nomor Batch</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">WO / Produk</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Mesin</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Jadwal</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">SPK</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Memuat...</td></tr>
            )}
            {!loading && batches.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Tidak ada batch</td></tr>
            )}
            {batches.map((b) => (
              <tr key={b.id} className={b.is_over_capacity_warning ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
                <td className="px-3 py-2 align-top">
                  {b.status === 'draft' && (
                    <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleSelect(b.id)} />
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {editingNumberId === b.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={numberDraft}
                        onChange={(e) => setNumberDraft(e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs"
                      />
                      <button onClick={() => saveNumber(b)} className="text-green-600 text-xs">Simpan</button>
                      <button onClick={() => setEditingNumberId(null)} className="text-gray-400 text-xs">Batal</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{b.batch_number}</span>
                      <button onClick={() => startEditNumber(b)} title="Edit nomor batch" className="text-gray-400 hover:text-blue-600">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {b.is_over_capacity_warning && (
                    <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
                      <AlertTriangle className="w-3 h-3" /> Lewat required date SO
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div>{b.wo_number}</div>
                  <div className="text-gray-400 text-xs">{b.product_code} {b.product_name}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  {b.status === 'draft' ? (
                    <select
                      value={b.recipe_id}
                      disabled={busyId === b.id}
                      onChange={(e) => handleReschedule(b, { recipe_id: parseInt(e.target.value, 10) })}
                      className="w-44 px-1.5 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs"
                      title="Pilih resep - mesin & kapasitas batch ikut resep yang dipilih"
                    >
                      {(b.product_id != null ? recipesByProduct[b.product_id] : undefined)?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.machine_code} - {r.batch_size}pcs @ {r.rate_per_hour}/jam{r.is_default ? ' (default)' : ''}
                        </option>
                      )) ?? <option value={b.recipe_id}>{b.machine_code}</option>}
                    </select>
                  ) : (
                    b.machine_code
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {b.status === 'draft' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={b.scheduled_date || ''}
                        disabled={busyId === b.id}
                        onChange={(e) => handleReschedule(b, { scheduled_date: e.target.value })}
                        className="px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs"
                      />
                      <select
                        value={b.shift_number ?? ''}
                        disabled={busyId === b.id}
                        onChange={(e) => handleReschedule(b, { shift_number: parseInt(e.target.value) })}
                        className="px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs"
                      >
                        {[1, 2, 3].map((s) => <option key={s} value={s}>Shift {s}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="text-xs">{b.scheduled_date} · Shift {b.shift_number}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-right">
                  {b.planned_qty}{b.realized_qty ? ` / ${b.realized_qty}` : ''}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[b.status] || ''}`}>{STATUS_LABEL[b.status] || b.status}</span>
                </td>
                <td className="px-3 py-2 align-top">
                  {b.spk_document_id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewDocId(b.spk_document_id)} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Lihat
                      </button>
                      {b.spk_is_outdated && (
                        <button
                          onClick={() => handleReprint(b)}
                          disabled={busyId === b.id}
                          title="SPK usang — nomor batch berubah, cetak ulang"
                          className="text-red-600 hover:underline text-xs flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> Cetak Ulang
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                  {b.spk_is_outdated && (
                    <div className="text-red-600 text-xs font-medium mt-0.5">SPK usang</div>
                  )}
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewDocId && <DocumentPreviewModal documentId={previewDocId} onClose={() => setPreviewDocId(null)} />}
    </div>
  );
};

export default BatchPlanning;
