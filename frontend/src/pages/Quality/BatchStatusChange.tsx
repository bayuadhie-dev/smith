import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';
import ActivityLogModal from '../../components/ActivityLogModal';
import { ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';

interface Batch {
  id: number;
  item_type: 'product' | 'material';
  item_code: string | null;
  item_name: string | null;
  batch_number: string | null;
  quantity_on_hand: number;
  stock_status: string;
  production_date: string | null;
  is_overdue: boolean;
  valid_statuses: string[];
}

const STATUS_BADGE: Record<string, string> = {
  released: 'badge-success',
  available: 'badge-success',
  quarantine: 'badge-warning',
  reject: 'badge-danger',
  in_stock: 'badge-info',
};

export default function BatchStatusChange() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selected, setSelected] = useState<Batch | null>(null);
  const [splits, setSplits] = useState<{ status: string; quantity: string }[]>([{ status: '', quantity: '' }]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistoryFor, setShowHistoryFor] = useState<Batch | null>(null);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 30 };
      if (search) params.search = search;
      if (statusFilter) params.stock_status = statusFilter;
      const res = await axiosInstance.get('/api/qc-batch-status/batches', { params });
      setBatches(res.data.batches || []);
      setTotalPages(res.data.pages || 1);
    } catch (e) {
      toast.error('Gagal memuat daftar batch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const openChangeStatus = (batch: Batch) => {
    setSelected(batch);
    setSplits([{ status: '', quantity: String(batch.quantity_on_hand) }]);
    setReason('');
  };

  const addSplitRow = () => setSplits([...splits, { status: '', quantity: '' }]);
  const removeSplitRow = (idx: number) => setSplits(splits.filter((_, i) => i !== idx));
  const updateSplitRow = (idx: number, field: 'status' | 'quantity', value: string) => {
    const next = [...splits];
    next[idx] = { ...next[idx], [field]: value };
    setSplits(next);
  };

  const splitTotal = splits.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

  const handleSave = async () => {
    if (!selected) return;
    if (splits.some((s) => !s.status || !s.quantity || Number(s.quantity) <= 0)) {
      toast.error('Isi status dan quantity untuk setiap baris');
      return;
    }
    if (splitTotal > selected.quantity_on_hand + 0.001) {
      toast.error(`Total quantity (${splitTotal}) melebihi quantity_on_hand batch ini (${selected.quantity_on_hand})`);
      return;
    }
    if (!reason.trim()) {
      toast.error('Alasan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post('/api/quality/inventory-disposition', {
        inventory_id: selected.id,
        splits: splits.map((s) => ({ status: s.status, quantity: Number(s.quantity) })),
        notes: reason,
      });
      toast.success('Disposisi batch berhasil disimpan');
      setSelected(null);
      fetchBatches();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menyimpan disposisi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ArrowPathIcon className="h-6 w-6" />
          Ubah Status Batch
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pecah quantity satu batch ke satu atau lebih status tujuan (release / quarantine / reject), bukan ubah status seluruh batch sekaligus.
        </p>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Cari kode/nama item atau nomor batch..."
          className="input-field flex-1 min-w-[240px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchBatches())}
        />
        <select className="input-field w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          <option value="released">released</option>
          <option value="available">available</option>
          <option value="quarantine">quarantine</option>
          <option value="reject">reject</option>
        </select>
        <button className="btn-secondary" onClick={() => { setPage(1); fetchBatches(); }}>Cari</button>
      </div>

      {loading ? (
        <div className="text-center py-12">Memuat...</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Batch</th>
                  <th>Qty</th>
                  <th>Tgl Produksi</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.item_code || '-'}</td>
                    <td>{b.item_name || '-'}</td>
                    <td>{b.item_type}</td>
                    <td>{b.batch_number || '-'}</td>
                    <td>{b.quantity_on_hand}</td>
                    <td>{b.production_date || '-'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[b.stock_status] || 'badge-info'}`}>{b.stock_status}</span>
                      {b.is_overdue && (
                        <span className="ml-2 badge badge-danger" title="Sudah lewat masa self-life/retest period">
                          Lewat Masa
                        </span>
                      )}
                    </td>
                    <td className="flex gap-2">
                      <button className="text-primary-600 hover:text-primary-800 text-sm" onClick={() => openChangeStatus(b)}>
                        Ubah Status
                      </button>
                      <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowHistoryFor(b)} title="Riwayat">
                        <ClockIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">Tidak ada batch ditemukan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center p-3 text-sm text-gray-500">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
            <span>Halaman {page} dari {totalPages}</span>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Berikutnya</button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">
              Disposisi Batch: {selected.item_code} - {selected.item_name}
            </h2>
            <div className="text-sm text-gray-500">
              Batch: {selected.batch_number || '-'} · Status saat ini: <span className="font-semibold">{selected.stock_status}</span> · Qty on hand: <span className="font-semibold">{selected.quantity_on_hand}</span>
            </div>

            <div className="space-y-2">
              <label className="block text-sm mb-1">
                Pecah quantity ke status tujuan (mis. sebagian release, sebagian reject)
              </label>
              {splits.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    className="input-field flex-1"
                    value={s.status}
                    onChange={(e) => updateSplitRow(idx, 'status', e.target.value)}
                  >
                    <option value="">Pilih status...</option>
                    {selected.valid_statuses.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-field w-32"
                    placeholder="Qty"
                    value={s.quantity}
                    onChange={(e) => updateSplitRow(idx, 'quantity', e.target.value)}
                  />
                  {splits.length > 1 && (
                    <button type="button" className="text-red-500 hover:text-red-700 text-sm" onClick={() => removeSplitRow(idx)}>
                      Hapus
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="text-primary-600 hover:text-primary-800 text-sm" onClick={addSplitRow}>
                + Tambah baris split
              </button>
              <div className={`text-sm ${splitTotal > selected.quantity_on_hand ? 'text-red-600' : 'text-gray-500'}`}>
                Total: {splitTotal} / {selected.quantity_on_hand}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Alasan</label>
              <textarea className="input-field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setSelected(null)}>Batal</button>
              <button className="btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryFor && (
        <ActivityLogModal
          isOpen={!!showHistoryFor}
          onClose={() => setShowHistoryFor(null)}
          resourceType="inventory_batch"
          resourceId={String(showHistoryFor.id)}
          title={`Riwayat Status: ${showHistoryFor.item_code || ''} - ${showHistoryFor.batch_number || ''}`}
        />
      )}
    </div>
  );
}
