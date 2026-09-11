import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowUturnLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import WorkOrderBomActualTree, { BomTreeItem } from '../../components/Production/WorkOrderBomActualTree';

interface InventoryRow {
  id: number;
  location_code: string;
  zone_name: string;
  batch_number: string;
  quantity_on_hand: number;
  quantity_available: number;
  stock_status: string;
  uom: string;
}

function isSelectableStatus(status: string) {
  return status !== 'quarantine' && status !== 'reject';
}

function stockStatusBadge(status: string) {
  if (status === 'quarantine') return { label: 'Q - Quarantine', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
  if (status === 'reject') return { label: 'R - Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
  return { label: 'Release', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' };
}

export default function BatchClose() {
  const { id: batchId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<any>(null);
  const [bomItems, setBomItems] = useState<BomTreeItem[]>([]);
  const [actualValues, setActualValues] = useState<Record<number, string>>({});
  const [expandingTree, setExpandingTree] = useState(false);
  const [savingBom, setSavingBom] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cancelingConfirmation, setCancelingConfirmation] = useState(false);
  const [showCancelConfirmationModal, setShowCancelConfirmationModal] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);
  const [inventoryModalItem, setInventoryModalItem] = useState<BomTreeItem | null>(null);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchBom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const fetchBom = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/production/batches/${batchId}/bom`);
      setBatch(res.data);
      const items: BomTreeItem[] = res.data.bom_items || [];
      setBomItems(items);
      const initial: Record<number, string> = {};
      const initialBatch: Record<number, string> = {};
      items.forEach((i) => {
        if (i.quantity_actual != null) {
          initial[i.id] = String(i.quantity_actual);
        } else if (i.suggested_actual != null) {
          initial[i.id] = String(i.suggested_actual);
        } else {
          initial[i.id] = '';
        }
        if (i.actual_batch_number) {
          initialBatch[i.id] = i.actual_batch_number;
        }
      });
      setActualValues(initial);
      setSelectedBatch(initialBatch);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data batch');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandTree = async () => {
    if (!batch) return;
    setExpandingTree(true);
    try {
      await axiosInstance.post(`/api/production/work-orders/${batch.work_order_id}/batches/${batchId}/bom/expand-tree`);
      toast.success('Rincian bahan bertingkat berhasil dibuat');
      await fetchBom();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal membuat rincian BOM');
    } finally {
      setExpandingTree(false);
    }
  };

  const handleSaveBomActual = async () => {
    if (!batch) return;
    setSavingBom(true);
    try {
      const items = bomItems
        .filter((i) => actualValues[i.id] !== '' && actualValues[i.id] !== undefined)
        .map((i) => ({
          item_id: i.id,
          quantity_actual: Number(actualValues[i.id]),
          batch_number: selectedBatch[i.id] || undefined,
        }));
      await axiosInstance.put(`/api/production/work-orders/${batch.work_order_id}/bom/actual`, { items });
      toast.success('Pemakaian bahan aktual tersimpan');
      await fetchBom();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal menyimpan bahan aktual');
    } finally {
      setSavingBom(false);
    }
  };

  const handleViewInventory = async (item: BomTreeItem) => {
    setInventoryModalItem(item);
    setLoadingInventory(true);
    setInventoryRows([]);
    try {
      const params = item.material_id ? { material_id: item.material_id } : { product_id: item.product_id };
      const res = await axiosInstance.get('/api/warehouse/inventory', { params: { ...params, per_page: 200 } });
      setInventoryRows(res.data?.inventory || res.data?.items || []);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data stok');
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleSelectBatch = (row: InventoryRow) => {
    if (!inventoryModalItem) return;
    setSelectedBatch({ ...selectedBatch, [inventoryModalItem.id]: row.batch_number });
    setActualValues({ ...actualValues, [inventoryModalItem.id]: String(row.quantity_available) });
    setInventoryModalItem(null);
  };

  const handleCloseBatch = async () => {
    setClosing(true);
    setMissingRequirements([]);
    try {
      await axiosInstance.put(`/api/production/batches/${batchId}/close`, {});
      toast.success('Batch berhasil ditutup');
      navigate(-1);
    } catch (error: any) {
      const missing = error?.response?.data?.missing;
      if (missing) {
        setMissingRequirements(missing);
        toast.error('Syarat penutupan batch belum lengkap');
      } else {
        toast.error(error?.response?.data?.error || 'Gagal menutup batch');
      }
    } finally {
      setClosing(false);
    }
  };

  const handleCancelConfirmation = async () => {
    setCancelingConfirmation(true);
    try {
      const res = await axiosInstance.put(`/api/production/batches/${batchId}/cancel-confirmation`, {});
      toast.success(res.data.message || 'Konfirmasi batch dibatalkan');
      setShowCancelConfirmationModal(false);
      await fetchBom();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal membatalkan konfirmasi batch');
    } finally {
      setCancelingConfirmation(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Memuat...</div>;
  }

  if (!batch) {
    return <div className="text-center py-12 text-red-500">Batch tidak ditemukan</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/app/production/work-orders/${batch.work_order_id}/close`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tutup Batch — {batch.batch_number}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Target batch ini: {batch.planned_qty} · {batch.admin_closed ? 'Sudah ditutup' : 'Belum ditutup'}
          </p>
        </div>
      </div>

      {missingRequirements.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Syarat penutupan batch belum lengkap
          </div>
          <ul className="list-disc pl-6 text-sm text-red-600 dark:text-red-400">
            {missingRequirements.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Pemakaian Bahan Aktual (Barang Jadi → WIP → Mixing)</h2>
          {!batch.admin_closed && (
            <button className="btn-secondary text-sm" disabled={expandingTree} onClick={handleExpandTree}>
              {expandingTree ? 'Memuat...' : bomItems.length > 0 ? 'Muat Ulang dari BOM' : 'Muat Rincian BOM'}
            </button>
          )}
        </div>
        {bomItems.length === 0 ? (
          <div className="text-sm text-gray-400">
            Belum ada rincian bahan untuk batch ini — klik "Muat Rincian BOM" untuk mengambil struktur bahan bertingkat dari BOM produk, diskalakan ke target batch ini ({batch.planned_qty}).
          </div>
        ) : (
          <>
            <WorkOrderBomActualTree
              items={bomItems}
              actualValues={actualValues}
              onChangeActual={(itemId, value) => setActualValues({ ...actualValues, [itemId]: value })}
              onViewInventory={handleViewInventory}
            />
            {!batch.admin_closed && (
              <button className="btn-primary mt-4" disabled={savingBom} onClick={handleSaveBomActual}>
                {savingBom ? 'Menyimpan...' : 'Simpan Pemakaian Aktual'}
              </button>
            )}
          </>
        )}
      </div>

      {!batch.admin_closed && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 flex items-center gap-3">
          <button
            className="btn-primary inline-flex items-center gap-2"
            disabled={closing}
            onClick={handleCloseBatch}
          >
            <CheckCircleIcon className="h-5 w-5" />
            {closing ? 'Menutup...' : 'Tutup Batch'}
          </button>
          {bomItems.some((i) => i.quantity_actual != null || i.actual_batch_number) && (
            <button
              className="btn-secondary inline-flex items-center gap-2 text-orange-700 dark:text-orange-400"
              onClick={() => setShowCancelConfirmationModal(true)}
            >
              <ArrowUturnLeftIcon className="h-5 w-5" />
              Batalkan Konfirmasi
            </button>
          )}
        </div>
      )}

      {inventoryModalItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {inventoryModalItem.item_code} - {inventoryModalItem.item_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stok di semua lokasi</p>
              </div>
              <button
                onClick={() => setInventoryModalItem(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
              >
                &times;
              </button>
            </div>

            {loadingInventory ? (
              <div className="text-gray-500 text-sm py-8 text-center">Memuat...</div>
            ) : inventoryRows.length === 0 ? (
              <div className="text-gray-500 text-sm py-8 text-center">Belum ada stok untuk item ini.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Lokasi</th>
                    <th className="py-2 pr-3">No. Batch</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Tersedia</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map((row) => {
                    const badge = stockStatusBadge(row.stock_status);
                    const selectable = isSelectableStatus(row.stock_status);
                    return (
                      <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-3">{row.location_code}{row.zone_name && row.zone_name !== 'N/A' ? ` (${row.zone_name})` : ''}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{row.batch_number || '-'}</td>
                        <td className="py-2 pr-3 text-right">{row.quantity_on_hand.toLocaleString()} {row.uom}</td>
                        <td className="py-2 pr-3 text-right">{row.quantity_available.toLocaleString()} {row.uom}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2">
                          {selectable ? (
                            <button
                              type="button"
                              onClick={() => handleSelectBatch(row)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              Pilih
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs" title="Tidak bisa dipilih - hubungi QC untuk release dulu">
                              Tidak bisa dipilih
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showCancelConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <ArrowUturnLeftIcon className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Batalkan Konfirmasi</h3>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Batalkan konfirmasi Bahan Aktual untuk batch <strong>{batch.batch_number}</strong>? Semua pemakaian bahan aktual yang sudah diisi akan dikosongkan, bahan yang sudah dikeluarkan gudang akan dikembalikan ke stok, dan batch ini bisa dikonfirmasi ulang dari awal.
              </p>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  Aksi ini tidak menghapus SPK - hanya membatalkan konfirmasi batch ini. SPK/batch akan kembali ke status sebelum dikonfirmasi.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCancelConfirmationModal(false)}
                  disabled={cancelingConfirmation}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleCancelConfirmation}
                  disabled={cancelingConfirmation}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                >
                  {cancelingConfirmation ? 'Membatalkan...' : 'Ya, Batalkan Konfirmasi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
