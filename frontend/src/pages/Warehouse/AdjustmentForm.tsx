import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckIcon as Save,
  CubeIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  XMarkIcon as X,
} from '@heroicons/react/24/outline';

interface InventoryRow {
  id: number;
  product_id: number | null;
  material_id: number | null;
  item_name: string;
  item_code: string;
  uom: string;
  location_code: string;
  quantity_on_hand: number;
}

interface Account {
  id: number;
  code: string;
  name: string;
}

const reasons = [
  { value: 'counting_error', label: 'Kesalahan Hitung' },
  { value: 'damaged', label: 'Rusak' },
  { value: 'expired', label: 'Kadaluarsa' },
  { value: 'theft', label: 'Kehilangan/Pencurian' },
  { value: 'system_error', label: 'Kesalahan Sistem' },
  { value: 'stock_take', label: 'Stock Take' },
  { value: 'quality_issue', label: 'Masalah Kualitas' },
  { value: 'other', label: 'Lainnya' },
];

const AdjustmentForm: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [inventoryOptions, setInventoryOptions] = useState<InventoryRow[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<InventoryRow | null>(null);
  const [searching, setSearching] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isValueAdjustment, setIsValueAdjustment] = useState(false);
  const [physicalQuantity, setPhysicalQuantity] = useState('');
  const [totalCostImpact, setTotalCostImpact] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('counting_error');
  const [akunPenyesuaianId, setAkunPenyesuaianId] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceDocument, setReferenceDocument] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await axiosInstance.get('/api/finance/accounts');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      // Non-critical - user can still submit without an override, global default applies
    }
  };

  const searchInventory = async () => {
    if (!search.trim()) {
      toast.error('Masukkan kata kunci pencarian item');
      return;
    }
    try {
      setSearching(true);
      const res = await axiosInstance.get('/api/warehouse/inventory', {
        params: { search, per_page: 20 },
      });
      const rows = (res.data.inventory || res.data.items || []).map((inv: any) => ({
        id: inv.id,
        product_id: inv.product_id,
        material_id: inv.material_id,
        item_name: inv.product_name || inv.material_name || inv.item_name || '-',
        item_code: inv.product_code || inv.material_code || inv.item_code || '',
        uom: inv.uom || inv.primary_uom || '',
        location_code: inv.location_code || (inv.location && inv.location.location_code) || '',
        quantity_on_hand: Number(inv.quantity_on_hand ?? inv.quantity ?? 0),
      }));
      setInventoryOptions(rows);
      if (rows.length === 0) {
        toast.error('Tidak ditemukan item inventory dengan kata kunci tersebut');
      }
    } catch (err) {
      toast.error('Gagal mencari inventory');
    } finally {
      setSearching(false);
    }
  };

  const selectInventory = (inv: InventoryRow) => {
    setSelectedInventory(inv);
    setInventoryOptions([]);
    setSearch('');
  };

  const adjustmentQuantity =
    !isValueAdjustment && selectedInventory && physicalQuantity !== ''
      ? Number(physicalQuantity) - selectedInventory.quantity_on_hand
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedInventory) {
      setError('Pilih item inventory terlebih dahulu');
      return;
    }
    if (!isValueAdjustment && physicalQuantity === '') {
      setError('Physical Quantity wajib diisi untuk mode Quantity');
      return;
    }
    if (isValueAdjustment && totalCostImpact === '') {
      setError('Total Cost Impact wajib diisi untuk mode Value Adjustment');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        inventory_id: selectedInventory.id,
        reason,
        is_value_adjustment: isValueAdjustment,
        notes: notes || undefined,
        reference_document: referenceDocument || undefined,
      };
      if (akunPenyesuaianId) payload.akun_penyesuaian_id = Number(akunPenyesuaianId);
      if (unitCost) payload.unit_cost = Number(unitCost);

      if (isValueAdjustment) {
        payload.total_cost_impact = Number(totalCostImpact);
      } else {
        payload.physical_quantity = Number(physicalQuantity);
      }

      const res = await axiosInstance.post('/api/wms/adjustments', payload);
      const adjustmentId = res.data.adjustment?.id;
      toast.success('Penyesuaian stok dibuat sebagai draft');
      navigate(adjustmentId ? `/app/warehouse/adjustments/${adjustmentId}` : '/app/warehouse/adjustments');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat penyesuaian stok');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat Penyesuaian Stok</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Draft akan dibuat dulu, lalu bisa diajukan untuk persetujuan dari halaman detail
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <ExclamationCircleIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <CubeIcon className="inline h-4 w-4 mr-1" />
              Item Inventory *
            </label>
            {selectedInventory ? (
              <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{selectedInventory.item_code} - {selectedInventory.item_name}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4" /> {selectedInventory.location_code} — Stok sistem: {selectedInventory.quantity_on_hand} {selectedInventory.uom}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedInventory(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchInventory(); } }}
                    placeholder="Cari nama/kode produk atau material..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={searchInventory}
                    disabled={searching}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" /> Cari
                  </button>
                </div>
                {inventoryOptions.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg divide-y max-h-64 overflow-y-auto">
                    {inventoryOptions.map((inv) => (
                      <button
                        type="button"
                        key={inv.id}
                        onClick={() => selectInventory(inv)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-900">{inv.item_code} - {inv.item_name}</p>
                          <p className="text-xs text-gray-500">{inv.location_code}</p>
                        </div>
                        <span className="text-sm text-gray-600">{inv.quantity_on_hand} {inv.uom}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Mode Penyesuaian</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!isValueAdjustment} onChange={() => setIsValueAdjustment(false)} />
                Quantity — koreksi jumlah fisik
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={isValueAdjustment} onChange={() => setIsValueAdjustment(true)} />
                Value — koreksi nilai/harga saja (qty tidak berubah)
              </label>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Alasan *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Quantity mode fields */}
          {!isValueAdjustment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Physical Quantity *</label>
                <input
                  type="number"
                  value={physicalQuantity}
                  onChange={(e) => setPhysicalQuantity(e.target.value)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Hasil hitung fisik"
                />
                {selectedInventory && physicalQuantity !== '' && (
                  <p className={`mt-1 text-sm ${adjustmentQuantity > 0 ? 'text-green-600' : adjustmentQuantity < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {adjustmentQuantity > 0 && <ArrowTrendingUpIcon className="inline h-4 w-4 mr-1" />}
                    {adjustmentQuantity < 0 && <ArrowTrendingDownIcon className="inline h-4 w-4 mr-1" />}
                    Selisih: {adjustmentQuantity > 0 ? '+' : ''}{adjustmentQuantity}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <CurrencyDollarIcon className="inline h-4 w-4 mr-1" />
                  Unit Cost (opsional, untuk hitung jurnal)
                </label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Harga per unit"
                />
              </div>
            </div>
          )}

          {/* Value mode fields */}
          {isValueAdjustment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <CurrencyDollarIcon className="inline h-4 w-4 mr-1" />
                Total Cost Impact (IDR) *
              </label>
              <input
                type="number"
                value={totalCostImpact}
                onChange={(e) => setTotalCostImpact(e.target.value)}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Positif = naik nilai, negatif = turun nilai"
              />
              <p className="mt-1 text-sm text-gray-500">Kuantitas stok tidak akan berubah - hanya nilai/jurnal.</p>
            </div>
          )}

          {/* Akun Penyesuaian override */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Akun Penyesuaian (opsional)
            </label>
            <select
              value={akunPenyesuaianId}
              onChange={(e) => setAkunPenyesuaianId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Pakai default global (Pengaturan &gt; Preferensi Akun &gt; Inventory)</option>
              {accounts.filter((acc) => !(acc as any).is_header).map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>

          {/* Reference and notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Dokumen Referensi</label>
              <input
                type="text"
                value={referenceDocument}
                onChange={(e) => setReferenceDocument(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="mis. Stock Take ST-2026-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <DocumentTextIcon className="inline h-4 w-4 mr-1" />
                Catatan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Penjelasan singkat"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate('/app/warehouse/adjustments')}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
            >
              <X className="inline h-4 w-4 mr-2" />Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="inline h-4 w-4 mr-2" />
              {loading ? 'Menyimpan...' : 'Simpan sebagai Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdjustmentForm;
