import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  XMarkIcon,
  ScaleIcon,
  ArchiveBoxIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import OcrPackingListModal from '../../components/Production/OcrPackingListModal';

interface PackingList {
  id: number;
  packing_number: string;
  product_id: number;
  product_name: string;
  product_code: string;
  customer_name: string | null;
  so_number: string | null;
  total_carton: number;
  total_pcs: number;
  start_carton_number: number;
  end_carton_number: number;
  status: string;
  packing_date: string | null;
  items_count: number;
  weighed_count: number;
  created_at: string;
}

interface WIPComponent {
  material_code: string;
  material_name: string;
  wip_product_id: number | null;
  qty_per_karton: number;
  uom: string;
  wip_stock_pcs: number;
  wip_stock_karton: number;
  possible_fg_kartons: number;
}

interface FGProduct {
  id: number;
  code: string;
  name: string;
  bom_id: number | null;
  bom_number: string | null;
  pack_per_carton: number;
  source: 'direct' | 'bom_components';
  available_kartons: number;
  available_pcs: number;
  wip_components: WIPComponent[];
}

export default function PackingListNew() {
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [wipProducts, setWipProducts] = useState<FGProduct[]>([]);
  const [creating, setCreating] = useState(false);

  const [creationMode, setCreationMode] = useState<'draft' | 'immediate'>('draft');

  // Form state for new packing list
  const [formData, setFormData] = useState({
    product_id: '',
    total_carton: '0',
    pack_per_carton: '',
    start_carton_number: '',
    customer_name: '',
    batch_mixing: '',
    notes: ''
  });

  const [batchRows, setBatchRows] = useState<Array<{ batch_mixing: string; total_carton: string }>>([
    { batch_mixing: '', total_carton: '1' }
  ]);
  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchPackingLists();
  }, [page, search, statusFilter]);

  const fetchPackingLists = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter })
      });
      
      const response = await axiosInstance.get(`/api/packing-list?${params}`);
      setPackingLists(response.data.packing_lists);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching packing lists:', error);
      toast.error('Gagal memuat daftar packing list');
    } finally {
      setLoading(false);
    }
  };

  const fetchWIPProducts = async () => {
    try {
      const response = await axiosInstance.get('/api/packing-list/products-with-wip');
      setWipProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching WIP products:', error);
    }
  };

  const handleOpenCreate = () => {
    fetchWIPProducts();
    setFormData({
      product_id: '',
      total_carton: '0',
      pack_per_carton: '',
      start_carton_number: '1',
      customer_name: '',
      batch_mixing: '',
      notes: ''
    });
    setBatchRows([{ batch_mixing: '', total_carton: '1' }]);
    setProductSearch('');
    setIsDropdownOpen(false);
    setShowCreateModal(true);
  };

  const handleDelete = async (pl: PackingList) => {
    if (!window.confirm(`Yakin ingin menghapus Packing List ${pl.packing_number}? Seluruh stok WIP yang dialokasikan akan dikembalikan.`)) {
      return;
    }
    try {
      await axiosInstance.delete(`/api/packing-list/${pl.id}`);
      toast.success(`Packing list ${pl.packing_number} berhasil dihapus dan stok dikembalikan`);
      fetchPackingLists();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghapus packing list');
    }
  };

  const handleCreatePackingList = async () => {
    if (!formData.product_id) {
      toast.error('Pilih produk terlebih dahulu');
      return;
    }

    const calculatedTotalCarton = creationMode === 'draft' ? 0 : batchRows.reduce((sum, r) => sum + (parseInt(r.total_carton) || 0), 0);
    
    if (creationMode === 'immediate') {
      if (calculatedTotalCarton <= 0) {
        toast.error('Jumlah total karton dari seluruh batch harus lebih besar dari 0');
        return;
      }
      
      const selectedProduct = wipProducts.find(p => p.id === parseInt(formData.product_id));
      const ppc = parseInt(formData.pack_per_carton) || 0;
      const maxK = selectedProduct?.source === 'direct'
        ? (selectedProduct.available_kartons || 0)
        : (selectedProduct && ppc > 0 && selectedProduct.wip_components && selectedProduct.wip_components.length > 0
            ? Math.min(...selectedProduct.wip_components.map((c: any) => Math.floor(c.wip_stock_pcs / ppc)))
            : 0);
      if (selectedProduct && calculatedTotalCarton > maxK) {
        toast.error(`Stok WIP tidak cukup. Maksimal: ${maxK} karton`);
        return;
      }
    }

    try {
      setCreating(true);
      const startNumber = creationMode === 'draft' ? 1 : parseInt(formData.start_carton_number) || 1;
      
      const batchesPayload = creationMode === 'draft' ? [] : batchRows.map((r, idx) => ({
        batch_mixing: r.batch_mixing || `BATCH-${idx + 1}`,
        total_carton: parseInt(r.total_carton) || 0
      }));

      await axiosInstance.post('/api/packing-list', {
        product_id: parseInt(formData.product_id),
        total_carton: calculatedTotalCarton,
        pack_per_carton: parseInt(formData.pack_per_carton) || undefined,
        start_carton_number: startNumber,
        customer_name: formData.customer_name || null,
        batch_mixing: batchesPayload.length > 0 ? batchesPayload[0].batch_mixing : null,
        batches: batchesPayload,
        notes: formData.notes || null
      });
      
      toast.success('Packing list berhasil dibuat');
      setShowCreateModal(false);
      fetchPackingLists();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuat packing list');
    } finally {
      setCreating(false);
    }
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
    const labels: Record<string, string> = {
      draft: 'Draft',
      in_progress: 'Dalam Proses',
      completed: 'Selesai Timbang',
      quarantine: 'Quarantine',
      released: 'Released',
      rejected: 'Rejected',
      cancelled: 'Dibatalkan'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const selectedProduct = wipProducts.find(p => p.id === parseInt(formData.product_id));

  // Recalculate max kartons based on user's pack_per_carton input
  const userPPC = parseInt(formData.pack_per_carton) || 0;
  const recalcMaxKartons = (() => {
    if (!selectedProduct) return 0;
    if (selectedProduct.source === 'direct') {
      // Direct mode: max kartons = FG WIP Stock kartons (fixed, not affected by PPC)
      return selectedProduct.available_kartons;
    }
    // BOM components mode: recalculate based on user PPC
    if (userPPC > 0 && selectedProduct.wip_components.length > 0) {
      return Math.min(...selectedProduct.wip_components.map(comp => 
        Math.floor(comp.wip_stock_pcs / userPPC)
      ));
    }
    return selectedProduct.available_kartons;
  })();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📦 Packing List</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola packing produk Finished Good</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/app/production/wip-stock"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium text-sm"
          >
            <ArchiveBoxIcon className="h-5 w-5" />
            Lihat WIP Stock
          </Link>
          <button
            onClick={() => setShowOcrModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg flex items-center gap-2 shadow text-sm transition"
          >
            <span className="text-base">📷</span>
            Input OCR Packing List
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium text-sm"
          >
            <PlusIcon className="h-5 w-5" />
            Buat Packing List
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nomor packing, produk, customer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="in_progress">Dalam Proses</option>
              <option value="completed">Selesai Timbang</option>
              <option value="quarantine">Quarantine</option>
              <option value="released">Released</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : packingLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <ArchiveBoxIcon className="h-16 w-16 mb-4 text-gray-300" />
            <p>Belum ada packing list</p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Buat Packing List Pertama
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Packing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Karton</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Karton</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progress</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {packingLists.map((pl) => (
                <tr key={pl.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-blue-600">{pl.packing_number}</span>
                    {pl.packing_date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(pl.packing_date).toLocaleDateString('id-ID')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{pl.product_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{pl.product_code}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {pl.customer_name || '-'}
                    {pl.so_number && <span className="text-xs text-blue-500 ml-2">({pl.so_number})</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="font-bold text-gray-900 dark:text-white">{pl.total_carton}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{pl.total_pcs.toLocaleString()} pcs</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-300">
                    {pl.start_carton_number} - {pl.end_carton_number}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <ScaleIcon className="h-4 w-4 text-gray-400" />
                      <span className={pl.weighed_count === pl.total_carton ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        {pl.weighed_count}/{pl.total_carton}
                      </span>
                    </div>
                    <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 mx-auto">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(pl.weighed_count / pl.total_carton) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {getStatusBadge(pl.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`/app/production/packing-list/${pl.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-medium"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Detail
                      </Link>
                      {pl.status !== 'released' && (
                        <button
                          onClick={() => handleDelete(pl)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs font-medium"
                          title="Hapus Packing List & kembalikan stok WIP"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Buat Packing List Baru</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipe Pembuatan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Metode Pembuatan *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode('draft');
                      setFormData(prev => ({ ...prev, total_carton: '0' }));
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                      creationMode === 'draft'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    📝 Buat Draft Kosong
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode('immediate');
                      setFormData(prev => ({ ...prev, total_carton: '' }));
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                      creationMode === 'immediate'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    ⚡ Buat & Isi Langsung
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {creationMode === 'draft'
                    ? 'Membuat PL kosong (0 karton). Batch & kapasitas pallet ditambahkan manual di halaman detail.'
                    : 'Membuat PL langsung dengan karton awal, memotong stok WIP saat ini.'}
                </p>
              </div>

              {/* Searchable Product Combobox */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Pilih Produk Finished Good * (Diprioritaskan yang Ada Stok Mesin)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsDropdownOpen(true);
                      if (!e.target.value) {
                        setFormData({ ...formData, product_id: '', pack_per_carton: '' });
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 pr-8 text-sm font-medium dark:bg-slate-700 dark:text-white"
                    placeholder="🔍 Ketik untuk cari nama / kode produk..."
                  />
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Dropdown Options */}
                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {(() => {
                      const filtered = wipProducts.filter(p =>
                        (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
                        (p.code || '').toLowerCase().includes(productSearch.toLowerCase())
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-xs text-slate-500 text-center">
                            Tidak ditemukan produk dengan kata kunci "{productSearch}"
                          </div>
                        );
                      }

                      return filtered.map((p) => {
                        const hasStock = p.available_kartons > 0;
                        const isSelected = formData.product_id === p.id.toString();
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                product_id: p.id.toString(),
                                pack_per_carton: p.pack_per_carton ? p.pack_per_carton.toString() : ''
                              });
                              setProductSearch(`${p.name} (${p.code})`);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700/70 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between transition ${
                              isSelected ? 'bg-blue-100/70 dark:bg-blue-900/40 font-bold' : ''
                            }`}
                          >
                            <div className="pr-2">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {p.name}
                                {p.name?.toLowerCase().includes('octenic') && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-pink-100 text-pink-800 rounded">OCTENIC</span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-400">Kode: {p.code}</p>
                            </div>

                            {hasStock ? (
                              <span className="px-2 py-1 text-[11px] font-extrabold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-md whitespace-nowrap flex items-center gap-1 border border-green-300">
                                🟢 STOK: {p.available_kartons.toLocaleString()} KRT
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded whitespace-nowrap">
                                Stok: 0
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Pack per Carton - di atas info ketersediaan agar maks karton terupdate */}
              {selectedProduct && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Pack per Karton *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.pack_per_carton}
                    onChange={(e) => setFormData({ ...formData, pack_per_carton: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: 24"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Jumlah pack/pcs dalam 1 karton. Default dari BOM, bisa diubah sesuai kebutuhan.
                  </p>
                </div>
              )}

              {/* FG Availability Info & Immediate Fields */}
              {creationMode === 'immediate' && selectedProduct && (
                <>
                  {userPPC > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-purple-800">Ketersediaan untuk Packing:</p>
                      <p className="text-lg font-bold text-purple-900">
                        Maks {recalcMaxKartons.toLocaleString()} karton ({(recalcMaxKartons * userPPC).toLocaleString()} pcs)
                      </p>
                      <p className="text-xs text-purple-600">
                        {selectedProduct.source === 'direct' ? 'Stok langsung (WIP Stock FG)' : `BOM: ${selectedProduct.bom_number}`}
                      </p>
                      {/* WIP Component Breakdown - only for bom_components mode */}
                      {selectedProduct.source === 'bom_components' && selectedProduct.wip_components.length > 0 && (
                        <div className="mt-2 border-t border-purple-200 pt-2">
                          <p className="text-xs font-medium text-purple-700 mb-1">Komponen WIP per karton ({userPPC} pcs/krt):</p>
                          {selectedProduct.wip_components.map((comp, idx) => {
                            const compMaxKrt = Math.floor(comp.wip_stock_pcs / userPPC);
                            const isBottleneck = compMaxKrt === recalcMaxKartons;
                            return (
                              <div key={idx} className={`flex justify-between text-xs py-0.5 ${isBottleneck && selectedProduct.wip_components.length > 1 ? 'text-red-600 font-medium' : 'text-purple-600'}`}>
                                <span>{comp.material_name}</span>
                                <span>
                                  Stok: {comp.wip_stock_pcs.toLocaleString()} pcs → {compMaxKrt.toLocaleString()} krt
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Multi-Batch Input Breakdown */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                        🏷️ Rincian Batch & Karton Produk
                      </label>
                      <button
                        type="button"
                        onClick={() => setBatchRows(rows => [...rows, { batch_mixing: '', total_carton: '1' }])}
                        className="px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Tambah Batch
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {batchRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-500 w-5 text-center">{idx + 1}.</span>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={row.batch_mixing}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBatchRows(rs => rs.map((r, i) => i === idx ? { ...r, batch_mixing: val } : r));
                              }}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                              placeholder={`No. Batch (contoh: BAT-00${idx + 1})`}
                            />
                          </div>
                          <div className="w-28">
                            <input
                              type="number"
                              min="1"
                              value={row.total_carton}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBatchRows(rs => rs.map((r, i) => i === idx ? { ...r, total_carton: val } : r));
                              }}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 text-right dark:bg-slate-700 dark:text-white"
                              placeholder="Qty Karton"
                            />
                          </div>
                          <span className="text-xs text-slate-500">krt</span>
                          {batchRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBatchRows(rs => rs.filter((_, i) => i !== idx))}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Total Summary */}
                    {(() => {
                      const grandTotalCarton = batchRows.reduce((sum, r) => sum + (parseInt(r.total_carton) || 0), 0);
                      const userPPC = parseInt(formData.pack_per_carton) || 0;
                      return (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>Total Karton ({batchRows.length} Batch):</span>
                          <span className="text-sm text-blue-600 dark:text-blue-400">
                            {grandTotalCarton.toLocaleString()} Karton {userPPC > 0 && `(${(grandTotalCarton * userPPC).toLocaleString()} pcs)`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Auto Numbering */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      🔢 Auto Numbering Karton (Maks 10.000)
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-blue-600 mb-1">Nomor Awal</label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={formData.start_carton_number}
                          onChange={(e) => setFormData({ ...formData, start_carton_number: e.target.value })}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-600 mb-1">Nomor Akhir</label>
                        <input
                          type="text"
                          readOnly
                          value={(() => {
                            const grandTotalCarton = batchRows.reduce((sum, r) => sum + (parseInt(r.total_carton) || 0), 0);
                            if (!grandTotalCarton || !formData.start_carton_number) return '-';
                            const start = parseInt(formData.start_carton_number);
                            let end = start + grandTotalCarton - 1;
                            if (end > 10000) end = ((end - 1) % 10000) + 1;
                            return end.toString();
                          })()}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-blue-100 text-blue-800 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Nama Customer (opsional)
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama customer"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Catatan (opsional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Catatan tambahan"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300"
              >
                Batal
              </button>
              <button
                onClick={handleCreatePackingList}
                disabled={creating || !formData.product_id || !formData.total_carton}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Membuat...' : 'Buat Packing List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Packing List Modal */}
      <OcrPackingListModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onSuccess={fetchPackingLists}
      />
    </div>
  );
}
