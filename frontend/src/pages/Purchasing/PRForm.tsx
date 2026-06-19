import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  ArrowLeftIcon, PlusIcon, TrashIcon, PaperAirplaneIcon,
  CheckIcon, XMarkIcon, ArrowPathIcon, DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
  converted: { label: 'Jadi PO',    color: 'bg-purple-100 text-purple-700' },
};

interface PRItem {
  id?: number;
  item_name: string;
  item_code: string;
  quantity: string;
  uom: string;
  estimated_unit_price: string;
  estimated_total: number;
  preferred_supplier_id: string;
  notes: string;
}

const emptyItem = (): PRItem => ({
  item_name: '', item_code: '', quantity: '', uom: 'kg',
  estimated_unit_price: '', estimated_total: 0,
  preferred_supplier_id: '', notes: '',
});

export default function PRForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [pr, setPr] = useState<any>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    department: '',
    required_date: '',
    purpose: '',
    priority: 'normal',
    notes: '',
  });
  const [items, setItems] = useState<PRItem[]>([emptyItem()]);

  // For convert-to-PO modal
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertSupplierId, setConvertSupplierId] = useState('');

  // For approve/reject modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveAction, setApproveAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    axiosInstance.get('/api/purchasing/suppliers?per_page=500')
      .then(r => setSuppliers(r.data.suppliers || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew) {
      setLoading(true);
      axiosInstance.get(`/api/purchasing/purchase-requisitions/${id}`)
        .then(r => {
          const data = r.data;
          setPr(data);
          setFormData({
            department: data.department || '',
            required_date: data.required_date || '',
            purpose: data.purpose || '',
            priority: data.priority || 'normal',
            notes: data.notes || '',
          });
          setItems(data.items.length > 0 ? data.items.map((i: any) => ({
            id: i.id,
            item_name: i.item_name,
            item_code: i.item_code || '',
            quantity: String(i.quantity),
            uom: i.uom,
            estimated_unit_price: i.estimated_unit_price ? String(i.estimated_unit_price) : '',
            estimated_total: i.estimated_total || 0,
            preferred_supplier_id: i.preferred_supplier_id ? String(i.preferred_supplier_id) : '',
            notes: i.notes || '',
          })) : [emptyItem()]);
        })
        .catch(() => toast.error('Gagal memuat data PR'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const calcTotal = (qty: string, price: string) =>
    (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  const updateItem = (idx: number, field: keyof PRItem, value: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.estimated_total = calcTotal(
        field === 'quantity' ? value : updated.quantity,
        field === 'estimated_unit_price' ? value : updated.estimated_unit_price,
      );
      return updated;
    }));
  };

  const handleSave = async () => {
    if (items.filter(i => i.item_name.trim()).length === 0) {
      toast.error('Tambahkan minimal 1 item');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        request_date: new Date().toISOString().split('T')[0],
        items: items
          .filter(i => i.item_name.trim())
          .map(i => ({
            ...i,
            quantity: parseFloat(i.quantity) || 0,
            estimated_unit_price: parseFloat(i.estimated_unit_price) || null,
            preferred_supplier_id: parseInt(i.preferred_supplier_id) || null,
          })),
      };
      if (isNew) {
        const res = await axiosInstance.post('/api/purchasing/purchase-requisitions', payload);
        toast.success('PR berhasil dibuat');
        navigate(`/app/purchasing/requisitions/${res.data.id}`);
      } else {
        await axiosInstance.put(`/api/purchasing/purchase-requisitions/${id}`, payload);
        toast.success('PR berhasil disimpan');
        navigate(0);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan PR');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await axiosInstance.post(`/api/purchasing/purchase-requisitions/${id}/submit`);
      toast.success('PR berhasil diajukan untuk approval');
      navigate(0);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal mengajukan PR');
    }
  };

  const handleApprove = async () => {
    try {
      await axiosInstance.post(`/api/purchasing/purchase-requisitions/${id}/approve`, {
        action: approveAction,
        rejection_reason: rejectionReason,
      });
      toast.success(approveAction === 'approve' ? 'PR disetujui' : 'PR ditolak');
      setShowApproveModal(false);
      navigate(0);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal');
    }
  };

  const handleConvertToPO = async () => {
    if (!convertSupplierId) { toast.error('Pilih supplier'); return; }
    try {
      const res = await axiosInstance.post(`/api/purchasing/purchase-requisitions/${id}/convert-to-po`, {
        supplier_id: parseInt(convertSupplierId),
      });
      toast.success(`Berhasil dibuat ${res.data.po_number}`);
      setShowConvertModal(false);
      navigate(`/app/purchasing/purchase-orders/${res.data.po_id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal konversi ke PO');
    }
  };

  const isEditable = isNew || pr?.status === 'draft';
  const statusCfg = pr ? (STATUS_CONFIG[pr.status] || { label: pr.status, color: 'bg-gray-100 text-gray-700' }) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/purchasing/requisitions" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {isNew ? 'Buat Purchase Requisition' : pr?.pr_number}
            </h1>
            {pr && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg?.color}`}>
                  {statusCfg?.label}
                </span>
                {pr.converted_po_number && (
                  <span className="text-xs text-purple-600">→ {pr.converted_po_number}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isEditable && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <DocumentCheckIcon className="h-4 w-4" />}
              Simpan
            </button>
          )}
          {pr?.status === 'draft' && (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              Ajukan
            </button>
          )}
          {pr?.status === 'submitted' && (
            <>
              <button
                onClick={() => { setApproveAction('approve'); setShowApproveModal(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <CheckIcon className="h-4 w-4" /> Setujui
              </button>
              <button
                onClick={() => { setApproveAction('reject'); setShowApproveModal(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                <XMarkIcon className="h-4 w-4" /> Tolak
              </button>
            </>
          )}
          {pr?.status === 'approved' && (
            <button
              onClick={() => setShowConvertModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Buat PO
            </button>
          )}
        </div>
      </div>

      {/* Rejection reason banner */}
      {pr?.status === 'rejected' && pr.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <strong>Alasan Penolakan:</strong> {pr.rejection_reason}
        </div>
      )}

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Informasi Umum</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Departemen</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))}
              disabled={!isEditable}
              placeholder="Contoh: Produksi, Gudang, QC..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tanggal Dibutuhkan</label>
            <input
              type="date"
              value={formData.required_date}
              onChange={(e) => setFormData(p => ({ ...p, required_date: e.target.value }))}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Prioritas</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(p => ({ ...p, priority: e.target.value }))}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="low">Rendah</option>
              <option value="normal">Normal</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tujuan / Keperluan</label>
            <input
              type="text"
              value={formData.purpose}
              onChange={(e) => setFormData(p => ({ ...p, purpose: e.target.value }))}
              disabled={!isEditable}
              placeholder="Untuk apa barang ini dibutuhkan?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Catatan</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
            disabled={!isEditable}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Daftar Item</h2>
          {isEditable && (
            <button
              onClick={() => setItems(p => [...p, emptyItem()])}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <PlusIcon className="h-4 w-4" /> Tambah Item
            </button>
          )}
        </div>

        {/* Item header */}
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase px-1">
          <div className="col-span-3">Nama Item</div>
          <div className="col-span-1">Kode</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-1">Satuan</div>
          <div className="col-span-2">Harga Est.</div>
          <div className="col-span-2">Supplier Pref.</div>
          <div className="col-span-1 text-right">Total Est.</div>
          {isEditable && <div className="col-span-1"></div>}
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <input
                  type="text"
                  value={item.item_name}
                  onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                  disabled={!isEditable}
                  placeholder="Nama material/barang"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="text"
                  value={item.item_code}
                  onChange={(e) => updateItem(idx, 'item_code', e.target.value)}
                  disabled={!isEditable}
                  placeholder="Kode"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  disabled={!isEditable}
                  placeholder="0"
                  min="0"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="text"
                  value={item.uom}
                  onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                  disabled={!isEditable}
                  placeholder="kg"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={item.estimated_unit_price}
                  onChange={(e) => updateItem(idx, 'estimated_unit_price', e.target.value)}
                  disabled={!isEditable}
                  placeholder="0"
                  min="0"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-2">
                <select
                  value={item.preferred_supplier_id}
                  onChange={(e) => updateItem(idx, 'preferred_supplier_id', e.target.value)}
                  disabled={!isEditable}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-50"
                >
                  <option value="">— Supplier —</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.estimated_total > 0
                  ? `Rp ${item.estimated_total.toLocaleString('id-ID')}`
                  : '—'}
              </div>
              {isEditable && (
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                    className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Total Estimasi: Rp {items.reduce((sum, i) => sum + i.estimated_total, 0).toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Approve/Reject Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">
              {approveAction === 'approve' ? '✅ Setujui PR' : '❌ Tolak PR'}
            </h3>
            {approveAction === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  placeholder="Jelaskan alasan penolakan..."
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowApproveModal(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button
                onClick={handleApprove}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${approveAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {approveAction === 'approve' ? 'Setujui' : 'Tolak PR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to PO Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">🛒 Buat Purchase Order</h3>
            <p className="text-sm text-gray-500 mb-4">PR akan dikonversi menjadi PO. Pilih supplier utama:</p>
            <select
              value={convertSupplierId}
              onChange={(e) => setConvertSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white mb-4"
            >
              <option value="">— Pilih Supplier —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.company_name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConvertModal(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button
                onClick={handleConvertToPO}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
              >
                Buat PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
