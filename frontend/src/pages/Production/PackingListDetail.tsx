import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ScaleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PrinterIcon,
  CalendarDaysIcon,
  PlusIcon,
  CameraIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import OcrPackingListModal from '../../components/Production/OcrPackingListModal';

interface PackingListItem {
  id: number;
  carton_number: number;
  weight_kg: number | null;
  weigh_date: string | null;
  weigh_time: string | null;
  batch_mixing: string | null;
  is_batch_start: boolean;
  cartons_per_pallet?: number | null;
  qc_status: string | null;
  weighed_by: string | null;
}

interface PackingList {
  id: number;
  packing_number: string;
  product_id: number;
  product_name: string;
  product_code: string;
  customer_name: string | null;
  so_number: string | null;
  pack_per_carton: number;
  total_carton: number;
  total_pcs: number;
  start_carton_number: number;
  end_carton_number: number;
  current_batch_mixing: string | null;
  status: string;
  packing_date: string | null;
  items_count: number;
  weighed_count: number;
  qc_status: string | null;
  qc_date: string | null;
  qc_by: string | null;
  qc_notes: string | null;
  released_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export default function PackingListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [packingList, setPackingList] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 10000; // Load all items for grouping

  const [editedItems, setEditedItems] = useState<Record<number, { weight_kg?: number; weigh_date?: string }>>({});
  const [bulkWeighDate, setBulkWeighDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newBatchMixing, setNewBatchMixing] = useState('');
  const [batchStartCarton, setBatchStartCarton] = useState<number | null>(null);

  // States for Add Batch feature
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [addBatchName, setAddBatchName] = useState('');
  const [addBatchTotalCarton, setAddBatchTotalCarton] = useState('');
  const [addBatchCartonsPerPallet, setAddBatchCartonsPerPallet] = useState('');

  // OCR Scan Modal State
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Accordion open/close states per batch mixing
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const toggleBatch = (bName: string) => {
    setExpandedBatches(prev => ({ ...prev, [bName]: !prev[bName] }));
  };

  useEffect(() => {
    if (id) {
      fetchPackingList();
    }
  }, [id]);

