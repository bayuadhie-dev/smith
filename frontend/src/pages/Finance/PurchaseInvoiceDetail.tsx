import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';

interface PurchaseInvoiceItem {
  id: number;
  product_name: string | null;
  material_name: string | null;
  description: string | null;
  quantity: number;
  uom: string | null;
  unit_price: number;
  total_price: number;
}

interface PurchaseInvoiceDetailData {
  id: number;
  invoice_number: string;
  po_number: string | null;
  supplier_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  supplier_invoice_number: string | null;
  status: string;
  payment_status: string;
  on_hold: boolean;
  hold_reason: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  items: PurchaseInvoiceItem[];
}

/**
 * Read-only detail page for a single Purchase Invoice - previously missing
 * (AccountingManagement.tsx's getReferenceLink() redirected reference_type
 * 'purchase_invoice' straight to Invoice Matching). Mirrors
 * ReimbursementDetail.tsx's pattern.
 */
const PurchaseInvoiceDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PurchaseInvoiceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  const load = () => {
    axiosInstance
      .get(`/api/purchasing/purchase-invoices/${id}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat detail faktur pembelian.');
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, [id]);

  const handleReleaseHold = async () => {
    setReleasing(true);
    try {
      await axiosInstance.post(`/api/purchasing/purchase-invoices/${id}/release-hold`);
      toast.success('Invoice dilepas dari hold, jurnal diposting');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal melepas hold');
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Faktur pembelian tidak ditemukan.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
          &larr; Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Kembali
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.invoice_number}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{data.supplier_name || '-'}</p>

      {data.on_hold && (
        <div className="mb-6 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4">
          <p className="font-semibold text-red-700 dark:text-red-400 mb-1">Invoice Ditahan (On Hold)</p>
          <p className="text-sm text-red-600 dark:text-red-300 mb-3">{data.hold_reason}</p>
          <p className="text-xs text-red-500 dark:text-red-400 mb-3">
            Jurnal akuntansi belum diposting sampai hold ini dilepas.
          </p>
          <button
            className="btn-primary text-sm"
            disabled={releasing}
            onClick={handleReleaseHold}
          >
            {releasing ? 'Memproses...' : 'Lepas Hold & Posting Jurnal'}
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Status</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">{data.status}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Status Pembayaran</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">{data.payment_status}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">No. PO</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.po_number || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">No. Faktur Supplier</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.supplier_invoice_number || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Tanggal Faktur</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.invoice_date ? new Date(data.invoice_date).toLocaleDateString('id-ID') : '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Jatuh Tempo</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.due_date ? new Date(data.due_date).toLocaleDateString('id-ID') : '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Total</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.currency} {data.total_amount.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Sisa Tagihan</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.currency} {data.balance_due.toLocaleString('id-ID')}
            </div>
          </div>
          {data.notes && (
            <div className="col-span-2">
              <div className="text-gray-500 dark:text-gray-400">Catatan</div>
              <div className="font-medium text-gray-900 dark:text-white">{data.notes}</div>
            </div>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Item Faktur</h2>
      {data.items.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada item.</p>
      ) : (
        <table className="w-full text-sm bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-3">Item</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Harga Satuan</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3">{item.product_name || item.material_name || item.description || '-'}</td>
                <td className="p-3 text-right">{item.quantity.toLocaleString('id-ID')} {item.uom || ''}</td>
                <td className="p-3 text-right">{item.unit_price.toLocaleString('id-ID')}</td>
                <td className="p-3 text-right">{item.total_price.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PurchaseInvoiceDetail;
