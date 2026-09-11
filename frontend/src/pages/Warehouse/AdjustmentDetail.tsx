import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ScaleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface Adjustment {
  id: number;
  adjustment_number: string;
  product_id: number | null;
  product_name: string | null;
  material_id: number | null;
  material_name: string | null;
  inventory_id: number | null;
  location_id: number;
  location_name: string | null;
  adjustment_type: string;
  reason: string;
  is_value_adjustment: boolean;
  system_quantity: number;
  physical_quantity: number;
  adjustment_quantity: number;
  akun_penyesuaian_id: number | null;
  unit_cost: number | null;
  total_cost_impact: number | null;
  status: string;
  requested_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  notes: string | null;
  reference_document: string | null;
  adjustment_date: string | null;
  created_at: string | null;
}

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
  pending_approval: { color: 'bg-amber-100 text-amber-700', label: 'Menunggu Persetujuan' },
  applied: { color: 'bg-green-100 text-green-700', label: 'Diterapkan' },
  rejected: { color: 'bg-red-100 text-red-700', label: 'Ditolak' },
};

export default function AdjustmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adj, setAdj] = useState<Adjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingWorkflowId, setPendingWorkflowId] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      fetchAdjustment();
      fetchPendingWorkflow();
    }
  }, [id]);

  const fetchAdjustment = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/wms/adjustments/${id}`);
      setAdj(res.data.adjustment);
    } catch (err) {
      toast.error('Gagal memuat data penyesuaian stok');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingWorkflow = async () => {
    try {
      const res = await axiosInstance.get('/api/approval/workflows', {
        params: { transaction_type: 'inventory_adjustment' },
      });
      const workflows = res.data.workflows || [];
      const active = workflows.find(
        (w: any) =>
          w.transaction_id === Number(id) &&
          (w.status === 'pending_review' || w.status === 'pending_approval')
      );
      setPendingWorkflowId(active ? active.id : null);
    } catch (err) {
      setPendingWorkflowId(null);
    }
  };

  const handleSubmitApproval = async () => {
    if (!window.confirm('Ajukan penyesuaian stok ini untuk persetujuan?')) return;
    try {
      setSubmitting(true);
      const res = await axiosInstance.post(`/api/wms/adjustments/${id}/submit-approval`);
      toast.success('Penyesuaian diajukan untuk persetujuan');
      const workflowId = res.data?.workflow_id;
      fetchAdjustment();
      setPendingWorkflowId(workflowId || null);
      if (workflowId && window.confirm('Diajukan untuk persetujuan. Lihat alur approval sekarang?')) {
        navigate(`/app/approval/${workflowId}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengajukan persetujuan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!adj) {
    return (
      <div className="p-6 text-center py-12 text-gray-400">
        <p>Data tidak ditemukan</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">Kembali</button>
      </div>
    );
  }

  const st = statusMap[adj.status] || statusMap.pending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/warehouse/adjustments')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ScaleIcon className="h-6 w-6 text-orange-600" />
              {adj.adjustment_number}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Detail Penyesuaian Stok</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${st.color}`}>{st.label}</span>
      </div>

      {adj.status === 'pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-blue-700">Penyesuaian ini masih draft, belum diajukan untuk persetujuan.</p>
          <button
            onClick={handleSubmitApproval}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircleIcon className="h-5 w-5" /> Ajukan Persetujuan
          </button>
        </div>
      )}

      {adj.status === 'pending_approval' && pendingWorkflowId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-amber-700 flex items-center gap-2">
            <ClockIcon className="h-5 w-5" /> Menunggu proses review/approval.
          </p>
          <button
            onClick={() => navigate(`/app/approval/${pendingWorkflowId}`)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Lihat Alur Approval
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Informasi Item</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Item</span>
              <span className="font-medium text-gray-900 dark:text-white">{adj.product_name || adj.material_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tipe Item</span>
              <span className="font-medium text-gray-900 dark:text-white">{adj.product_id ? 'Produk' : 'Material'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Lokasi</span>
              <span className="font-medium text-gray-900 dark:text-white">{adj.location_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Mode</span>
              {adj.is_value_adjustment ? (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Value Adjustment</span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Quantity Adjustment</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Alasan</span>
              <span className="font-medium text-gray-900 dark:text-white">{adj.reason}</span>
            </div>
            {adj.reference_document && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Dokumen Referensi</span>
                <span className="font-medium text-gray-900 dark:text-white">{adj.reference_document}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Kuantitas & Nilai</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">System Quantity</span>
              <span className="font-medium text-gray-900 dark:text-white">{adj.system_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Physical Quantity</span>
              <span className="font-medium text-gray-900 dark:text-white">{adj.physical_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Selisih Quantity</span>
              <span className={`font-medium ${adj.adjustment_quantity > 0 ? 'text-green-600' : adj.adjustment_quantity < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {adj.adjustment_quantity > 0 ? '+' : ''}{adj.adjustment_quantity}
              </span>
            </div>
            {adj.unit_cost !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Unit Cost</span>
                <span className="font-medium text-gray-900 dark:text-white">{adj.unit_cost.toLocaleString('id-ID')}</span>
              </div>
            )}
            {adj.total_cost_impact !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Cost Impact</span>
                <span className={`font-medium ${adj.total_cost_impact > 0 ? 'text-green-600' : adj.total_cost_impact < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {adj.total_cost_impact > 0 ? '+' : ''}{adj.total_cost_impact.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {adj.status === 'applied' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Persetujuan</h3>
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircleIcon className="h-5 w-5" />
            Diterapkan pada {adj.approved_at ? new Date(adj.approved_at).toLocaleString('id-ID') : '-'}
            {!adj.is_value_adjustment && ' — stok telah disesuaikan dan jurnal telah diposting.'}
            {adj.is_value_adjustment && ' — jurnal telah diposting (kuantitas stok tidak berubah, mode value).'}
          </div>
        </div>
      )}

      {adj.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Catatan</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">{adj.notes}</p>
        </div>
      )}
    </div>
  );
}