  const fetchPackingList = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/packing-list/${id}/items?page=1&per_page=${perPage}`);
      setPackingList(response.data.packing_list);
      setItems(response.data.items);
      setTotalPages(1);
      
      // Auto-expand newly added or first batch
      const uniqueBatches = Array.from(new Set(response.data.items.map((i: any) => i.batch_mixing || 'UNASSIGNED'))) as string[];
      setExpandedBatches(prev => {
        const next = { ...prev };
        uniqueBatches.forEach(b => {
          if (next[b] === undefined) {
            next[b] = true; // Default open
          }
        });
        return next;
      });
    } catch (error) {
      console.error('Error fetching packing list:', error);
      toast.error('Gagal memuat packing list');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (itemId: number, weight: string) => {
    const weightNum = parseFloat(weight) || 0;
    setEditedItems(prev => ({
      ...prev,
      [itemId]: { 
        ...prev[itemId],
        weight_kg: weightNum,
        weigh_date: prev[itemId]?.weigh_date || bulkWeighDate
      }
    }));
  };

  const handleWeighDateChange = (itemId: number, date: string) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: { 
        ...prev[itemId],
        weigh_date: date
      }
    }));
  };

  const saveWeights = async () => {
    try {
      setSaving(true);
      const itemsToUpdate = Object.entries(editedItems)
        .filter(([_, data]) => data.weight_kg !== undefined)
        .map(([id, data]) => ({
          id: parseInt(id),
          weight_kg: data.weight_kg,
          weigh_date: data.weigh_date || bulkWeighDate
        }));

      if (itemsToUpdate.length === 0) {
        toast('Tidak ada perubahan untuk disimpan');
        return;
      }

      await axiosInstance.put(`/api/packing-list/${id}/items/weigh`, { items: itemsToUpdate });
      toast.success(`${itemsToUpdate.length} karton berhasil ditimbang`);
      setEditedItems({});
      fetchPackingList();
    } catch (error) {
      console.error('Error saving weights:', error);
      toast.error('Gagal menyimpan berat karton');
    } finally {
      setSaving(false);
    }
  };

  const handleSetBatchMixing = async () => {
    if (!newBatchMixing.trim()) {
      toast.error('Batch mixing tidak boleh kosong');
      return;
    }

    try {
      setSaving(true);
      await axiosInstance.put(`/api/packing-list/${id}/items/batch`, {
        batch_mixing: newBatchMixing,
        start_from_carton: batchStartCarton
      });
      toast.success('Batch mixing berhasil diupdate');
      setShowBatchModal(false);
      setNewBatchMixing('');
      setBatchStartCarton(null);
      fetchPackingList();
    } catch (error) {
      console.error('Error setting batch mixing:', error);
      toast.error('Gagal mengatur batch mixing');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Yakin ingin membatalkan packing list ini? Stok akan dikembalikan ke WIP.')) {
      return;
    }

    try {
      await axiosInstance.post(`/api/packing-list/${id}/cancel`);
      toast.success('Packing list dibatalkan');
      navigate('/app/production/packing-list');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membatalkan packing list');
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Tandai packing list ini sebagai selesai?')) {
      return;
    }

    try {
      await axiosInstance.put(`/api/packing-list/${id}`, { status: 'completed' });
      toast.success('Packing list selesai');
      fetchPackingList();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyelesaikan packing list');
    }
  };

  const handleAddBatch = async () => {
    if (!addBatchName.trim()) {
      toast.error('Nama Batch harus diisi');
      return;
    }
    if (!addBatchTotalCarton || parseInt(addBatchTotalCarton) <= 0) {
      toast.error('Jumlah karton harus lebih besar dari 0');
      return;
    }
    if (!addBatchCartonsPerPallet || parseInt(addBatchCartonsPerPallet) <= 0) {
      toast.error('Kapasitas karton/pallet harus lebih besar dari 0');
      return;
    }

    try {
      setSaving(true);
      await axiosInstance.post(`/api/packing-list/${id}/batches`, {
        batch_mixing: addBatchName,
        total_carton: parseInt(addBatchTotalCarton),
        cartons_per_pallet: parseInt(addBatchCartonsPerPallet)
      });
      toast.success(`Batch ${addBatchName} berhasil ditambahkan`);
      setShowAddBatchModal(false);
      setAddBatchName('');
      setAddBatchTotalCarton('');
      setAddBatchCartonsPerPallet('');
      fetchPackingList();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menambahkan batch');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBatch = async (batchName: string) => {
    if (!window.confirm(`Yakin ingin menghapus batch "${batchName}"? Seluruh karton dalam batch ini akan dihapus dan stok WIP dikembalikan.`)) {
      return;
    }

    try {
      setSaving(true);
      await axiosInstance.delete(`/api/packing-list/${id}/batches/${batchName}`);
      toast.success(`Batch "${batchName}" berhasil dihapus`);
      fetchPackingList();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghapus batch');
    } finally {
      setSaving(false);
    }
  };

  const openBatchModal = (cartonNumber?: number) => {
    setBatchStartCarton(cartonNumber || null);
    setNewBatchMixing(packingList?.current_batch_mixing || '');
    setShowBatchModal(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-yellow-100 text-yellow-800',
      quarantine: 'bg-orange-100 text-orange-800',
      released: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-500'
    };
    return styles[status] || styles.draft;
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    in_progress: 'Dalam Proses',
    completed: 'Selesai Timbang',
    quarantine: 'Quarantine',
    released: 'Released',
    rejected: 'Rejected',
    cancelled: 'Dibatalkan'
  };

  if (loading && !packingList) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!packingList) {
    return (
      <div className="p-6 text-center text-red-600">
        Packing list tidak ditemukan
      </div>
    );
  }

  const progress = packingList.total_carton > 0 
    ? Math.round((packingList.weighed_count / packingList.total_carton) * 100) 
    : 0;

  // Group items by batch mixing
  const groupedBatches = (() => {
    const groups: Record<string, PackingListItem[]> = {};
    items.forEach(item => {
      const batchName = item.batch_mixing || 'UNASSIGNED';
      if (!groups[batchName]) {
        groups[batchName] = [];
      }
      groups[batchName].push(item);
    });

    return Object.entries(groups).map(([name, batchItems]) => {
      const sorted = [...batchItems].sort((a, b) => a.carton_number - b.carton_number);
      const minCarton = sorted[0]?.carton_number;
      const maxCarton = sorted[sorted.length - 1]?.carton_number;
      
      const weighed = sorted.filter(i => i.weight_kg !== null);
      const totalWeight = weighed.reduce((sum, i) => sum + (i.weight_kg || 0), 0);
      const cartonsPerPallet = sorted[0]?.cartons_per_pallet || 0;
      const estimatedPallets = cartonsPerPallet > 0 
        ? Math.ceil(sorted.length / cartonsPerPallet) 
        : 0;

      return {
        name,
        items: sorted,
        totalCartons: sorted.length,
        weighedCount: weighed.length,
        totalWeight,
        cartonRange: minCarton && maxCarton ? `#${minCarton} - #${maxCarton}` : '-',
        cartonsPerPallet,
        estimatedPallets
      };
    });
  })();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/app/production/packing-list"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{packingList.packing_number}</h1>
            {packingList.product_name?.toLowerCase().includes('octenic') && (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-pink-100 text-pink-800 rounded-full border border-pink-300">
                ⭐ OCTENIC (Wajib Berat per Karton)
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {packingList.product_name} ({packingList.product_code})
          </p>
        </div>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadge(packingList.status)}`}>
          {statusLabels[packingList.status] || packingList.status}
        </span>
      </div>

      {/* Octenic mandatory weight warning */}
      {packingList.product_name?.toLowerCase().includes('octenic') && (
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-3.5 mb-6 flex items-center justify-between text-xs text-pink-900">
          <div className="flex items-center gap-2">
            <span className="text-base">⚖️</span>
            <div>
              <p className="font-bold">Ketentuan Khusus Octenic:</p>
              <p>Seluruh karton ({packingList.total_carton} karton) wajib diisi beratnya (`weight_kg`) sebelum QC dapat meloloskan (Release) Packing List ini ke gudang.</p>
            </div>
          </div>
          <span className="font-bold text-pink-700 bg-pink-100 px-2 py-1 rounded">
            Terkirim: {packingList.weighed_count} / {packingList.total_carton} karton
          </span>
        </div>
      )}

      {/* QC Status Info Banner */}
      {(packingList.status === 'completed' || packingList.status === 'quarantine') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-yellow-800">Menunggu QC Review</p>
              <p className="text-sm text-yellow-600">Semua karton sudah ditimbang. QC review dilakukan di modul Quality Control.</p>
            </div>
            <Link
              to="/app/quality/packing-list"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              Buka QC Packing List
            </Link>
          </div>
        </div>
      )}

      {/* QC Info - show when QC has been done */}
      {packingList.qc_status && (packingList.status === 'released' || packingList.status === 'rejected') && (
        <div className={`rounded-lg p-4 mb-6 border ${
          packingList.status === 'released' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`font-medium ${packingList.status === 'released' ? 'text-green-800' : 'text-red-800'}`}>
            {packingList.status === 'released' ? 'QC Released - Stok sudah masuk gudang FG' : 'QC Rejected - Stok WIP dikembalikan'}
          </p>
          <div className="text-sm mt-1 space-y-0.5">
            {packingList.qc_by && <p className="text-gray-600 dark:text-gray-300">QC oleh: {packingList.qc_by}</p>}
            {packingList.qc_date && <p className="text-gray-600 dark:text-gray-300">Tanggal: {new Date(packingList.qc_date).toLocaleString('id-ID')}</p>}
            {packingList.qc_notes && <p className="text-gray-600 dark:text-gray-300">Catatan: {packingList.qc_notes}</p>}
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Karton</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{packingList.total_carton}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{packingList.total_pcs.toLocaleString()} pcs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nomor Karton</p>
          <p className="text-2xl font-bold text-blue-600">
            {packingList.start_carton_number} - {packingList.end_carton_number}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Progress Timbang</p>
          <p className="text-2xl font-bold text-green-600">{progress}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{packingList.weighed_count} / {packingList.total_carton} karton</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{packingList.customer_name || '-'}</p>
          {packingList.so_number && (
            <p className="text-xs text-blue-500">SO: {packingList.so_number}</p>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {!['completed', 'quarantine', 'released', 'rejected', 'cancelled'].includes(packingList.status) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
              <label className="text-sm text-gray-600 dark:text-gray-300">Tanggal Timbang Default:</label>
              <input
                type="date"
                value={bulkWeighDate}
                onChange={(e) => setBulkWeighDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1" />
              <button
                onClick={() => setShowAddBatchModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 font-medium"
              >
                <PlusIcon className="h-5 w-5" />
                Tambah Batch
              </button>
              <button
                onClick={() => setShowOcrModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg flex items-center gap-2 font-bold text-sm shadow transition"
              >
                <CameraIcon className="h-5 w-5" />
                <span>📷 Scan Timbangan OCR</span>
              </button>
              <button
                onClick={() => openBatchModal()}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                Ganti Batch Mixing
              </button>
            {packingList.total_carton > 0 && (
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircleIcon className="h-5 w-5" />
                Selesaikan Packing List
              </button>
            )}
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
            >
              <XCircleIcon className="h-5 w-5" />
              Batalkan
            </button>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="bg-green-50 border-b border-green-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-green-800">📦 Daftar Karton (Per Batch)</h3>
            <p className="text-sm text-green-600">
              Total: {packingList.total_carton} karton ({packingList.total_pcs.toLocaleString()} pcs)
            </p>
          </div>
          {Object.keys(editedItems).length > 0 && (
            <button
              onClick={saveWeights}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <ScaleIcon className="h-5 w-5" />
              {saving ? 'Menyimpan...' : `Simpan ${Object.keys(editedItems).length} Karton`}
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {groupedBatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Belum ada batch mixing. Silakan klik tombol "Tambah Batch" di atas untuk memulai.
            </div>
          ) : (
            groupedBatches.map((batch) => {
              const isOpen = expandedBatches[batch.name];
              const isEditable = !['completed', 'quarantine', 'released', 'rejected', 'cancelled'].includes(packingList.status);
              
              return (
                <div key={batch.name} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Accordion Header */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleBatch(batch.name)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-gray-700 font-bold"
                      >
                        {isOpen ? '▼' : '▶'}
                      </button>
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white text-base">
                          {batch.name}
                        </span>
                        <span className="ml-3 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">
                          {batch.cartonRange}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-gray-600 dark:text-gray-300">
                        Progress: <strong className="text-gray-900 dark:text-white">{batch.weighedCount}</strong> / {batch.totalCartons} krt
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">
                        Berat: <strong className="text-gray-900 dark:text-white">{batch.totalWeight.toFixed(3)} kg</strong>
                      </div>
                      <div className="text-gray-600 dark:text-gray-300 hidden sm:block">
                        Pallet: <strong>{batch.estimatedPallets} pallet</strong> ({batch.cartonsPerPallet} krt/plt)
                      </div>
                      
                      {isEditable && batch.weighedCount === 0 && (
                        <button
                          onClick={() => handleDeleteBatch(batch.name)}
                          className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded font-medium transition-colors"
                        >
                          Hapus Batch
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isOpen && (
                    <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-100/50 dark:bg-gray-900/30">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">No. Karton</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Berat (kg)</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tgl Timbang</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ditimbang Oleh</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                          {batch.items.map((item) => (
                            <tr 
                              key={item.id} 
                              className={`${item.is_batch_start ? 'bg-yellow-50/40 dark:bg-yellow-900/10' : ''} ${item.weight_kg ? 'bg-green-50/40 dark:bg-green-900/10' : ''}`}
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="font-semibold text-gray-900 dark:text-white">#{item.carton_number}</span>
                                {item.is_batch_start && (
                                  <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 rounded uppercase tracking-wider">
                                    Awal Pallet
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {!isEditable ? (
                                  <span className="text-sm font-medium">{item.weight_kg ? `${item.weight_kg} kg` : '-'}</span>
                                ) : (
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={editedItems[item.id]?.weight_kg ?? item.weight_kg ?? ''}
                                    onChange={(e) => handleWeightChange(item.id, e.target.value)}
                                    className="w-24 px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="0.000"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {!isEditable ? (
                                  <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {item.weigh_date ? new Date(item.weigh_date).toLocaleDateString('id-ID') : '-'}
                                  </span>
                                ) : (
                                  <input
                                    type="date"
                                    value={editedItems[item.id]?.weigh_date || item.weigh_date || bulkWeighDate}
                                    onChange={(e) => handleWeighDateChange(item.id, e.target.value)}
                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-medium">
                                {item.weighed_by || '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                {isEditable && (
                                  <button
                                    onClick={() => openBatchModal(item.carton_number)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                  >
                                    Ubah Batch
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Batch Mixing Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {batchStartCarton 
                ? `Set Batch Mixing dari Karton #${batchStartCarton}` 
                : 'Ganti Batch Mixing'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Batch Mixing
                </label>
                <input
                  type="text"
                  value={newBatchMixing}
                  onChange={(e) => setNewBatchMixing(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Contoh: BATCH-001"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300"
              >
                Batal
              </button>
              <button
                onClick={handleSetBatchMixing}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">➕ Tambah Batch/Pallet Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Nama Batch Mixing *
                </label>
                <input
                  type="text"
                  value={addBatchName}
                  onChange={(e) => setAddBatchName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Contoh: BATCH-02"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Jumlah Karton *
                </label>
                <input
                  type="number"
                  min="1"
                  value={addBatchTotalCarton}
                  onChange={(e) => setAddBatchTotalCarton(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Masukkan jumlah karton"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Karton per Pallet *
                </label>
                <input
                  type="number"
                  min="1"
                  value={addBatchCartonsPerPallet}
                  onChange={(e) => setAddBatchCartonsPerPallet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Kapasitas karton per pallet (contoh: 6)"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddBatchModal(false);
                  setAddBatchName('');
                  setAddBatchTotalCarton('');
                  setAddBatchCartonsPerPallet('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300"
              >
                Batal
              </button>
              <button
                onClick={handleAddBatch}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Menyimpan...' : 'Simpan Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Scan & Verification Modal */}
      {packingList && (
        <OcrPackingListModal
          isOpen={showOcrModal}
          onClose={() => setShowOcrModal(false)}
          onSuccess={fetchPackingList}
          packingListId={packingList.id}
          productInfo={{ id: packingList.product_id, name: packingList.product_name, code: packingList.product_code }}
          existingItems={items}
        />
      )}
    </div>
  );
}
