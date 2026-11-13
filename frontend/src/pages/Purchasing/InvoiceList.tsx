import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { ArrowPathIcon, DocumentCurrencyDollarIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
import toast from 'react-hot-toast';
import NumberInput from '../../components/ui/NumberInput'

import { TableSkeleton } from '../../components/ui/Skeleton'
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  sent:      { label: 'Posted',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  partial:   { label: 'Sebagian',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  paid:      { label: 'Lunas',      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  overdue:   { label: 'Lewat Tempo', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Batal',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const PAY_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid:  { label: 'Belum Bayar', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  partial: { label: 'Sebagian',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  paid:    { label: 'Lunas',       color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  overdue: { label: 'Lewat Tempo', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const COLUMNS: ListColumn<any>[] = [
  { key: 'invoice_number', label: 'No. Faktur', value: (i) => i.invoice_number },
  { key: 'supplier_invoice_number', label: 'No. Faktur Pemasok', value: (i) => i.supplier_invoice_number },
  { key: 'po_number', label: 'No. PO', value: (i) => i.po_number },
  { key: 'supplier_name', label: 'Pemasok', value: (i) => i.supplier_name },
  { key: 'invoice_date', label: 'Tgl Faktur', value: (i) => i.invoice_date, type: 'date' },
  { key: 'due_date', label: 'Jatuh Tempo', value: (i) => i.due_date, type: 'date' },
  { key: 'currency', label: 'Mata Uang', value: (i) => i.currency },
  { key: 'total_amount', label: 'Total', value: (i) => i.total_amount, type: 'number' },
  { key: 'total_amount_idr', label: 'Total (Rp)', value: (i) => i.total_amount_idr ?? i.total_amount, type: 'number' },
  { key: 'grn_count', label: 'Jumlah GRN', value: (i) => i.grn_count || 0, type: 'number' },
  { key: 'status', label: 'Status', value: (i) => i.status, exportValue: (i) => (STATUS_CONFIG[i.status]?.label || i.status) + (i.on_hold ? ' (On Hold)' : '') },
  { key: 'payment_status', label: 'Pembayaran', value: (i) => i.payment_status, exportValue: (i) => PAY_CONFIG[i.payment_status]?.label || i.payment_status },
];

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, per_page: 1000 };
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/purchasing/purchase-invoices/summary', { params });
      setInvoices(res.data.invoices || []);
    } catch {
      // fallback to regular invoice endpoint
      try {
        const res = await axiosInstance.get('/api/purchasing/purchase-invoices', {
          params: { page: 1, per_page: 1000, status: statusFilter || undefined },
        });
        setInvoices(res.data.purchase_invoices || res.data.invoices || []);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [statusFilter]);

  const tools = useListTools<any>(invoices, COLUMNS, { filename: 'Faktur_Pembelian', initialSort: { key: 'invoice_date', dir: 'desc' } });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faktur Pembelian</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Tagihan pemasok dan pencocokan tiga arah, {tools.total} total</p>
        </div>
        <Link to="/app/purchasing/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          Buat Faktur Pembelian
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor faktur, PO, atau pemasok" />

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} cols={10} />
        ) : tools.rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DocumentCurrencyDollarIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{tools.total === 0 ? 'Belum ada faktur pembelian' : 'Tidak ada faktur yang cocok'}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortTh tools={tools} col="invoice_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. Faktur</SortTh>
                <SortTh tools={tools} col="po_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. PO</SortTh>
                <SortTh tools={tools} col="supplier_name" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pemasok</SortTh>
                <SortTh tools={tools} col="invoice_date" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Faktur</SortTh>
                <SortTh tools={tools} col="due_date" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Jatuh Tempo</SortTh>
                <SortTh tools={tools} col="total_amount" align="right" className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</SortTh>
                <SortTh tools={tools} col="grn_count" align="center" className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">GRN</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</SortTh>
                <SortTh tools={tools} col="payment_status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pembayaran</SortTh>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tools.rows.map((inv) => {
                const status = STATUS_CONFIG[inv.status] || { label: inv.status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' };
                const pay = PAY_CONFIG[inv.payment_status] || { label: inv.payment_status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' };
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.payment_status !== 'paid';
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/invoices/${inv.id}/match`)}
                  >
                    <td className="px-4 py-3 font-medium text-primary-700 dark:text-primary-300">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{inv.po_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{inv.supplier_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('id-ID') : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '—'}
                      {isOverdue && <span className="ml-1 text-xs font-medium">(terlambat)</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                      Rp {Number(inv.total_amount).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${(inv.grn_count || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {inv.grn_count || 0} GRN
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                      {inv.on_hold && (
                        <span
                          title={inv.hold_reason || ''}
                          className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        >
                          Ditahan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${pay.color}`}>{pay.label}</span>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/app/purchasing/invoices/${inv.id}/match`}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Cocokkan 3 arah
                      </Link>
                      {inv.payment_status !== 'paid' && (
                        <button
                          onClick={() => navigate(`/app/finance/pembayaran-pembelian/new?invoice_id=${inv.id}`)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:underline dark:text-green-400"
                        >
                          <BanknotesIcon className="h-3.5 w-3.5" /> Bayar
                        </button>
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
  );
}
