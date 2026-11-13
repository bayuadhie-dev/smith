import { useState } from 'react'
import { Link } from 'react-router-dom';
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { formatRupiah, formatCurrencyAmount } from '../../utils/currencyUtils'
import AccessibleModal from '../../components/ui/AccessibleModal'
import {
  useGetPurchaseOrdersQuery,
  useSubmitForApprovalMutation
} from '../../services/api'
import {
  ClockIcon,
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import NumberInput from '../../components/ui/NumberInput'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', pending_approval: 'Menunggu Persetujuan', approved: 'Disetujui', rejected: 'Ditolak', sent: 'Terkirim', confirmed: 'Dikonfirmasi', partial: 'Diterima Sebagian', received: 'Diterima', cancelled: 'Batal' }
const PRIORITY_LABEL: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' }
const COLUMNS: ListColumn<any>[] = [
  { key: 'po_number', label: 'No. PO', value: (p) => p.po_number },
  { key: 'supplier_name', label: 'Pemasok', value: (p) => p.supplier_name },
  { key: 'order_date', label: 'Tgl Pesanan', value: (p) => p.order_date, type: 'date' },
  { key: 'required_date', label: 'Tgl Dibutuhkan', value: (p) => p.required_date, type: 'date' },
  { key: 'status', label: 'Status', value: (p) => p.status, exportValue: (p) => STATUS_LABEL[p.status] || p.status },
  { key: 'priority', label: 'Prioritas', value: (p) => p.priority, exportValue: (p) => PRIORITY_LABEL[p.priority] || p.priority },
  { key: 'currency', label: 'Mata Uang', value: (p) => p.currency },
  { key: 'total_amount', label: 'Total', value: (p) => p.total_amount, type: 'number' },
  { key: 'total_amount_idr', label: 'Total (Rp)', value: (p) => p.total_amount_idr ?? p.total_amount, type: 'number' },
]

export default function PurchaseOrderList() {

const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [manualRateModal, setManualRateModal] = useState<{
    open: boolean
    poId: number | null
    poNumber: string
    currency: string
    rate: string
    confirmed: boolean
    submitting: boolean
  }>({
    open: false,
    poId: null,
    poNumber: '',
    currency: 'USD',
    rate: '',
    confirmed: false,
    submitting: false
  })
  
  const { data, isLoading, refetch } = useGetPurchaseOrdersQuery({
    status,
    priority,
    per_page: 1000
  })
  
  const [submitForApproval] = useSubmitForApprovalMutation()
  const tools = useListTools<any>(data?.purchase_orders, COLUMNS, { filename: 'Pesanan_Pembelian', initialSort: { key: 'order_date', dir: 'desc' } })

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      draft: { class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: 'Draft' },
      pending_approval: { class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', label: 'Menunggu Persetujuan' },
      approved: { class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Disetujui' },
      rejected: { class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Ditolak' },
      sent: { class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Terkirim' },
      confirmed: { class: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', label: 'Dikonfirmasi' },
      partial: { class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: 'Diterima Sebagian' },
      received: { class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Diterima' },
      cancelled: { class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Batal' }
    }
    return badges[status] || { class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: status }
  }

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      low: { class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', label: 'Rendah' },
      normal: { class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Normal' },
      high: { class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: 'Tinggi' },
      urgent: { class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Mendesak' }
    }
    return badges[priority] || { class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Normal' }
  }

  const handleSubmitApproval = async (po: any) => {
    try {
      await submitForApproval({ poId: po.id }).unwrap()
      toast.success('PO diajukan untuk persetujuan')
      refetch()
    } catch (error: any) {
      if (error?.data?.error_code === 'EXCHANGE_RATE_UNAVAILABLE') {
        setManualRateModal({
          open: true,
          poId: po.id,
          poNumber: po.po_number,
          currency: error?.data?.currency || po.currency || 'USD',
          rate: '',
          confirmed: false,
          submitting: false
        })
        return
      }
      toast.error(error?.data?.error || 'Gagal mengajukan persetujuan')
    }
  }

  const handleSubmitManualRate = async () => {
    if (!manualRateModal.poId) return
    const parsedRate = parseFloat(manualRateModal.rate)
    if (!parsedRate || parsedRate <= 0 || !manualRateModal.confirmed) return
    setManualRateModal(m => ({ ...m, submitting: true }))
    try {
      await submitForApproval({
        poId: manualRateModal.poId,
        manual_exchange_rate: parsedRate,
        manual_rate_confirmed: true
      }).unwrap()
      toast.success('PO diajukan dengan kurs manual')
      setManualRateModal(m => ({ ...m, open: false, submitting: false }))
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.error || 'Gagal mengajukan persetujuan')
      setManualRateModal(m => ({ ...m, submitting: false }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pesanan Pembelian</h1>
          <p className="text-gray-600 dark:text-gray-300">Kelola pesanan pembelian dan alur persetujuan</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/app/purchasing/rfqs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:bg-gray-700 transition-colors dark:hover:bg-gray-600"
          >
            <DocumentTextIcon className="h-5 w-5" />
          </Link>
          <Link to="/app/imports?kind=purchase_order" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium dark:hover:bg-gray-700 dark:border-gray-600">Import</Link>
          <Link to="/app/imports?kind=purchase_order&mode=export" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium dark:hover:bg-gray-700 dark:border-gray-600">Ekspor</Link>
          <Link
            to="/app/purchasing/purchase-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Buat PO
          </Link>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor PO atau pemasok" extra={(
        <>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">Semua status</option>
            {['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'confirmed', 'received'].map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Prioritas" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">Semua prioritas</option>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </>
      )} />

      {/* Purchase Orders Table */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Memuat pesanan pembelian...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <SortTh tools={tools} col="po_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">No. PO</SortTh>
                  <SortTh tools={tools} col="supplier_name" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pemasok</SortTh>
                  <SortTh tools={tools} col="order_date" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</SortTh>
                  <SortTh tools={tools} col="status" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</SortTh>
                  <SortTh tools={tools} col="total_amount" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</SortTh>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((po: any) => {
                  const statusBadge = getStatusBadge(po.status)
                  const priorityBadge = getPriorityBadge(po.priority)
                  
                  return (
                    <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {po.po_number}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Dibuat: {format(new Date(po.created_at || po.order_date), 'dd MMM yyyy')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{po.supplier_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Pesan: {format(new Date(po.order_date), 'dd MMM yyyy')}
                          </div>
                          {po.required_date && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Dibutuhkan: {format(new Date(po.required_date), 'dd MMM yyyy')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.class}`}>
                            {statusBadge.label}
                          </span>
                          <div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityBadge.class}`}>
                              {priorityBadge.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrencyAmount(po.total_amount, po.currency)}
                        </div>
                        {po.currency && po.currency !== 'IDR' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {po.status === 'draft'
                              ? `(${po.currency} - kurs dikunci saat submit)`
                              : `≈ ${formatRupiah(po.total_amount_idr)} (${po.exchange_rate_source === 'manual' ? 'kurs manual' : 'kurs auto'})`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/app/purchasing/purchase-orders/${po.id}`}
                            className="text-blue-600 hover:text-blue-900 p-1 dark:text-blue-400"
                            title="Lihat detail" aria-label="Lihat detail"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                          
                          {po.status === 'draft' && (
                            <>
                              <Link
                                to={`/app/purchasing/purchase-orders/${po.id}/edit`}
                                className="text-indigo-600 hover:text-indigo-900 p-1 dark:text-indigo-400"
                                title="Ubah" aria-label="Ubah"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleSubmitApproval(po)}
                                className="text-yellow-600 hover:text-yellow-900 p-1 dark:text-yellow-400"
                                title="Ajukan persetujuan" aria-label="Ajukan persetujuan"
                              >
                                <ClockIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          {po.status === 'pending_approval' && (
                            <Link
                              to="/app/approval"
                              className="text-yellow-600 hover:text-yellow-900 p-1 dark:text-yellow-400"
                              title="Lihat status approval"
                            >
                              <ShieldCheckIcon className="h-4 w-4" />
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

      {/* Empty State */}
      {!isLoading && tools.rows.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada pesanan pembelian' : 'Tidak ada PO yang cocok'}</h3>
          {tools.total === 0 && (
            <div className="mt-6">
              <Link to="/app/purchasing/purchase-orders/new" className="btn-primary">
                <PlusIcon className="mr-1.5 h-5 w-5" />
                Buat Pesanan Pembelian
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Manual Exchange Rate Modal (shown when automatic rate is unavailable) */}
      <AccessibleModal
        isOpen={manualRateModal.open}
        onClose={() => setManualRateModal(m => ({ ...m, open: false }))}
        title={`Input Kurs Manual — ${manualRateModal.poNumber} (${manualRateModal.currency})`}
        size="md"
      >
        <div className="space-y-4 text-sm">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
            ⚠️ Kurs otomatis {manualRateModal.currency}/IDR tidak tersedia. Cek kurs riil (BI / bank / supplier) terlebih dahulu sebelum menyimpan. Kurs ini akan dikunci untuk GRN dan faktur dari PO ini.
          </div>
          <div>
            <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">
              Kurs 1 {manualRateModal.currency} ke IDR *
            </label>
            <NumberInput
              step="0.01"
              min="1"
              value={manualRateModal.rate}
              onChange={e => setManualRateModal(m => ({ ...m, rate: e.target.value }))}
              placeholder="Contoh: 16250"
              className="input-field w-full"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={manualRateModal.confirmed}
              onChange={e => setManualRateModal(m => ({ ...m, confirmed: e.target.checked }))}
              className="mt-1"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Saya sudah mengecek kurs riil dan menyetujui kurs ini dikunci untuk PO {manualRateModal.poNumber}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setManualRateModal(m => ({ ...m, open: false }))}
              className="btn-secondary"
              disabled={manualRateModal.submitting}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmitManualRate}
              disabled={
                manualRateModal.submitting ||
                !manualRateModal.confirmed ||
                !(parseFloat(manualRateModal.rate) > 0)
              }
              className="btn-primary disabled:opacity-50"
            >
              {manualRateModal.submitting ? 'Menyimpan...' : 'Kunci Kurs & Submit PO'}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  )
}
