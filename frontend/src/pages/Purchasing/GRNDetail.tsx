import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  ArrowLeftIcon, ArrowPathIcon, CheckCircleIcon,
  ShieldCheckIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',    color: 'bg-gray-100 text-gray-700' },
  inspected: { label: 'Inspeksi',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
};

const QC_CONFIG: Record<string, { label: string; color: string }> = {
  passed:  { label: '✅ Lulus QC',   color: 'bg-green-50 text-green-700 border-green-200' },
  partial: { label: '⚠️ Sebagian',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  failed:  { label: '❌ Gagal QC',  color: 'bg-red-50 text-red-700 border-red-200' },
};

interface InspectItem {
  id: number;
  item_name: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_accepted: string;
  quantity_rejected: string;
  rejection_reason: string;
  uom: string;
  batch_number: string;
  expiry_date: string;
}

export default function GRNDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspectItems, setInspectItems] = useState<InspectItem[]>([]);
  const [inspectNotes, setInspectNotes] = useState('');

  const fetchGRN = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/purchasing/grn/${id}`);
      const data = res.data;
      setGrn(data);
      setInspectItems(
        data.items.map((item: any) => ({
          id: item.id,
          item_name: item.item_name,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
          quantity_accepted: String(item.quantity_accepted > 0 ? item.quantity_accepted : item.quantity_received),
          quantity_rejected: String(item.quantity_rejected || 0),
          rejection_reason: '',
          uom: item.uom,
          batch_number: item.batch_number || '',
          expiry_date: item.expiry_date || '',
        })),
      );
    } catch (err) {
      toast.error('Gagal memuat data GRN');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGRN(); }, [id]);

  const updateItem = (idx: number, field: keyof InspectItem, value: string) => {
    setInspectItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        // Auto-calculate rejected when accepted changes
        if (field === 'quantity_accepted') {
          const accepted = parseFloat(value) || 0;
          const received = item.quantity_received;
          const remaining = Math.max(0, received - accepted);
          updated.quantity_rejected = String(remaining);
        }
        return updated;
      }),
    );
  };

  const handleAcceptAll = () => {
    setInspectItems(prev =>
      prev.map(item => ({
        ...item,
        quantity_accepted: String(item.quantity_received),
        quantity_rejected: '0',
        rejection_reason: '',
      })),
    );
  };

  const handleInspect = async () => {
    setSaving(true);
    try {
      const payload = {
        notes: inspectNotes,
        items: inspectItems.map(item => ({
          id: item.id,
          quantity_accepted: parseFloat(item.quantity_accepted) || 0,
          quantity_rejected: parseFloat(item.quantity_rejected) || 0,
          rejection_reason: item.rejection_reason,
        })),
      };
      const res = await axiosInstance.post(`/api/purchasing/grn/${id}/inspect`, payload);
      toast.success(res.data.message || 'Inspeksi berhasil disimpan');
      fetchGRN();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan inspeksi');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      await axiosInstance.post(`/api/purchasing/grn/${id}/approve`);
      toast.success('GRN disetujui');
      fetchGRN();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal approve GRN');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (!grn) return <div className="p-6 text-red-500">GRN tidak ditemukan</div>;

  const isEditable = grn.status !== 'approved';
  const statusCfg = STATUS_CONFIG[grn.status] || { label: grn.status, color: 'bg-gray-100 text-gray-700' };
  const qcCfg = grn.quality_status ? QC_CONFIG[grn.quality_status] : null;

  const totalReceived = grn.items.reduce((s: number, i: any) => s + i.quantity_received, 0);
  const totalAccepted = inspectItems.reduce((s, i) => s + (parseFloat(i.quantity_accepted) || 0), 0);
  const totalRejected = inspectItems.reduce((s, i) => s + (parseFloat(i.quantity_rejected) || 0), 0);
  const acceptRate = totalReceived > 0 ? (totalAccepted / totalReceived * 100).toFixed(1) : '0';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/purchasing/grn" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{grn.grn_number}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {qcCfg && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${qcCfg.color}`}>
                  {qcCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditable && (
            <button
              onClick={handleAcceptAll}
              className="px-3 py-1.5 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50"
            >
              ✅ Terima Semua
            </button>
          )}
          {isEditable && (
            <button
              onClick={handleInspect}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ShieldCheckIcon className="h-4 w-4" />}
              Simpan Inspeksi
            </button>
          )}
          {grn.status === 'inspected' && (
            <button
              onClick={handleApprove}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Approve GRN
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'No. PO', value: grn.po_number },
          { label: 'Supplier', value: grn.supplier_name },
          { label: 'Tgl Terima', value: grn.receipt_date ? new Date(grn.receipt_date).toLocaleDateString('id-ID') : '—' },
          { label: 'Diterima oleh', value: grn.received_by_name || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* QC Summary bar */}
      {totalReceived > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ringkasan QC — {acceptRate}% diterima
            </span>
            <span className="text-xs text-gray-500">
              Diterima: <strong className="text-green-600">{totalAccepted.toLocaleString('id-ID')}</strong> |
              Ditolak: <strong className="text-red-600">{totalRejected.toLocaleString('id-ID')}</strong>
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${acceptRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Inspection table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          🔍 Inspeksi Item
          {grn.inspected_by_name && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              oleh {grn.inspected_by_name}
            </span>
          )}
        </h2>

        {/* Header */}
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase px-1">
          <div className="col-span-3">Item</div>
          <div className="col-span-1 text-right">Dipesan</div>
          <div className="col-span-1 text-right">Diterima</div>
          <div className="col-span-2">Qty Diterima</div>
          <div className="col-span-2">Qty Ditolak</div>
          <div className="col-span-3">Alasan Penolakan</div>
        </div>

        <div className="space-y-2">
          {inspectItems.map((item, idx) => {
            const accepted = parseFloat(item.quantity_accepted) || 0;
            const rejected = parseFloat(item.quantity_rejected) || 0;
            const isPartial = rejected > 0 && accepted > 0;
            const isAllRejected = accepted === 0 && rejected > 0;
            const rowColor = isAllRejected
              ? 'bg-red-50 dark:bg-red-900/20'
              : isPartial
              ? 'bg-yellow-50 dark:bg-yellow-900/20'
              : 'bg-gray-50 dark:bg-gray-700';

            return (
              <div key={item.id} className={`grid grid-cols-12 gap-2 items-start p-2 rounded-lg ${rowColor}`}>
                <div className="col-span-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.item_name}</p>
                  {item.batch_number && (
                    <p className="text-xs text-gray-400">Batch: {item.batch_number}</p>
                  )}
                  {item.expiry_date && (
                    <p className="text-xs text-gray-400">Exp: {item.expiry_date}</p>
                  )}
                </div>
                <div className="col-span-1 text-right text-sm text-gray-500">
                  {item.quantity_ordered.toLocaleString('id-ID')}
                  <span className="text-xs ml-1 text-gray-400">{item.uom}</span>
                </div>
                <div className="col-span-1 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                  {item.quantity_received.toLocaleString('id-ID')}
                  <span className="text-xs ml-1 text-gray-400">{item.uom}</span>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={item.quantity_accepted}
                    onChange={(e) => updateItem(idx, 'quantity_accepted', e.target.value)}
                    disabled={!isEditable}
                    min={0}
                    max={item.quantity_received}
                    step="any"
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white disabled:bg-gray-100 disabled:text-gray-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={item.quantity_rejected}
                    onChange={(e) => updateItem(idx, 'quantity_rejected', e.target.value)}
                    disabled={!isEditable}
                    min={0}
                    max={item.quantity_received}
                    step="any"
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white disabled:bg-gray-100 disabled:text-gray-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={item.rejection_reason}
                    onChange={(e) => updateItem(idx, 'rejection_reason', e.target.value)}
                    disabled={!isEditable || rejected === 0}
                    placeholder={rejected > 0 ? 'Alasan...' : '—'}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white disabled:bg-transparent disabled:border-transparent"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {isEditable && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Catatan Inspeksi
            </label>
            <textarea
              value={inspectNotes}
              onChange={(e) => setInspectNotes(e.target.value)}
              rows={2}
              placeholder="Catatan umum hasil inspeksi..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}

        {grn.notes && (
          <div className="pt-2 text-xs text-gray-500 whitespace-pre-line">{grn.notes}</div>
        )}
      </div>
    </div>
  );
}
