import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

interface SalesInvoiceItem {
  id: number;
  description: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface SalesInvoiceDetailData {
  id: number;
  invoice_number: string;
  invoice_type: string;
  invoice_date: string | null;
  due_date: string | null;
  customer_id: number | null;
  work_order_number: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  notes: string | null;
  items: SalesInvoiceItem[];
}

/**
 * Read-only detail page for a single Sales Invoice - previously missing
 * (AccountingManagement.tsx's getReferenceLink() redirected reference_type
 * 'sales_invoice' straight to the edit form). Mirrors ReimbursementDetail.tsx's
 * pattern. Uses the shared /api/finance/invoices/<id> endpoint (Invoice model
 * is unified across Sales+Purchasing).
 */
const SalesInvoiceDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SalesInvoiceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosInstance
      .get(`/api/finance/invoices/${id}`)
      .then((res) => {
        setData(res.data.invoice);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat detail invoice.');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Invoice tidak ditemukan.'}</p>
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
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{data.work_order_number ? `WO: ${data.work_order_number}` : '\u00A0'}</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Status</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">{data.status}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Tipe</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">{data.invoice_type}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Tanggal Invoice</div>
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
              Rp{data.total_amount.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Sisa Tagihan</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.balance_due.toLocaleString('id-ID')}
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

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Item Invoice</h2>
      {data.items.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada item.</p>
      ) : (
        <table className="w-full text-sm bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-3">Deskripsi</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Harga Satuan</th>
              <th className="p-3 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3">{item.description || '-'}</td>
                <td className="p-3 text-right">{item.quantity.toLocaleString('id-ID')}</td>
                <td className="p-3 text-right">{item.unit_price.toLocaleString('id-ID')}</td>
                <td className="p-3 text-right">{item.amount.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SalesInvoiceDetail;
