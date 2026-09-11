import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  PlayIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface StockOpnameOrder {
  id: number;
  opname_number: string;
  zone_name: string;
  opname_type: string;
  scheduled_date: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  assigned_to_name: string | null;
  total_items: number;
  counted_items: number;
  variance_items: number;
  total_variance_value: number;
  notes: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_by_name: string;
}

interface StockOpnameItem {
  id: number;
  item_code: string;
  item_name: string;
  location_code: string;
  batch_number: string | null;
  uom: string;
  system_qty: number;
  counted_qty: number | null;
  variance_qty: number | null;
  status: string;
  counted_by_name: string | null;
  notes: string | null;
}

const STATUS_COLORS: { [key: string]: string } = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: { [key: string]: string } = {
  draft: 'Draft',
  scheduled: 'Terjadwal',
  in_progress: 'Sedang Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export default function StockOpnameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<StockOpnameOrder | null>(null);
  const [items, setItems] = useState<StockOpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countingItem, setCountingItem] = useState<StockOpnameItem | null>(null);
  const [countedQty, setCountedQty] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingWorkflowId, setPendingWorkflowId] = useState<number | null>(null);
  const [pendingWorkflowStep, setPendingWorkflowStep] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchItems();
      fetchPendingWorkflow();
    }
  }, [id]);

  const fetchPendingWorkflow = async () => {
    try {
      const response = await axiosInstance.get('/api/approval/workflows', {
        params: { transaction_type: 'stock_opname' },
      });
      const workflows = response.data.workflows || [];
      const active = workflows.find(
        (w: any) =>
          w.transaction_id === Number(id) &&
          (w.status === 'pending_review' || w.status === 'pending_approval')
      );
      setPendingWorkflowId(active ? active.id : null);
      setPendingWorkflowStep(active ? active.current_step : null);
    } catch (error) {
      // Non-critical - approval status just won't show if this fails
      setPendingWorkflowId(null);
      setPendingWorkflowStep(null);
    }
  };

  // Temuan 3 (UX_AUDIT_REPORT.md): approve/reject inline di halaman ini sendiri, tanpa
  // redirect ke Approval Dashboard generik - staf tetap lihat detail item/lokasi opname
  // yang sedang diproses. Panggil endpoint approval generik (/review atau /approve
  // tergantung current_step) di background, sama seperti Approval Dashboard lakukan.
  const handleInlineDecision = async (decision: 'approve' | 'reject') => {
    if (!pendingWorkflowId) return;
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      if (decision === 'reject') {
        await axiosInstance.post(`/api/approval/workflows/${pendingWorkflowId}/reject`, {
          reason: approvalNotes,
        });
        toast.success('Opname ditolak');
      } else if (pendingWorkflowStep === 'review') {
        await axiosInstance.post(`/api/approval/workflows/${pendingWorkflowId}/review`, {
          notes: approvalNotes,
        });
        toast.success('Opname direview, lanjut ke tahap approval');
      } else {
        await axiosInstance.post(`/api/approval/workflows/${pendingWorkflowId}/approve`, {
          notes: approvalNotes,
        });
        toast.success('Opname disetujui');
      }
      setShowApprovalModal(false);
      setApprovalNotes('');
      fetchOrder();
      fetchPendingWorkflow();
    } catch (error: any) {
      setApprovalError(error.response?.data?.error || 'Gagal memproses keputusan');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const fetchOrder = async () => {
    try {
      const response = await axiosInstance.get(`/api/stock-opname/orders/${id}`);
      setOrder(response.data.order);
    } catch (error) {
      toast.error('Gagal memuat data opname');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const response = await axiosInstance.get(`/api/stock-opname/orders/${id}/items?${params}`);
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchItems();
    }
  }, [searchTerm, statusFilter]);

  const handleStart = async () => {
    try {
      await axiosInstance.put(`/api/stock-opname/orders/${id}/start`);
      toast.success('Stok opname dimulai');
      fetchOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memulai');
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Selesaikan stok opname ini? Pastikan semua item sudah dihitung.')) return;

    try {
      await axiosInstance.put(`/api/stock-opname/orders/${id}/complete`);
      toast.success('Stok opname selesai');
      fetchOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyelesaikan');
    }
  };

  const handleSubmitApproval = async () => {
    if (!window.confirm('Ajukan hasil opname ini untuk persetujuan?')) return;

    try {
      const response = await axiosInstance.post(`/api/stock-opname/orders/${id}/submit-approval`);
      toast.success('Opname diajukan untuk persetujuan');
      setPendingWorkflowId(response.data?.workflow_id || null);
      setPendingWorkflowStep('review');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal mengajukan persetujuan');
    }
  };

  const openCountModal = (item: StockOpnameItem) => {
    setCountingItem(item);
    setCountedQty(item.counted_qty?.toString() || '');
    setCountNotes(item.notes || '');
  };

  const handleSaveCount = async () => {
    if (!countingItem || countedQty === '') {
      toast.error('Masukkan jumlah hasil hitung');
      return;
    }

    try {
      setSubmitting(true);
      await axiosInstance.put(
        `/api/stock-opname/orders/${id}/items/${countingItem.id}/count`,
        {
          counted_qty: parseFloat(countedQty),
          notes: countNotes || null,
        }
      );
      toast.success('Hasil hitung disimpan');
      setCountingItem(null);
      fetchItems();
      fetchOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Data tidak ditemukan</p>
      </div>
    );
  }

  const progress = order.total_items > 0 ? (order.counted_items / order.total_items) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/warehouse/stock-opname')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="h-8 w-8 text-blue-600" />
              {order.opname_number}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {order.zone_name} • Jadwal: {formatDate(order.scheduled_date)}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Item</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{order.total_items}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Sudah Dihitung</p>
          <p className="text-2xl font-bold text-blue-600">{order.counted_items}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Item Selisih</p>
          <p className={`text-2xl font-bold ${order.variance_items > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {order.variance_items}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nilai Selisih</p>
          <p className={`text-xl font-bold ${order.total_variance_value !== 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(order.total_variance_value)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Progress Penghitungan</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-3">
        {order.status === 'draft' && (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <PlayIcon className="h-5 w-5" />
            Mulai Opname
          </button>
        )}
        {order.status === 'in_progress' && order.counted_items === order.total_items && (
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <CheckCircleIcon className="h-5 w-5" />
            Selesaikan Opname
          </button>
        )}
        {order.status === 'completed' && !order.approved_by_name && !pendingWorkflowId && (
          <button
            onClick={handleSubmitApproval}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <CheckCircleIcon className="h-5 w-5" />
            Ajukan Persetujuan
          </button>
        )}
        {order.status === 'completed' && !order.approved_by_name && pendingWorkflowId && (
          <button
            onClick={() => { setApprovalError(null); setApprovalNotes(''); setShowApprovalModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
          >
            <CheckCircleIcon className="h-5 w-5" />
            Menunggu Approval ({pendingWorkflowStep === 'review' ? 'Review' : 'Approval'}) — Proses di Sini
          </button>
        )}
        {order.approved_by_name && (
          <div className="text-sm text-green-600">
            ✓ Diapprove oleh {order.approved_by_name} pada {order.approved_at ? formatDate(order.approved_at) : '-'}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kode/nama item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="">Semua Status</option>
            <option value="pending">Belum Dihitung</option>
            <option value="counted">Sudah Dihitung</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokasi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty Sistem</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty Hitung</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 ${item.variance_qty && item.variance_qty !== 0 ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.item_code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.item_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.location_code}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.batch_number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">{item.system_qty} {item.uom}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {item.counted_qty !== null ? `${item.counted_qty} ${item.uom}` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    item.variance_qty && item.variance_qty !== 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {item.variance_qty !== null ? (
                      <>
                        {item.variance_qty > 0 ? '+' : ''}{item.variance_qty}
                      </>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      item.status === 'counted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {item.status === 'counted' ? 'Dihitung' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {order.status === 'in_progress' && (
                      <button
                        onClick={() => openCountModal(item)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {item.status === 'counted' ? 'Edit' : 'Hitung'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Count Modal */}
      {countingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Input Hasil Hitung</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Item</p>
                <p className="font-medium">{countingItem.item_code} - {countingItem.item_name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Lokasi: {countingItem.location_code}</p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-600">Qty di Sistem</p>
                <p className="text-xl font-bold text-blue-800">{countingItem.system_qty} {countingItem.uom}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Qty Hasil Hitung *
                </label>
                <input
                  type="number"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan jumlah"
                  autoFocus
                />
              </div>

              {countedQty && parseFloat(countedQty) !== countingItem.system_qty && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Selisih Terdeteksi</p>
                    <p className="text-sm text-yellow-700">
                      {parseFloat(countedQty) - countingItem.system_qty > 0 ? '+' : ''}
                      {(parseFloat(countedQty) - countingItem.system_qty).toFixed(2)} {countingItem.uom}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Catatan
                </label>
                <textarea
                  value={countNotes}
                  onChange={(e) => setCountNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="Catatan (opsional)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setCountingItem(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
              >
                Batal
              </button>
              <button
                onClick={handleSaveCount}
                disabled={submitting || countedQty === ''}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApprovalModal && order && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {pendingWorkflowStep === 'review' ? 'Review' : 'Approval'} Stok Opname
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {order.opname_number} — {order.zone_name} — {order.variance_items} item selisih,
              total nilai selisih Rp {order.total_variance_value?.toLocaleString('id-ID') || 0}
            </p>
            {approvalError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">{approvalError}</div>
            )}
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Catatan</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              placeholder="Catatan approval/alasan tolak (opsional untuk approve, disarankan untuk tolak)"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowApprovalModal(false)}
                disabled={approvalSubmitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                onClick={() => handleInlineDecision('reject')}
                disabled={approvalSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Tolak
              </button>
              <button
                onClick={() => handleInlineDecision('approve')}
                disabled={approvalSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {approvalSubmitting ? 'Memproses...' : (pendingWorkflowStep === 'review' ? 'Setujui (Review)' : 'Setujui')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
