import React, { useEffect, useState } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';

interface ConfirmWarning {
  product_name: string;
  shortage: number;
}
interface ConfirmResult {
  message: string;
  created: { product_id: number; wo_number: string }[];
  failed_items: { product_name: string; reason: string }[];
  warnings?: ConfirmWarning[];
}

interface CapacityPreviewItem {
  product_id: number;
  product_name: string | null;
  machine_id: number | null;
  machine_name: string | null;
  existing_wo_count: number;
  existing_wo_qty: number;
}

interface Props {
  orderId: number | string;
  orderNumber: string;
  itemCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

// Diekstrak dari SalesOrderDetails.tsx (2026-08-24, Rombak SO List) supaya bisa dipanggil
// dari 2 tempat tanpa duplikasi logic: row action di SalesOrderListUpgraded.tsx (approve
// langsung dari List, tanpa buka detail dulu) dan action bar di SalesOrderDetails.tsx.
// 1 aksi atomik: POST /confirm-and-start-production - confirm + trigger produksi sekaligus.
const ConfirmAndStartProductionModal: React.FC<Props> = ({ orderId, orderNumber, itemCount, onClose, onSuccess }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [capacityPreview, setCapacityPreview] = useState<CapacityPreviewItem[] | null>(null);

  // Sinyal proaktif: cek beban mesin default tiap produk SEBELUM user klik konfirmasi,
  // supaya kelihatan kalau mesin itu sudah punya WO lain (dari Forecast atau SO lain)
  // minggu yang sama - bukan blocking, cuma info buat keputusan.
  useEffect(() => {
    axiosInstance
      .get(`/api/sales/orders/${orderId}/production-capacity-preview`)
      .then((res) => setCapacityPreview(res.data.items || []))
      .catch(() => setCapacityPreview(null));
  }, [orderId]);

  const loadedItems = (capacityPreview || []).filter((i) => i.existing_wo_count > 0);

  const handleConfirm = async () => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const res = await axiosInstance.post(`/api/sales/orders/${orderId}/confirm-and-start-production`);
      setConfirmResult(res.data);
      toast.success('Sales Order dikonfirmasi, produksi dimulai!');
      onSuccess();
    } catch (err: any) {
      setConfirmError(err.response?.data?.error || 'Gagal konfirmasi & mulai produksi');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
        {!confirmResult ? (
          <>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirm & Mulai Produksi
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Sales Order <strong>{orderNumber}</strong> ({itemCount} item) akan
              langsung dikonfirmasi dan SPK-nya dibuat sekaligus — tidak perlu langkah terpisah lagi.
            </p>
            {confirmError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                {confirmError}
              </div>
            )}
            {loadedItems.length > 0 && (
              <div className="mb-4 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 rounded">
                <p className="font-medium mb-1">Mesin sudah ada jadwal lain minggu ini:</p>
                <ul className="list-disc list-inside">
                  {loadedItems.map((it) => (
                    <li key={it.product_id}>
                      {it.product_name} → {it.machine_name}: {it.existing_wo_count} WO lain
                      ({it.existing_wo_qty.toLocaleString('id-ID')} unit)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={onClose} disabled={isConfirming}>
                Batal
              </button>
              <button className="btn-primary" onClick={handleConfirm} disabled={isConfirming}>
                {isConfirming ? 'Memproses...' : 'Ya, Konfirmasi'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {confirmResult.message}
            </h3>
            {confirmResult.created?.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                SPK dibuat: {confirmResult.created.map((c) => c.wo_number).join(', ')}
              </p>
            )}
            {confirmResult.failed_items?.length > 0 && (
              <div className="mb-3 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 rounded">
                <p className="font-medium mb-1">Item yang tidak masuk Planning Produksi:</p>
                <ul className="list-disc list-inside">
                  {confirmResult.failed_items.map((f, i) => (
                    <li key={i}>{f.product_name} — {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {confirmResult.warnings && confirmResult.warnings.length > 0 && (
              <div className="mb-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                <p className="font-medium mb-1">Peringatan stok:</p>
                <ul className="list-disc list-inside">
                  {confirmResult.warnings.map((w, i) => (
                    <li key={i}>{w.product_name} — kurang {w.shortage}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={onClose}>Tutup</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfirmAndStartProductionModal;
