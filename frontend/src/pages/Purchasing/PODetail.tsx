import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import AccessibleModal from '../../components/ui/AccessibleModal';
import {
  ArrowLeftIcon, PencilSquareIcon, ArrowPathIcon, CubeIcon,
  BuildingStorefrontIcon, TruckIcon,
} from '@heroicons/react/24/outline';
import { formatRupiah } from '../../utils/currencyUtils';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  sent:      { label: 'Terkirim',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-green-100 text-green-700' },
  partial:   { label: 'Diterima Sebagian', color: 'bg-amber-100 text-amber-700' },
  received:  { label: 'Diterima',   color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
};

export default function PODetail() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [materialModal, setMaterialModal] = useState<{ open: boolean; loading: boolean; data: any; itemName: string }>({
    open: false, loading: false, data: null, itemName: '',
  });
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; loading: boolean; data: any }>({
    open: false, loading: false, data: null,
  });

  useEffect(() => {
    setLoading(true);
    axiosInstance.get(`/api/purchasing/purchase-orders/${id}`)
      .then(r => setPo(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  const openMaterialDrillDown = async (item: any) => {
    if (!item.material_id) return;
    setMaterialModal({ open: true, loading: true, data: null, itemName: item.material_name || item.description });
    try {
      const res = await axiosInstance.get(`/api/material-stock/materials/${item.material_id}/inventory`);
      setMaterialModal({ open: true, loading: false, data: res.data, itemName: item.material_name || item.description });
    } catch {
      setMaterialModal({ open: true, loading: false, data: null, itemName: item.material_name || item.description });
    }
  };

  const openSupplierDrillDown = async () => {
    if (!po?.supplier_id) return;
    setSupplierModal({ open: true, loading: true, data: null });
    try {
      const res = await axiosInstance.get(`/api/purchasing/suppliers/${po.supplier_id}`);
      setSupplierModal({ open: true, loading: false, data: res.data });
    } catch {
      setSupplierModal({ open: true, loading: false, data: null });
    }
  };

  const statusCfg = po ? (STATUS_CONFIG[po.status] || { label: po.status, color: 'bg-gray-100 text-gray-700' }) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (!po) {
    return <div className="p-6 text-center text-gray-500">Purchase Order tidak ditemukan.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/purchasing/purchase-orders" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{po.po_number}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg?.color}`}>{statusCfg?.label}</span>
              {po.has_grn && (
                <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                  <TruckIcon className="h-3.5 w-3.5" /> Sudah ada penerimaan barang
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          to={`/app/purchasing/purchase-orders/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-[#059669] text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <PencilSquareIcon className="h-4 w-4" /> Edit
        </Link>
      </div>

      {/* Informasi Umum */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Informasi Umum</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Supplier</p>
            <button
              onClick={openSupplierDrillDown}
              className="text-[#059669] hover:underline flex items-center gap-1 font-medium"
            >
              <BuildingStorefrontIcon className="h-4 w-4" /> {po.supplier.company_name}
            </button>
          </div>
          <InfoRow label="Tanggal Order" value={po.order_date} />
          <InfoRow label="Tanggal Dibutuhkan" value={po.required_date || '-'} />
          <InfoRow label="Termin Pembayaran" value={po.payment_terms || '-'} />
          <InfoRow label="Metode Pembayaran" value={po.payment_method || '-'} />
          <InfoRow label="Metode Pengiriman" value={po.shipping_method || '-'} />
        </div>
        {po.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Catatan</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{po.notes}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Daftar Item</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-3">Item</th>
                <th className="pb-2 pr-3 text-right">Qty</th>
                <th className="pb-2 pr-3">Satuan</th>
                <th className="pb-2 pr-3 text-right">Harga Satuan</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {po.items.map((item: any) => {
                const name = item.material_name || item.product_name || item.description || '(tanpa nama)';
                const code = item.material_code || item.product_code;
                return (
                  <tr
                    key={item.id}
                    onClick={() => openMaterialDrillDown(item)}
                    className={item.material_id ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/10' : ''}
                    title={item.material_id ? 'Klik untuk lihat stok bahan ini' : undefined}
                  >
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                      <span className="flex items-center gap-1.5">
                        {item.material_id && <CubeIcon className="h-3.5 w-3.5 text-[#059669] flex-shrink-0" />}
                        {name}
                      </span>
                      {code && <p className="text-xs text-gray-400 dark:text-gray-500 ml-5">{code}</p>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{item.quantity.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{item.uom}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(item.unit_price)}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{formatRupiah(item.total_price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
          <div className="space-y-1 text-right">
            <p className="text-gray-500 dark:text-gray-400">Subtotal: {formatRupiah(po.subtotal)}</p>
            {po.tax_amount > 0 && <p className="text-gray-500 dark:text-gray-400">Pajak: {formatRupiah(po.tax_amount)}</p>}
            {po.discount_amount > 0 && <p className="text-gray-500 dark:text-gray-400">Diskon: -{formatRupiah(po.discount_amount)}</p>}
            {po.shipping_cost > 0 && <p className="text-gray-500 dark:text-gray-400">Ongkir: {formatRupiah(po.shipping_cost)}</p>}
            <p className="text-base font-bold text-gray-900 dark:text-white">Total: {formatRupiah(po.total_amount)}</p>
          </div>
        </div>
      </div>

      {/* Drill-down modal: material stock */}
      <AccessibleModal
        isOpen={materialModal.open}
        onClose={() => setMaterialModal(m => ({ ...m, open: false }))}
        title={`Stok - ${materialModal.itemName}`}
        description="Data stok real per lokasi/batch gudang untuk bahan ini"
        size="lg"
      >
        {materialModal.loading ? (
          <div className="flex justify-center py-8 text-gray-400"><ArrowPathIcon className="h-5 w-5 animate-spin" /></div>
        ) : !materialModal.data ? (
          <p className="text-sm text-gray-500 text-center py-6">Gagal memuat data stok.</p>
        ) : materialModal.data.locations?.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Belum ada stok untuk bahan ini di gudang.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-3">Lokasi</th>
                <th className="pb-2 pr-3">No. Batch</th>
                <th className="pb-2 pr-3 text-right">Qty Tersedia</th>
                <th className="pb-2 text-right">Qty Reserved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {materialModal.data.locations.map((loc: any) => (
                <tr key={loc.inventory_id}>
                  <td className="py-2 pr-3">{loc.location_code || '-'}</td>
                  <td className="py-2 pr-3 text-gray-500">{loc.batch_number || '-'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{loc.quantity_available.toLocaleString('id-ID')}</td>
                  <td className="py-2 text-right tabular-nums">{loc.quantity_reserved.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AccessibleModal>

      {/* Drill-down modal: supplier detail */}
      <AccessibleModal
        isOpen={supplierModal.open}
        onClose={() => setSupplierModal(m => ({ ...m, open: false }))}
        title="Detail Supplier"
        size="md"
      >
        {supplierModal.loading ? (
          <div className="flex justify-center py-8 text-gray-400"><ArrowPathIcon className="h-5 w-5 animate-spin" /></div>
        ) : !supplierModal.data ? (
          <p className="text-sm text-gray-500 text-center py-6">Gagal memuat data supplier.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <InfoRow label="Nama" value={supplierModal.data.company_name} />
            <InfoRow label="Kode" value={supplierModal.data.code || '-'} />
            <InfoRow label="Kontak" value={supplierModal.data.contact_person || '-'} />
            <InfoRow label="Telepon" value={supplierModal.data.phone || '-'} />
            <InfoRow label="Email" value={supplierModal.data.email || '-'} />
            <InfoRow label="Alamat" value={supplierModal.data.address || '-'} />
          </div>
        )}
      </AccessibleModal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
