import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetRFQsQuery } from '../../services/api'
import { format } from 'date-fns'
import { DocumentTextIcon, EyeIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

const STATUS: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: 'Draft' },
  issued: { cls: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300', label: 'Diterbitkan' },
  closed: { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Ditutup' },
  cancelled: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Batal' },
}

const COLUMNS: ListColumn<any>[] = [
  { key: 'rfq_number', label: 'No. RFQ', value: (r) => r.rfq_number },
  { key: 'title', label: 'Judul', value: (r) => r.title },
  { key: 'description', label: 'Keterangan', value: (r) => r.description },
  { key: 'created_by', label: 'Dibuat oleh', value: (r) => r.created_by },
  { key: 'issue_date', label: 'Tgl Terbit', value: (r) => r.issue_date, type: 'date' },
  { key: 'closing_date', label: 'Tgl Tutup', value: (r) => r.closing_date, type: 'date' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS[r.status]?.label || r.status },
  { key: 'quotes_count', label: 'Jumlah Penawaran', value: (r) => r.quotes_count || 0, type: 'number' },
]

const fmt = (v?: string | null) => (v ? format(new Date(v), 'dd MMM yyyy') : '-')

export default function RFQList() {
  const [status, setStatus] = useState('')
  const { data, isLoading } = useGetRFQsQuery({ status, per_page: 1000 })
  const tools = useListTools<any>(data?.rfqs, COLUMNS, { filename: 'RFQ', initialSort: { key: 'issue_date', dir: 'desc' } })
  const th = 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permintaan Penawaran (RFQ)</h1>
          <p className="text-gray-600 dark:text-gray-300">Kelola RFQ dan kumpulkan penawaran pemasok</p>
        </div>
        <Link to="/app/purchasing/rfqs/new" className="btn-primary">
          <PlusIcon className="mr-1.5 h-5 w-5" />
          Buat RFQ
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor RFQ, judul, atau pembuat" extra={(
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      )} />

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">Memuat RFQ...</div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <SortTh tools={tools} col="rfq_number" className={th}>No. RFQ</SortTh>
                  <SortTh tools={tools} col="title" className={th}>Judul</SortTh>
                  <SortTh tools={tools} col="issue_date" className={th}>Tgl Terbit</SortTh>
                  <SortTh tools={tools} col="closing_date" className={th}>Tgl Tutup</SortTh>
                  <SortTh tools={tools} col="status" className={th}>Status</SortTh>
                  <SortTh tools={tools} col="quotes_count" className={th}>Penawaran</SortTh>
                  <th className={`${th} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {tools.rows.map((rfq: any) => {
                  const badge = STATUS[rfq.status] || { cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: rfq.status }
                  return (
                    <tr key={rfq.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{rfq.rfq_number}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Oleh: {rfq.created_by || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">{rfq.title}</div>
                        {rfq.description && <div className="max-w-xs truncate text-sm text-gray-500 dark:text-gray-400">{rfq.description}</div>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{fmt(rfq.issue_date)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{fmt(rfq.closing_date)}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{rfq.quotes_count || 0} penawaran</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link to={`/app/purchasing/rfqs/${rfq.id}`} className="p-1 text-primary-700 hover:text-primary-900 dark:text-primary-300" title="Lihat detail" aria-label="Lihat detail">
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                          {rfq.status === 'draft' && (
                            <Link to={`/app/purchasing/rfqs/${rfq.id}/edit`} className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-300" title="Ubah" aria-label="Ubah">
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
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada RFQ' : 'Tidak ada RFQ yang cocok'}</h3>
          {tools.total === 0 && (
            <div className="mt-6">
              <Link to="/app/purchasing/rfqs/new" className="btn-primary">
                <PlusIcon className="mr-1.5 h-5 w-5" />
                Buat RFQ
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
