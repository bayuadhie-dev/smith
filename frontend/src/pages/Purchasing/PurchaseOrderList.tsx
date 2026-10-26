import React, { useState } from 'react'
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
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
export default function PurchaseOrderList() {
    const { t } = useLanguage();

const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [page, setPage] = useState(1)
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
    search,
    status,
    priority,
    page
  })
  
  const [submitForApproval] = useSubmitForApprovalMutation()

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      draft: { class: 'bg-gray-100 text-gray-800', label: 'Draft' },
      pending_approval: { class: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { class: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { class: 'bg-red-100 text-red-800', label: 'Rejected' },
      sent: { class: 'bg-blue-100 text-blue-800', label: 'Sent' },
      confirmed: { class: 'bg-indigo-100 text-indigo-800', label: 'Confirmed' },
      partial: { class: 'bg-orange-100 text-orange-800', label: 'Partially Received' },
      received: { class: 'bg-green-100 text-green-800', label: 'Received' },
      cancelled: { class: 'bg-red-100 text-red-800', label: 'Cancelled' }
    }
    return badges[status] || { class: 'bg-gray-100 text-gray-800', label: status }
  }

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      low: { class: 'bg-gray-100 text-gray-800', label: 'Low' },
      normal: { class: 'bg-blue-100 text-blue-800', label: 'Normal' },
      high: { class: 'bg-orange-100 text-orange-800', label: 'High' },
      urgent: { class: 'bg-red-100 text-red-800', label: 'Urgent' }
    }
    return badges[priority] || { class: 'bg-blue-100 text-blue-800', label: 'Normal' }
  }

  const handleSubmitApproval = async (po: any) => {
    try {
      await submitForApproval({ poId: po.id }).unwrap()
      toast.success('Purchase order submitted for approval')
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
      toast.error(error?.data?.error || 'Failed to submit for approval')
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
      toast.success('Purchase order submitted with manual exchange rate')
      setManualRateModal(m => ({ ...m, open: false, submitting: false }))
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.error || 'Failed to submit for approval')
      setManualRateModal(m => ({ ...m, submitting: false }))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    refetch()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pesanan Pembelian</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage purchase orders and approval workflow</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/app/purchasing/rfqs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:bg-gray-700 transition-colors"
          >
            <DocumentTextIcon className="h-5 w-5" />
          </Link>
          <Link
            to="/app/purchasing/purchase-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create PO
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.search')}</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO number, supplier..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="sent">Sent</option>
              <option value="confirmed">Confirmed</option>
              <option value="received">Received</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:bg-gray-700 transition-colors"
            >
              <FunnelIcon className="h-5 w-5" />{t('common.filter')}</button>
          </div>
        </form>
      </div>

      {/* Purchase Orders Table */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Loading purchase orders...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Purchase Orders ({data?.total || 0})
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PO Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status & Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data?.purchase_orders?.map((po: any) => {
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
                            Created: {format(new Date(po.created_at || po.order_date), 'dd MMM yyyy')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{po.supplier_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Order: {format(new Date(po.order_date), 'dd MMM yyyy')}
                          </div>
                          {po.required_date && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Required: {format(new Date(po.required_date), 'dd MMM yyyy')}
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
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                          
                          {po.status === 'draft' && (
                            <>
                              <Link
                                to={`/app/purchasing/purchase-orders/${po.id}/edit`}
                                className="text-indigo-600 hover:text-indigo-900 p-1"
                                title={t('common.edit')}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleSubmitApproval(po)}
                                className="text-yellow-600 hover:text-yellow-900 p-1"
                                title="Submit for Approval"
                              >
                                <ClockIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          {po.status === 'pending_approval' && (
                            <Link
                              to="/app/approval"
                              className="text-yellow-600 hover:text-yellow-900 p-1"
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
          
          {/* Pagination */}
          {data?.pages && data.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-200">
                Showing page {data.current_page} of {data.pages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.pages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!data?.purchase_orders || data.purchase_orders.length === 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No purchase orders</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first purchase order.</p>
          <div className="mt-6">
            <Link
              to="/app/purchasing/purchase-orders/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Create Purchase Order
            </Link>
          </div>
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
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
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
