import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { PencilIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import SearchableSelect from '../../components/SearchableSelect';
import {
  useGetProductsQuery,
  useLazyGetProductQuery,
  useUpdateProductMutation,
  useGetMaterialsListQuery,
  useLazyGetMaterialDetailQuery,
  useUpdateMaterialDetailMutation,
  useLazyGetProductUsageQuery,
  useLazyGetMaterialUsageQuery,
  useGetChartOfAccountsQuery,
  useImportMasterDataItemsMutation,
  useGetUomUnitsQuery,
  useCreateUomUnitMutation,
  useGetUomConversionsQuery,
  useCreateUomConversionMutation,
  useUpdateUomConversionMutation,
  useDeleteUomConversionMutation,
  useGetSuppliersQuery,
  useGetApprovedVendorsQuery,
  useCreateApprovedVendorMutation,
  useUpdateApprovedVendorMutation,
  useDeleteApprovedVendorMutation,
} from '../../services/api';
import { TrashIcon } from '@heroicons/react/24/outline';

type Source = 'product' | 'material';

interface Row {
  source: Source;
  id: number;
  code: string;
  name: string;
  material_type: string;
  category?: string | null;
  primary_uom: string;
  kelompok: string | null;
  ppn_code: string | null;
  erp_approval: boolean;
  is_active: boolean;
}

const AKUN_FIELDS: { key: string; label: string }[] = [
  { key: 'akun_persediaan_id', label: 'Persediaan' },
  { key: 'akun_hpp_id', label: 'Beban Pokok Penjualan (HPP)' },
  { key: 'akun_barang_terkirim_id', label: 'Barang Terkirim' },
  { key: 'akun_pembelian_belum_tertagih_id', label: 'Pembelian Belum Tertagih' },
  { key: 'akun_penjualan_id', label: 'Penjualan' },
  { key: 'akun_diskon_penjualan_id', label: 'Diskon Penjualan' },
  { key: 'akun_retur_penjualan_id', label: 'Retur Penjualan' },
  { key: 'akun_retur_pembelian_id', label: 'Retur Pembelian' },
  { key: 'akun_beban_id', label: 'Beban' },
];

export default function MasterDataBarangTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Source>('all');

  const { data: productsData, isLoading: loadingProducts, refetch: refetchProducts } =
    useGetProductsQuery({ all: true });
  const { data: materialsData, isLoading: loadingMaterials, refetch: refetchMaterials } =
    useGetMaterialsListQuery({ per_page: 2000 });
  const { data: accountsData } = useGetChartOfAccountsQuery(undefined);

  const [triggerGetProduct] = useLazyGetProductQuery();
  const [triggerGetMaterial] = useLazyGetMaterialDetailQuery();
  const [updateProduct] = useUpdateProductMutation();
  const [updateMaterialDetail] = useUpdateMaterialDetailMutation();
  const [triggerGetProductUsage] = useLazyGetProductUsageQuery();
  const [triggerGetMaterialUsage] = useLazyGetMaterialUsageQuery();

  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modalTab, setModalTab] = useState<'detail' | 'usage'>('detail');
  const [usage, setUsage] = useState<{ table: string; column: string; count: number; sample_ids: number[] }[] | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const [importItems, { isLoading: isImporting }] = useImportMasterDataItemsMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [showImportResult, setShowImportResult] = useState(false);

  const accountOptions = useMemo(
    () => (accountsData?.accounts || []).map((a: any) => ({ id: a.id, code: a.code, name: a.name })),
    [accountsData]
  );

  const rows: Row[] = useMemo(() => {
    const products: Row[] = (productsData?.products || []).map((p: any) => ({
      source: 'product',
      id: p.id,
      code: p.code,
      name: p.name,
      material_type: p.material_type,
      category: p.category,
      primary_uom: p.primary_uom,
      kelompok: p.kelompok,
      ppn_code: p.ppn_code,
      erp_approval: p.erp_approval,
      is_active: p.is_active,
    }));
    const materials: Row[] = (materialsData?.materials || []).map((m: any) => ({
      source: 'material',
      id: m.id,
      code: m.code,
      name: m.name,
      material_type: m.material_type,
      category: m.category,
      primary_uom: m.unit_of_measure,
      kelompok: m.kelompok,
      ppn_code: m.ppn_code,
      erp_approval: m.erp_approval,
      is_active: m.is_active,
    }));
    return [...products, ...materials];
  }, [productsData, materialsData]);

  const filtered = useMemo(() => {
    let r = rows;
    if (typeFilter !== 'all') r = r.filter((x) => x.source === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((x) => x.code.toLowerCase().includes(s) || x.name.toLowerCase().includes(s));
    }
    return r;
  }, [rows, typeFilter, search]);

  const openEdit = async (row: Row) => {
    setEditingRow(row);
    setShowModal(true);
    setModalTab('detail');
    setUsage(null);
    setLoadingDetail(true);
    try {
      if (row.source === 'product') {
        const detail = await triggerGetProduct(row.id).unwrap();
        setForm(detail);
      } else {
        const res: any = await triggerGetMaterial(row.id).unwrap();
        setForm(res.material || res);
      }
    } catch (e) {
      toast.error('Gagal memuat detail item');
      setShowModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openUsageTab = async (row: Row) => {
    setModalTab('usage');
    if (usage !== null) return;
    setLoadingUsage(true);
    try {
      const res: any = row.source === 'product'
        ? await triggerGetProductUsage(row.id).unwrap()
        : await triggerGetMaterialUsage(row.id).unwrap();
      setUsage(res.usage || []);
    } catch (e) {
      toast.error('Gagal memuat data penggunaan');
      setUsage([]);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleSave = async () => {
    if (!editingRow) return;
    try {
      const payload: Record<string, any> = {
        kelompok: form.kelompok || null,
        ppn_code: form.ppn_code || null,
        erp_approval: form.erp_approval,
        lead_time_days: form.lead_time_days,
        min_order_qty: form.min_order_qty ?? null,
        reorder_point: form.reorder_point ?? null,
      };
      for (const { key } of AKUN_FIELDS) {
        payload[key] = form[key] || null;
      }
      if (editingRow.source === 'product') {
        payload.self_life_days = form.self_life_days;
        payload.retest_period_days = form.retest_period_days;
        await updateProduct({ id: editingRow.id, ...payload }).unwrap();
      } else {
        payload.expiry_days = form.expiry_days;
        payload.safety_stock_qty = form.safety_stock_qty ?? null;
        payload.safety_stock_days = form.safety_stock_days ?? null;
        await updateMaterialDetail({ id: editingRow.id, ...payload }).unwrap();
      }
      toast.success('Item berhasil diupdate');
      setShowModal(false);
      refetchProducts();
      refetchMaterials();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menyimpan item');
    }
  };

  const isLoading = loadingProducts || loadingMaterials;
  const isWip = editingRow?.source === 'product' && form.material_type === 'wip';

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await importItems(formData).unwrap();
      setImportResult(res);
      setShowImportResult(true);
      refetchProducts();
      refetchMaterials();
      toast.success('Import selesai');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Gagal mengimpor file');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Cari kode atau nama barang..."
          className="input-field flex-1 min-w-[240px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
          disabled={isImporting}
          onClick={() => fileInputRef.current?.click()}
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
          {isImporting ? 'Mengimpor...' : 'Import Excel'}
        </button>
        <select className="input-field w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="all">Semua Tipe</option>
          <option value="product">Product</option>
          <option value="material">Material</option>
        </select>
      </div>

      {isLoading ? (
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
                  <th>Kategori</th>
                  <th>UOM</th>
                  <th>Kelompok</th>
                  <th>PPN</th>
                  <th>ERP Approval</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.slice(0, 300).map((row) => (
                  <tr key={`${row.source}-${row.id}`}>
                    <td className="font-medium">{row.code}</td>
                    <td>{row.name}</td>
                    <td>
                      <span className={`badge ${row.source === 'product' ? 'badge-info' : 'badge-warning'}`}>
                        {row.source}
                      </span>
                    </td>
                    <td>{row.material_type}</td>
                    <td>{row.primary_uom}</td>
                    <td>{row.kelompok || '-'}</td>
                    <td>{row.ppn_code || '-'}</td>
                    <td>
                      <span className={`badge ${row.erp_approval ? 'badge-warning' : 'badge-success'}`}>
                        {row.erp_approval ? 'Perlu QC Release' : 'Auto Release'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${row.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {row.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openEdit(row)} className="text-primary-600 hover:text-primary-800">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500">Tidak ada item ditemukan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 300 && (
            <div className="p-3 text-sm text-gray-500 text-center">
              Menampilkan 300 dari {filtered.length} item — persempit pencarian untuk melihat sisanya.
            </div>
          )}
        </div>
      )}

      {showModal && editingRow && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl p-6 space-y-4 my-8 mt-16">
            <h2 className="text-lg font-bold">
              Edit {editingRow.source === 'product' ? 'Product' : 'Material'}: {editingRow.code} - {editingRow.name}
            </h2>

            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setModalTab('detail')}
                className={`pb-2 px-1 border-b-2 text-sm font-medium ${
                  modalTab === 'detail' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
                }`}
              >
                Detail
              </button>
              <button
                onClick={() => openUsageTab(editingRow)}
                className={`pb-2 px-1 border-b-2 text-sm font-medium ${
                  modalTab === 'usage' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
                }`}
              >
                Usage
              </button>
            </div>

            {modalTab === 'usage' ? (
              <div className="min-h-[200px]">
                {loadingUsage ? (
                  <div className="py-8 text-center">Memuat data penggunaan...</div>
                ) : usage && usage.length > 0 ? (
                  <div className="space-y-2">
                    {usage.map((u) => (
                      <div key={`${u.table}-${u.column}`} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 py-2">
                        <div>
                          <span className="font-medium">{u.table}</span>
                          <span className="text-sm text-gray-500"> .{u.column}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {u.count} baris — id: {u.sample_ids.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Item ini belum dipakai di tabel manapun (BOM, Sales Order, Purchase Order, Inventory, dll).
                  </div>
                )}
                <div className="flex justify-end pt-4">
                  <button className="btn-secondary" onClick={() => setShowModal(false)}>Tutup</button>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="py-8 text-center">Memuat detail...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Kelompok</label>
                    <input
                      className="input-field"
                      value={form.kelompok || ''}
                      onChange={(e) => setForm({ ...form, kelompok: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">PPN</label>
                    <select
                      className="input-field"
                      value={form.ppn_code || ''}
                      onChange={(e) => setForm({ ...form, ppn_code: e.target.value || null })}
                    >
                      <option value="">Tidak ada</option>
                      <option value="Y">Y - 11%</option>
                      <option value="A">A - 1.1%</option>
                      <option value="B">B - 1.2%</option>
                      <option value="L">L - 12%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Lead Time (hari)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={form.lead_time_days ?? ''}
                      onChange={(e) => setForm({ ...form, lead_time_days: Number(e.target.value) })}
                    />
                  </div>

                  {editingRow.source === 'product' && !isWip && (
                    <div>
                      <label className="block text-sm mb-1">Self Life (hari)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.self_life_days ?? ''}
                        onChange={(e) => setForm({ ...form, self_life_days: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {editingRow.source === 'product' && isWip && (
                    <div>
                      <label className="block text-sm mb-1">Retest Period (hari)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.retest_period_days ?? ''}
                        onChange={(e) => setForm({ ...form, retest_period_days: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {editingRow.source === 'material' && (
                    <div>
                      <label className="block text-sm mb-1">Self Life / Expiry (hari)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.expiry_days ?? ''}
                        onChange={(e) => setForm({ ...form, expiry_days: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="erp_approval"
                      checked={!!form.erp_approval}
                      onChange={(e) => setForm({ ...form, erp_approval: e.target.checked })}
                    />
                    <label htmlFor="erp_approval" className="text-sm">
                      Perlu QC Release (batch masuk berstatus quarantine sampai di-release QC)
                    </label>
                  </div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700">
                  <h3 className="font-semibold mb-3">Parameter MRP</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Minimum Order Qty (MOQ)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.min_order_qty ?? ''}
                        onChange={(e) => setForm({ ...form, min_order_qty: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="Kosongkan jika lot-for-lot"
                      />
                      <p className="text-xs text-gray-500 mt-1">MRP membulatkan shortage ke angka ini bila lebih kecil.</p>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Reorder Point</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.reorder_point ?? ''}
                        onChange={(e) => setForm({ ...form, reorder_point: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </div>
                    {editingRow.source === 'material' && (
                      <div>
                        <label className="block text-sm mb-1">Safety Stock Qty</label>
                        <input
                          type="number"
                          className="input-field"
                          value={form.safety_stock_qty ?? ''}
                          onChange={(e) => setForm({ ...form, safety_stock_qty: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="Kosongkan jika tidak dipakai"
                        />
                        <p className="text-xs text-gray-500 mt-1">MRP menahan buffer ini, tidak netting sampai ke nol.</p>
                      </div>
                    )}
                    {editingRow.source === 'material' && (
                      <div>
                        <label className="block text-sm mb-1">Safety Stock Horizon (hari)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={form.safety_stock_days ?? ''}
                          onChange={(e) => setForm({ ...form, safety_stock_days: e.target.value === '' ? null : Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700">
                  <h3 className="font-semibold mb-3">Akun Perkiraan (Chart of Accounts)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {AKUN_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-sm mb-1">{label}</label>
                        <SearchableSelect
                          options={accountOptions}
                          value={form[key] || null}
                          onChange={(v) => setForm({ ...form, [key]: v })}
                          placeholder="Pilih akun..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700">
                  <h3 className="font-semibold mb-3">Satuan Bertingkat (UOM)</h3>
                  <ItemUomConversions
                    materialId={editingRow.source === 'material' ? editingRow.id : undefined}
                    productId={editingRow.source === 'product' ? editingRow.id : undefined}
                    baseUom={form.primary_uom}
                  />
                </div>

                {editingRow.source === 'material' && (
                  <div className="border-t pt-4 dark:border-gray-700">
                    <h3 className="font-semibold mb-3">Source List (Supplier Disetujui)</h3>
                    <ApprovedVendorsManager materialId={editingRow.id} />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button className="btn-primary" onClick={handleSave}>Simpan</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showImportResult && importResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">Hasil Import Excel</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card p-3">
                <div className="text-2xl font-bold text-primary-600">{importResult.created_product}</div>
                <div className="text-gray-500">Product dibuat</div>
              </div>
              <div className="card p-3">
                <div className="text-2xl font-bold text-primary-600">{importResult.created_material}</div>
                <div className="text-gray-500">Material dibuat</div>
              </div>
              <div className="card p-3">
                <div className="text-2xl font-bold text-gray-500">{importResult.skipped_exists}</div>
                <div className="text-gray-500">Dilewati (sudah ada)</div>
              </div>
              <div className="card p-3">
                <div className="text-2xl font-bold text-gray-500">{importResult.skipped_category}</div>
                <div className="text-gray-500">Dilewati (kategori)</div>
              </div>
            </div>

            {importResult.error_count > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600">{importResult.error_count} error:</p>
                <ul className="text-xs text-gray-500 max-h-24 overflow-y-auto list-disc pl-4">
                  {importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {importResult.missing_gl_code_count > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-600">
                  {importResult.missing_gl_code_count} kode akun tidak ditemukan di Chart of Accounts:
                </p>
                <p className="text-xs text-gray-500">{importResult.missing_gl_codes.join(', ')}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button className="btn-primary" onClick={() => setShowImportResult(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Kelola konversi satuan bertingkat per item (mis. 1 ROLL = 15000 PCS untuk sticker,
// 1 KRG = 25 KG untuk resin) - dipakai halaman Tutup SPK untuk prefill bahan aktual
// dari Material Issue. Reuse tabel models/uom.py::UoMConversion yang sudah ada.
function ItemUomConversions({ materialId, productId, baseUom }: { materialId?: number; productId?: number; baseUom?: string }) {
  const scopeParams = materialId ? { material_id: materialId } : productId ? { product_id: productId } : undefined;
  const { data: unitsData } = useGetUomUnitsQuery(undefined);
  const { data: conversionsData, refetch } = useGetUomConversionsQuery(scopeParams, { skip: !scopeParams });
  const [createConversion, { isLoading: creating }] = useCreateUomConversionMutation();
  const [updateConversion] = useUpdateUomConversionMutation();
  const [createUnit] = useCreateUomUnitMutation();
  const [deleteConversion] = useDeleteUomConversionMutation();

  // Free from/to unit pair - NOT locked to the item's primary_uom, so a real
  // multi-level chain can be built (e.g. 1 Pack = 6 Pcs, then separately
  // 1 Dus = 4 Pack), matching how tiered UOM actually works elsewhere
  // (Pcs -> Pack -> Dus), not "every unit must convert straight to one base".
  const [fromUnitCode, setFromUnitCode] = useState('');
  const [factor, setFactor] = useState('');
  const [toUnitCode, setToUnitCode] = useState(baseUom || '');

  const units: any[] = unitsData?.units || [];
  const allConversions: any[] = conversionsData?.conversions || [];
  // Only show conversions scoped to THIS item, not the global fallback rows also returned by the API
  const conversions = allConversions.filter((c) => (materialId ? c.material_id === materialId : c.product_id === productId));

  const getOrCreateUnit = async (code: string) => {
    const upper = code.trim().toUpperCase();
    const found = units.find((u) => u.code.toUpperCase() === upper);
    if (found) return found;
    const res: any = await createUnit({ code: upper, name: upper, category: 'unit' }).unwrap();
    return res.unit || res;
  };

  const handleAdd = async () => {
    if (!fromUnitCode.trim() || !toUnitCode.trim() || !factor) {
      toast.error('Satuan asal, satuan tujuan, dan rasio wajib diisi');
      return;
    }
    if (fromUnitCode.trim().toUpperCase() === toUnitCode.trim().toUpperCase()) {
      toast.error('Satuan asal dan tujuan tidak boleh sama');
      return;
    }
    try {
      const fromUnit = await getOrCreateUnit(fromUnitCode);
      const toUnit = await getOrCreateUnit(toUnitCode);

      // If this item already has a conversion for this exact pair, UPDATE
      // its factor instead of creating a new one - the backend rejects a
      // second create of the same from/to/scope as a duplicate.
      const existing = conversions.find((c) => c.from_uom_id === fromUnit.id && c.to_uom_id === toUnit.id);
      if (existing) {
        await updateConversion({ id: existing.id, conversion_factor: Number(factor) }).unwrap();
        toast.success('Konversi satuan diperbarui');
      } else {
        await createConversion({
          from_uom_id: fromUnit.id,
          to_uom_id: toUnit.id,
          conversion_factor: Number(factor),
          material_id: materialId,
          product_id: productId,
        }).unwrap();
        toast.success('Konversi satuan tersimpan');
      }
      setFromUnitCode('');
      setFactor('');
      setToUnitCode(baseUom || '');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.message || e?.data?.error || 'Gagal menyimpan konversi satuan');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteConversion(id).unwrap();
      toast.success('Konversi dihapus');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menghapus konversi');
    }
  };

  return (
    <div>
      {baseUom && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Satuan dasar item ini: <strong>{baseUom}</strong> - boleh bikin tingkatan berantai, misal 1 Pack = 6 {baseUom}, lalu 1 Dus = 4 Pack.
        </p>
      )}
      {conversions.length > 0 && (
        <div className="space-y-1 mb-3">
          {/* Show every pair for this item, not just ones ending in primary_uom - a chain like
              Dus->Pack and Pack->Pcs both need to be visible, not just the direct-to-base ones. */}
          {conversions.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5">
              <span>1 {c.from_uom_code} = {c.conversion_factor.toLocaleString()} {c.to_uom_code}</span>
              <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span>1</span>
        <input
          type="text"
          placeholder="DUS"
          className="input-field w-24"
          value={fromUnitCode}
          onChange={(e) => setFromUnitCode(e.target.value)}
        />
        <span>=</span>
        <input
          type="number"
          step="any"
          placeholder="4"
          className="input-field w-24"
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
        />
        <input
          type="text"
          placeholder={baseUom || 'PACK'}
          className="input-field w-24"
          value={toUnitCode}
          onChange={(e) => setToUnitCode(e.target.value)}
        />
        <button className="btn-secondary" disabled={creating} onClick={handleAdd}>
          Tambah
        </button>
      </div>
    </div>
  );
}

// Source List (SAP MM concept) - supplier mana saja yang boleh dipakai untuk material ini.
// Opt-in: material tanpa baris di sini tetap tidak dibatasi (routes/purchasing.py::create_purchase_order
// baru menolak PO kalau material SUDAH punya minimal 1 baris approved_vendors di sini).
function ApprovedVendorsManager({ materialId }: { materialId: number }) {
  const { data: vendorsData, refetch } = useGetApprovedVendorsQuery({ material_id: materialId });
  const { data: suppliersData } = useGetSuppliersQuery({ per_page: 1000 });
  const [createVendor, { isLoading: creating }] = useCreateApprovedVendorMutation();
  const [updateVendor] = useUpdateApprovedVendorMutation();
  const [deleteVendor] = useDeleteApprovedVendorMutation();

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [isPreferred, setIsPreferred] = useState(false);

  const approved: any[] = vendorsData?.approved_vendors || vendorsData?.data || [];
  const suppliers: any[] = suppliersData?.suppliers || suppliersData?.data || [];
  const supplierOptions = suppliers.map((s) => ({ id: s.id, name: `${s.code} - ${s.name}` }));
  const alreadyApprovedIds = new Set(approved.map((a) => a.supplier_id));

  const handleAdd = async () => {
    if (!supplierId) {
      toast.error('Pilih supplier dulu');
      return;
    }
    if (alreadyApprovedIds.has(supplierId)) {
      toast.error('Supplier ini sudah ada di source list');
      return;
    }
    try {
      await createVendor({ material_id: materialId, supplier_id: supplierId, is_preferred: isPreferred }).unwrap();
      toast.success('Supplier ditambahkan ke source list');
      setSupplierId(null);
      setIsPreferred(false);
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || e?.data?.message || 'Gagal menambah supplier');
    }
  };

  const handleTogglePreferred = async (row: any) => {
    try {
      await updateVendor({ id: row.id, is_preferred: !row.is_preferred }).unwrap();
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal memperbarui');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteVendor(id).unwrap();
      toast.success('Supplier dihapus dari source list');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menghapus');
    }
  };

  return (
    <div>
      {approved.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Belum dibatasi - material ini bisa dibeli dari supplier manapun. Tambahkan supplier di bawah untuk mulai membatasi (opt-in).
        </p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          Dibatasi - PO untuk material ini hanya bisa dibuat ke {approved.length} supplier di bawah.
        </p>
      )}
      {approved.length > 0 && (
        <div className="space-y-1 mb-3">
          {approved.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5">
              <span>
                {a.supplier_name || a.supplier?.name || `Supplier #${a.supplier_id}`}
                {a.is_preferred && <span className="ml-2 text-xs text-primary-600 font-medium">Preferred</span>}
              </span>
              <div className="flex items-center gap-3">
                <button
                  className="text-xs text-gray-500 hover:text-primary-600"
                  onClick={() => handleTogglePreferred(a)}
                >
                  {a.is_preferred ? 'Batal preferred' : 'Jadikan preferred'}
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <div className="w-64">
          <SearchableSelect
            options={supplierOptions}
            value={supplierId}
            onChange={(v) => setSupplierId(v === null ? null : Number(v))}
            placeholder="Pilih supplier..."
          />
        </div>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={isPreferred} onChange={(e) => setIsPreferred(e.target.checked)} />
          Preferred
        </label>
        <button className="btn-secondary" disabled={creating} onClick={handleAdd}>
          Tambah
        </button>
      </div>
    </div>
  );
}
