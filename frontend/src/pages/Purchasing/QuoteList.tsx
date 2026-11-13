import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetQuotesQuery } from '../../services/api'
import { format } from 'date-fns'
import { BanknotesIcon, EyeIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

const STATUS: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: 'Draft' },
  submitted: { cls: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300', label: 'Diajukan' },
  accepted: { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Diterima' },
  rejected: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Ditolak' },
  expired: { cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: 'Kedaluwarsa' },
}

const COLUMNS: ListColumn<any>[] = [
  { key: 'quote_number', label: 'No. Penawaran', value: (q) => q.quote_number },
  { key: 'rfq_number', label: 'No. RFQ', value: (q) => q.rfq_number },
  { key: 'supplier_name', label: 'Pemasok', value: (q) => q.supplier_name },
  { key: 'quote_date', label: 'Tgl Penawaran', value: (q) => q.quote_date, type: 'date' },
  { key: 'valid_until', label: 'Berlaku Sampai', value: (q) => q.valid_until, type: 'date' },
  { key: 'currency', label: 'Mata Uang', value: (q) => q.currency },
  { key: 'total_amount', label: 'Total', value: (q) => q.total_amount, type: 'number' },
  { key: 'lead_time_days', label: 'Lead Time (hari)', value: (q) => q.lead_time_days, type: 'number' },
  { key: 'status', label: 'Status', value: (q) => q.status, exportValue: (q) => STATUS[q.status]?.label || q.status },
]

const fmt = (v?: string | null) => (v ? format(new Date(v), 'dd MMM yyyy') : '-')

export default function QuoteList() {
  const [status, setStatus] = useState('')
  const { data, isLoading } = useGetQuotesQuery({ status, per_page: 1000 })
  const tools = useListTools<any>(data?.quotes, COLUMNS, { filename: 'Penawaran_Pemasok', initialSort: { key: 'quote_date', dir: 'desc' } })
  const th = 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
  const isExpired = (v?: string | null) => !!v && new Date(v) < new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Penawaran Pemasok</h1>
          <p className="text-gray-600 dark:text-gray-300">Kelola penawaran dan harga dari pemasok</p>
        </div>
        <Link to="/app/purchasing/quotes/new" className="btn-primary">
          <PlusIcon className="mr-1.5 h-5 w-5" />
          Buat Penawaran
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor penawaran, RFQ, atau pemasok" extra={(
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      )} />

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">Memuat penawaran...</div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <SortTh tools={tools} col="quote_number" className={th}>No. Penawaran</SortTh>
                  <SortTh tools={tools} col="supplier_name" className={th}>Pemasok</SortTh>
                  <SortTh tools={tools} col="quote_date" className={th}>Tgl Penawaran</SortTh>
                  <SortTh tools={tools} col="valid_until" className={th}>Berlaku Sampai</SortTh>
                  <SortTh tools={tools} col="total_amount" className={th}>Total</SortTh>
                  <SortTh tools={tools} col="status" className={th}>Status</SortTh>
                  <th className={`${th} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {tools.rows.map((quote: any) => {
                  const badge = STATUS[quote.status] || { cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: quote.status }
                  const expired = isExpired(quote.valid_until)
                  return (
                    <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{quote.quote_number}</div>
                        {quote.rfq_number && <div className="text-sm text-gray-500 dark:text-gray-400">RFQ: {quote.rfq_number}</div>}
                        {expired && <div className="mt-1 text-xs text-red-600 dark:text-red-400">Sudah lewat masa berlaku</div>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{quote.supplier_name}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{fmt(quote.quote_date)}</td>
                      <td className={`whitespace-nowrap px-6 py-4 text-sm ${expired ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{fmt(quote.valid_until)}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{quote.currency} {quote.total_amount?.toLocaleString('id-ID') || '0'}</div>
                        {quote.lead_time_days && <div className="text-sm text-gray-500 dark:text-gray-400">Lead time: {quote.lead_time_days} hari</div>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link to={`/app/purchasing/quotes/${quote.id}`} className="p-1 text-primary-700 hover:text-primary-900 dark:text-primary-300" title="Lihat detail" aria-label="Lihat detail">
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                          {quote.status === 'draft' && (
                            <Link to={`/app/purchasing/quotes/${quote.id}/edit`} className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-300" title="Ubah" aria-label="Ubah">
                              <PencilIcon className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && tools.rows.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada penawaran' : 'Tidak ada penawaran yang cocok'}</h3>
          {tools.total === 0 && (
            <div className="mt-6">
              <Link to="/app/purchasing/quotes/new" className="btn-primary">
                <PlusIcon className="mr-1.5 h-5 w-5" />
                Buat Penawaran
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
