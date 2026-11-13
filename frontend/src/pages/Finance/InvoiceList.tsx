import React from 'react'
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGetInvoicesQuery } from '../../services/api'
import { useUrlState } from '../../hooks/useUrlState'
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'
import { format } from 'date-fns'
import {
  LinkIcon
,
  PlusIcon
} from '@heroicons/react/24/outline';
const formatDateSafe = (value: string | null | undefined) => {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '-' : format(d, 'dd MMM yyyy')
}

const TYPE_LABEL: Record<string, string> = { sales: 'Penjualan', purchase: 'Pembelian' }
const STATUS_LABEL_X: Record<string, string> = { draft: 'Draft', sent: 'Terkirim', partial: 'Dibayar sebagian', paid: 'Lunas', overdue: 'Jatuh tempo', cancelled: 'Batal' }
const COLUMNS: ListColumn<any>[] = [
  { key: 'invoice_number', label: 'No. Faktur', value: (i) => i.invoice_number },
  { key: 'invoice_type', label: 'Jenis', value: (i) => i.invoice_type, exportValue: (i) => TYPE_LABEL[i.invoice_type] || i.invoice_type },
  { key: 'party', label: 'Pelanggan / Pemasok', value: (i) => i.customer_name || i.supplier_name },
  { key: 'invoice_date', label: 'Tanggal', value: (i) => i.invoice_date, type: 'date' },
  { key: 'due_date', label: 'Jatuh Tempo', value: (i) => i.due_date, type: 'date' },
  { key: 'total_amount', label: 'Total', value: (i) => i.total_amount, type: 'number' },
  { key: 'paid_amount', label: 'Dibayar', value: (i) => i.paid_amount, type: 'number' },
  { key: 'balance_due', label: 'Sisa', value: (i) => i.balance_due, type: 'number' },
  { key: 'status', label: 'Status', value: (i) => i.status, exportValue: (i) => STATUS_LABEL_X[i.status] || i.status },
]

export default function InvoiceList() {
    const { t } = useLanguage();

const [scope] = useUrlState<'all' | 'sales' | 'purchase'>('scope', 'all', ['all', 'sales', 'purchase'])
  const [filterType, setType] = useUrlState<'all' | 'sales' | 'purchase'>('type', 'all', ['all', 'sales', 'purchase'])
  const type = scope !== 'all' ? scope : filterType
  const { data, isLoading } = useGetInvoicesQuery(type === 'all' ? { per_page: 1000 } : { type, per_page: 1000 })
  const title = type === 'sales' ? 'Faktur Penjualan' : type === 'purchase' ? 'Faktur Pembelian' : 'Faktur Penjualan & Pembelian'
  useBreadcrumbTrail([])
  const tools = useListTools<any>(data?.invoices, COLUMNS, { filename: type === 'sales' ? 'Faktur_Penjualan' : type === 'purchase' ? 'Faktur_Pembelian' : 'Faktur', initialSort: { key: 'invoice_date', dir: 'desc' } })
  const STATUS_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Terkirim', partial: 'Dibayar sebagian', paid: 'Lunas', overdue: 'Jatuh tempo', cancelled: 'Batal' }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'badge-warning',
      sent: 'badge-info',
      partial: 'badge-warning',
      paid: 'badge-success',
      overdue: 'badge-danger',
      cancelled: 'badge-danger'
    }
    return badges[status] || 'badge-info'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {type !== 'purchase' && (
          <Link to="/app/finance/invoices/new" className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Buat Faktur Penjualan
          </Link>
        )}
      </div>

      {scope === 'all' && (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
          {([['all', 'Semua'], ['sales', 'Penjualan'], ['purchase', 'Pembelian']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setType(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${type === k ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}>{label}</button>
          ))}
        </div>
      )}

      <ListToolbar tools={tools} placeholder="Cari nomor faktur, pelanggan, atau pemasok" />

      {isLoading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh tools={tools} col="invoice_number">No. Faktur</SortTh>
                  <SortTh tools={tools} col="invoice_type">Jenis</SortTh>
                  <SortTh tools={tools} col="party">Pelanggan / Pemasok</SortTh>
                  <SortTh tools={tools} col="invoice_date">Tanggal</SortTh>
                  <SortTh tools={tools} col="due_date">Jatuh Tempo</SortTh>
                  <SortTh tools={tools} col="total_amount">Total</SortTh>
                  <SortTh tools={tools} col="paid_amount">Dibayar</SortTh>
                  <SortTh tools={tools} col="balance_due">Sisa</SortTh>
                  <SortTh tools={tools} col="status">Status</SortTh>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((invoice: any) => (
                  <tr key={invoice.id}>
                    <td className="font-medium">
                      <Link to={invoice.invoice_type === 'sales' ? `/app/sales/invoices/${invoice.id}` : `/app/purchasing/invoices/${invoice.id}`} className="text-primary-700 hover:underline dark:text-primary-300">{invoice.invoice_number}</Link>
                    </td>
                    <td>
                      <span className={`badge ${invoice.invoice_type === 'sales' ? 'badge-success' : 'badge-info'}`}>
                        {invoice.invoice_type === 'sales' ? 'Penjualan' : invoice.invoice_type === 'purchase' ? 'Pembelian' : invoice.invoice_type}
                      </span>
                    </td>
                    <td>{invoice.customer_name || invoice.supplier_name || '-'}</td>
                    <td>{formatDateSafe(invoice.invoice_date)}</td>
                    <td>{formatDateSafe(invoice.due_date)}</td>
                    <td className="font-medium">Rp {invoice.total_amount?.toLocaleString() || '0'}</td>
                    <td className="text-green-600 dark:text-green-400">Rp {invoice.paid_amount?.toLocaleString() || '0'}</td>
                    <td className="text-red-600 dark:text-red-400">Rp {invoice.balance_due?.toLocaleString() || '0'}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(invoice.status)}`}>
                        {STATUS_LABEL[invoice.status] || invoice.status}
                      </span>
                    </td>
                    <td>
                      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                        <Link
                          to={`/app/finance/payments/new?invoice_id=${invoice.id}`}
                          className="text-primary-600 hover:text-primary-800 text-sm whitespace-nowrap dark:text-primary-400"
                        >
                          Catat Pembayaran
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tools.rows.length === 0 && (
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada faktur' : 'Tidak ada faktur yang cocok'}</h3>
          {type !== 'purchase' && (
            <div className="mt-6">
              <Link to="/app/finance/invoices/new" className="btn-primary">
                <PlusIcon className="h-5 w-5 mr-2" />
                Buat Faktur Penjualan
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
