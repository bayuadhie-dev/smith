import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import AccessibleModal from '../../components/ui/AccessibleModal';
import {
  ArrowLeftIcon, PencilSquareIcon, ArrowPathIcon, CubeIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { formatRupiah } from '../../utils/currencyUtils';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
  converted: { label: 'Jadi PO',    color: 'bg-purple-100 text-purple-700' },
};

export default function PRDetail() {
  const { id } = useParams<{ id: string }>();
  const [pr, setPr] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Drill-down modal: material stock detail
  const [materialModal, setMaterialModal] = useState<{ open: boolean; loading: boolean; data: any; itemName: string }>({
    open: false, loading: false, data: null, itemName: '',
  });

  useEffect(() => {
    setLoading(true);
    axiosInstance.get(`/api/purchasing/purchase-requisitions/${id}`)
      .then(r => setPr(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  const openMaterialDrillDown = async (item: any) => {
    if (!item.material_id) return; // drill-down only meaningful for real material master data
    setMaterialModal({ open: true, loading: true, data: null, itemName: item.item_name });
    try {
      const res = await axiosInstance.get(`/api/materials/${item.material_id}/inventory`);
      setMaterialModal({ open: true, loading: false, data: res.data, itemName: item.item_name });
    } catch {
      setMaterialModal({ open: true, loading: false, data: null, itemName: item.item_name });
    }
  };

  const statusCfg = pr ? (STATUS_CONFIG[pr.status] || { label: pr.status, color: 'bg-gray-100 text-gray-700' }) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (!pr) {
    return <div className="p-6 text-center text-gray-500">Purchase Requisition tidak ditemukan.</div>;
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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{pr.pr_number}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg?.color}`}>{statusCfg?.label}</span>
              {pr.converted_po_number && (
                <Link
                  to={`/app/purchasing/purchase-orders/${pr.converted_to_po_id}`}
                  className="text-xs text-purple-600 hover:underline flex items-center gap-0.5"
                >
                  &rarr; {pr.converted_po_number} <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
        {pr.status === 'draft' && (
          <Link
            to={`/app/purchasing/requisitions/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-[#059669] text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </Link>
        )}
      </div>

      {pr.status === 'rejected' && pr.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <strong>Alasan Penolakan:</strong> {pr.rejection_reason}
        </div>
      )}

      {/* Informasi Umum */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Informasi Umum</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoRow label="Diajukan oleh" value={pr.requester_name || '-'} />
          <InfoRow label="Departemen" value={pr.department || '-'} />
          <InfoRow label="Tanggal Pengajuan" value={pr.request_date || '-'} />
          <InfoRow label="Tanggal Dibutuhkan" value={pr.required_date || '-'} />
          <InfoRow label="Prioritas" value={pr.priority} />
          <InfoRow label="Tujuan/Keperluan" value={pr.purpose || '-'} />
          {pr.approver_name && (
            <>
              <InfoRow label="Disetujui oleh" value={pr.approver_name} />
              <InfoRow label="Tanggal Disetujui" value={pr.approved_at ? new Date(pr.approved_at).toLocaleString('id-ID') : '-'} />
            </>
          )}
        </div>
        {pr.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Catatan</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{pr.notes}</p>
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
                <th className="pb-2 pr-3">Nama Item</th>
                <th className="pb-2 pr-3">Kode</th>
                <th className="pb-2 pr-3 text-right">Qty</th>
                <th className="pb-2 pr-3">Satuan</th>
                <th className="pb-2 pr-3 text-right">Harga Est.</th>
                <th className="pb-2 pr-3">Supplier Pref.</th>
                <th className="pb-2 text-right">Total Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {pr.items.map((item: any) => (
                <tr
                  key={item.id}
                  onClick={() => openMaterialDrillDown(item)}
                  className={item.material_id ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/10' : ''}
                  title={item.material_id ? 'Klik untuk lihat stok bahan ini' : undefined}
                >
                  <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                    <span className="flex items-center gap-1.5">
                      {item.material_id && <CubeIcon className="h-3.5 w-3.5 text-[#059669] flex-shrink-0" />}
                      {item.item_name}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{item.item_code || '-'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{item.quantity.toLocaleString('id-ID')}</td>
                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{item.uom}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{item.estimated_unit_price ? formatRupiah(item.estimated_unit_price) : '-'}</td>
                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{item.preferred_supplier_name || '-'}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{item.estimated_total ? formatRupiah(item.estimated_total) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end pt-3 mt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            Total Estimasi: {formatRupiah(pr.total_estimated)}
          </p>
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
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-gray-900 dark:text-white capitalize">{value}</p>
    </div>
  );
}
