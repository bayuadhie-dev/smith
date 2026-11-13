import React from 'react'
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGetInvoicesQuery } from '../../services/api'
import { useUrlState } from '../../hooks/useUrlState'
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail'
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

export default function InvoiceList() {
    const { t } = useLanguage();

const [scope] = useUrlState<'all' | 'sales' | 'purchase'>('scope', 'all', ['all', 'sales', 'purchase'])
  const [filterType, setType] = useUrlState<'all' | 'sales' | 'purchase'>('type', 'all', ['all', 'sales', 'purchase'])
  const type = scope !== 'all' ? scope : filterType
  const { data, isLoading } = useGetInvoicesQuery(type === 'all' ? {} : { type })
  const title = type === 'sales' ? 'Faktur Penjualan' : type === 'purchase' ? 'Faktur Pembelian' : 'Faktur Penjualan & Pembelian'
  useBreadcrumbTrail([])
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

      {isLoading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Faktur</th>
                  <th>Jenis</th>
                  <th>Pelanggan / Pemasok</th>
                  <th>Tanggal</th>
                  <th>Jatuh Tempo</th>
                  <th>Total</th>
                  <th>Dibayar</th>
                  <th>Sisa</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data?.invoices?.map((invoice: any) => (
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
      {!isLoading && (!data?.invoices || data.invoices.length === 0) && (
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Belum ada faktur</h3>
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
