import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const typeLabels: Record<string, string> = {
  production_output: 'Output Produksi',
  material_issue: 'Pengeluaran Material',
  goods_receipt: 'Penerimaan Barang',
  sales_delivery: 'Pengiriman',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
  fg_conversion: 'Konversi FG',
  wip_in: 'WIP Masuk',
  wip_out: 'WIP Keluar',
  scrap: 'Scrap',
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  receipt: 'Penerimaan',
  issue: 'Pengeluaran',
  other: 'Lainnya',
};

const TransactionDetail: React.FC = () => {
  const { txnId } = useParams<{ txnId: string }>();
  const navigate = useNavigate();
  const [txn, setTxn] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (txnId) fetchDetail();
  }, [txnId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/wms/transactions/${txnId}`);
      setTxn(res.data.transaction);
    } catch (err: any) {
      toast.error('Gagal memuat detail transaksi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!txn) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Transaksi tidak ditemukan</p>
        <button onClick={() => navigate('/app/wms/transactions')} className="mt-3 text-blue-600 hover:underline">
          Kembali
        </button>
      </div>
    );
  }

  const InfoRow = ({ label, value, className = '' }: { label: string; value: any; className?: string }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${className}`}>{value || '-'}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/wms/transactions')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="h-7 w-7 text-purple-600" />
            Detail Transaksi
          </h1>
          <p className="text-gray-500 font-mono">{txn.transaction_number}</p>
        </div>
        {txn.direction === 'in' ? (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
            <ArrowDownIcon className="h-4 w-4" /> MASUK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
            <ArrowUpIcon className="h-4 w-4" /> KELUAR
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informasi Transaksi */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Informasi Transaksi</h2>
          <InfoRow label="No. Transaksi" value={txn.transaction_number} />
          <InfoRow label="Tipe" value={typeLabels[txn.transaction_type] || txn.transaction_type} />
          <InfoRow label="Arah" value={txn.direction === 'in' ? 'Masuk (IN)' : 'Keluar (OUT)'} />
          <InfoRow label="Status" value={
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              txn.status === 'completed' ? 'bg-green-100 text-green-700' :
              txn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>{txn.status}</span>
          } />
          <InfoRow label="Tanggal" value={txn.transaction_date ? new Date(txn.transaction_date).toLocaleString('id-ID') : '-'} />
          <InfoRow label="Dibuat oleh" value={txn.created_by} />
          <InfoRow label="Dibuat pada" value={txn.created_at ? new Date(txn.created_at).toLocaleString('id-ID') : '-'} />
        </div>

        {/* Item & Quantity */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Item & Kuantitas</h2>
          <InfoRow label="Tipe Item" value={txn.item_type === 'product' ? 'Produk' : txn.item_type === 'material' ? 'Material' : txn.item_type || '-'} />
          <InfoRow label="Nama Item" value={txn.item_name} />
          <InfoRow label="Kode Item" value={txn.item_code} />
          <InfoRow label="Kuantitas" value={
            <span className="text-lg font-bold">{txn.quantity?.toLocaleString()} {txn.uom || ''}</span>
          } />
          <InfoRow label="Batch Number" value={txn.batch_number} />
          <InfoRow label="Lot Number" value={txn.lot_number} />
        </div>

        {/* Lokasi */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Lokasi</h2>
          <InfoRow label="Dari Lokasi" value={txn.from_location} />
          <InfoRow label="Ke Lokasi" value={txn.to_location} />
        </div>

        {/* Referensi */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Referensi</h2>
          <InfoRow label="Tipe Referensi" value={txn.reference_type} />
          <InfoRow label="No. Referensi" value={txn.reference_number} />
          {txn.wo_number && (
            <InfoRow label="Work Order" value={
              <button
                onClick={() => navigate(`/app/wms/stock-by-wo/${txn.work_order_id}`)}
                className="text-blue-600 hover:underline"
              >
                {txn.wo_number}
              </button>
            } />
          )}
          <InfoRow label="Mesin" value={txn.machine_name} />
          <InfoRow label="Shift" value={txn.shift} />
        </div>

        {/* Cost */}
        {(txn.unit_cost || txn.total_cost) && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Biaya</h2>
            <InfoRow label="Harga Satuan" value={txn.unit_cost ? `Rp ${txn.unit_cost.toLocaleString()}` : '-'} />
            <InfoRow label="Total Biaya" value={txn.total_cost ? `Rp ${txn.total_cost.toLocaleString()}` : '-'} />
          </div>
        )}

        {/* Balance */}
        {(txn.balance_before !== null || txn.balance_after !== null) && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Saldo Stok</h2>
            <InfoRow label="Sebelum" value={txn.balance_before?.toLocaleString()} />
            <InfoRow label="Sesudah" value={txn.balance_after?.toLocaleString()} />
            <InfoRow label="Perubahan" value={
              <span className={txn.direction === 'in' ? 'text-green-600' : 'text-red-600'}>
                {txn.direction === 'in' ? '+' : '-'}{txn.quantity?.toLocaleString()}
              </span>
            } />
          </div>
        )}
      </div>

      {/* Notes */}
      {txn.notes && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Catatan</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{txn.notes}</p>
        </div>
      )}
    </div>
  );
};

export default TransactionDetail;
