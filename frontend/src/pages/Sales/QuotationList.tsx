import { Link } from 'react-router-dom'
import { BanknotesIcon, CheckCircleIcon, ClockIcon, DocumentTextIcon, EyeIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useCallback } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import LoadingSpinner from '../../components/Common/LoadingSpinner'
import QuotationDetailModal from './QuotationDetailModal'
import { showError, showSuccess } from '../../components/ui'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

interface Quotation {
  id: number
  quotation_number: string
  customer_id: number
  customer_name: string
  customer_company: string
  quote_date: string
  valid_until: string
  status: string
  total_amount: number
  items_count: number
  notes?: string
  created_by_name?: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Terkirim', accepted: 'Diterima', rejected: 'Ditolak', expired: 'Kedaluwarsa', converted: 'Jadi Pesanan' }

const COLUMNS: ListColumn<Quotation>[] = [
  { key: 'quotation_number', label: 'No. Penawaran', value: (q) => q.quotation_number },
  { key: 'customer_company', label: 'Pelanggan', value: (q) => q.customer_company },
  { key: 'customer_name', label: 'Kontak', value: (q) => q.customer_name },
  { key: 'quote_date', label: 'Tanggal', value: (q) => q.quote_date, type: 'date' },
  { key: 'valid_until', label: 'Berlaku Sampai', value: (q) => q.valid_until, type: 'date' },
  { key: 'items_count', label: 'Jumlah Barang', value: (q) => q.items_count, type: 'number' },
  { key: 'total_amount', label: 'Total (Rp)', value: (q) => q.total_amount, type: 'number' },
  { key: 'status', label: 'Status', value: (q) => q.status, exportValue: (q) => STATUS_LABEL[q.status] || q.status },
  { key: 'created_by_name', label: 'Dibuat oleh', value: (q) => q.created_by_name },
]

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString('id-ID') : '-')
const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
    case 'sent': return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300'
    case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'expired': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'converted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
  }
}

const QuotationList = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' })
  const tools = useListTools<Quotation>(quotations, COLUMNS, { filename: 'Penawaran_Penjualan', initialSort: { key: 'quote_date', dir: 'desc' } })

  const loadQuotations = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        per_page: '1000',
        ...(filters.status && { status: filters.status }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
      })
      const response = await axiosInstance.get(`/api/sales/quotations?${params}`)
      setQuotations(response.data.quotations || [])
    } catch (error) {
      showError('Gagal memuat penawaran')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadQuotations() }, [loadQuotations])

  const isExpiringSoon = (expiryDate: string) => {
    const diffDays = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diffDays <= 7 && diffDays > 0
  }

  const handleConvertToOrder = async (quotationId: number) => {
    try {
      await axiosInstance.post(`/api/sales/quotations/${quotationId}/convert`)
      showSuccess('Penawaran berhasil diubah menjadi pesanan penjualan')
      loadQuotations()
    } catch (error) {
      showError('Gagal mengubah penawaran menjadi pesanan')
    }
  }

  if (loading && quotations.length === 0) return <LoadingSpinner />

  const th = 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
  const inputCls = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Penawaran Penjualan</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">Kelola penawaran dan proposal untuk pelanggan</p>
        </div>
        <Link to="/app/sales/quotations/new" className="btn-primary">
          <PlusIcon className="mr-1.5 h-5 w-5" />
          Penawaran Baru
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {[
          { icon: DocumentTextIcon, tone: 'bg-primary-600', label: 'Total penawaran', value: String(quotations.length) },
          { icon: ClockIcon, tone: 'bg-yellow-500', label: 'Menunggu jawaban', value: String(quotations.filter((q) => q.status === 'sent').length) },
          { icon: CheckCircleIcon, tone: 'bg-green-600', label: 'Diterima', value: String(quotations.filter((q) => q.status === 'accepted').length) },
          { icon: BanknotesIcon, tone: 'bg-purple-600', label: 'Total nilai', value: `Rp ${quotations.reduce((sum, q) => sum + (q.total_amount || 0), 0).toLocaleString('id-ID')}` },
        ].map((c) => (
          <div key={c.label} className="card p-6">
            <div className="flex items-center">
              <div className={`${c.tone} rounded-lg p-3`}><c.icon className="h-6 w-6 text-white" /></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor penawaran atau pelanggan" extra={(
        <>
          <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} aria-label="Status" className={inputCls}>
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} aria-label="Dari tanggal" className={inputCls} />
          <input type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} aria-label="Sampai tanggal" className={inputCls} />
          {(filters.status || filters.date_from || filters.date_to) && (
            <button type="button" className="btn-secondary" onClick={() => setFilters({ status: '', date_from: '', date_to: '' })}>Hapus filter</button>
          )}
        </>
      )} />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="quotation_number" className={th}>No. Penawaran</SortTh>
                <SortTh tools={tools} col="customer_company" className={th}>Pelanggan</SortTh>
                <SortTh tools={tools} col="quote_date" className={th}>Tanggal</SortTh>
                <SortTh tools={tools} col="valid_until" className={th}>Berlaku Sampai</SortTh>
                <SortTh tools={tools} col="total_amount" className={th}>Barang dan Nilai</SortTh>
                <SortTh tools={tools} col="status" className={th}>Status</SortTh>
                <th className={th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {tools.rows.map((quotation) => {
                const expiringSoon = isExpiringSoon(quotation.valid_until)
                return (
                  <tr key={quotation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{quotation.quotation_number}</div>
                      {quotation.created_by_name && <div className="text-xs text-gray-500 dark:text-gray-400">oleh {quotation.created_by_name}</div>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{quotation.customer_company}</div>
                      {quotation.customer_name && <div className="text-xs text-gray-500 dark:text-gray-400">{quotation.customer_name}</div>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{fmtDate(quotation.quote_date)}</td>
                    <td className={`whitespace-nowrap px-6 py-4 text-sm ${expiringSoon ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                      {fmtDate(quotation.valid_until)}
                      {expiringSoon && <span className="ml-1 text-xs">(segera berakhir)</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Rp {(quotation.total_amount || 0).toLocaleString('id-ID')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{quotation.items_count} barang</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(quotation.status)}`}>{STATUS_LABEL[quotation.status] || quotation.status}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setSelectedQuotationId(quotation.id)} className="text-primary-700 hover:text-primary-900 dark:text-primary-300" title="Lihat detail" aria-label="Lihat detail">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <Link to={`/app/sales/quotations/${quotation.id}/edit`} className="text-gray-700 hover:underline dark:text-gray-300">Ubah</Link>
                        {quotation.status === 'accepted' && (
                          <button type="button" onClick={() => handleConvertToOrder(quotation.id)} className="text-purple-700 hover:underline dark:text-purple-300">Jadikan pesanan</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {tools.rows.length === 0 && !loading && (
          <div className="py-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada penawaran' : 'Tidak ada penawaran yang cocok'}</h3>
            {tools.total === 0 && (
              <div className="mt-6">
                <Link to="/app/sales/quotations/new" className="btn-primary">
                  <PlusIcon className="mr-1.5 h-5 w-5" />
                  Penawaran Baru
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedQuotationId && (
        <QuotationDetailModal
          quotationId={selectedQuotationId}
          onClose={() => setSelectedQuotationId(null)}
          onConvert={(id) => { handleConvertToOrder(id); setSelectedQuotationId(null) }}
          getStatusColor={getStatusColor}
        />
      )}
    </div>
  )
}

export default QuotationList
