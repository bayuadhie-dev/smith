import React, { useState } from 'react'
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon
,
  PlusIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useGetReturnsQuery, useGetReturnAnalyticsQuery } from '../../services/returnsApi'
export default function ReturnsDashboard() {
    const { t } = useLanguage();

const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [qcStatusFilter, setQcStatusFilter] = useState('')

  const { data: returnsData, isLoading, refetch } = useGetReturnsQuery({
    page,
    per_page: 20,
    status: statusFilter || undefined,
    qc_status: qcStatusFilter || undefined
  })

  const { data: analytics } = useGetReturnAnalyticsQuery() as any

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return <ClockIcon className="h-5 w-5 text-blue-500" />
      case 'qc_pending': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
      case 'qc_approved': return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'qc_rejected': return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'processed': return <CheckCircleIcon className="h-5 w-5 text-blue-500" />
      default: return <ClockIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'received':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'qc_pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'qc_approved':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'qc_rejected':
        return `${baseClasses} bg-red-100 text-red-800`
      case 'processed':
        return `${baseClasses} bg-blue-100 text-blue-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getQCStatusBadge = (qcStatus: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (qcStatus) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'passed':
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'failed':
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #16 of 17). Returns table/detail are intentionally left as-is -
  // only the header+analytics section is in scope for the bento look.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Retur</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage customer returns and QC inspections</p>
        </div>
        <Link
          to="/app/returns/new"
          className="bg-gradient-to-br from-[#059669] to-[#047857] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-shadow flex items-center gap-2 text-sm font-medium"
        >
          <PlusIcon className="h-5 w-5" />
          New Return
        </Link>
      </div>

      {/* Analytics Cards - bento: Total Returns spans 2 cols (primary metric) */}
      {analytics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-2 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <ArrowPathIcon className="w-5 h-5" />
                </div>
                <p className="text-sm opacity-90">Total Returns</p>
              </div>
              <p className="text-3xl font-bold">{analytics.summary.total_returns}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <ClockIcon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs opacity-90 mb-1">Pending QC</p>
              <p className="text-2xl font-bold">{analytics.summary.pending_qc}</p>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs opacity-90 mb-1">QC Approved</p>
              <p className="text-2xl font-bold">{analytics.summary.approved_returns}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <XCircleIcon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs opacity-90 mb-1">QC Rejected</p>
              <p className="text-2xl font-bold">{analytics.summary.rejected_returns}</p>
            </div>

            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs opacity-90 mb-1">Approval Rate</p>
              <p className="text-2xl font-bold">{analytics.summary.qc_approval_rate.toFixed(1)}%</p>
            </div>
          </div>
        </>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search returns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="received">Received</option>
            <option value="qc_pending">QC Pending</option>
            <option value="qc_approved">QC Approved</option>
            <option value="qc_rejected">QC Rejected</option>
            <option value="processed">Processed</option>
          </select>

          <select
            value={qcStatusFilter}
            onChange={(e) => setQcStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All QC Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:bg-gray-700 flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Return Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  QC Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Loading returns...
                  </td>
                </tr>
              ) : returnsData?.returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No returns found
                  </td>
                </tr>
              ) : (
                returnsData?.returns.map((returnItem) => (
                  <tr key={returnItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(returnItem.status)}
                        <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                          {returnItem.return_number}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {returnItem.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(returnItem.return_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {returnItem.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(returnItem.status)}>
                        {returnItem.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {returnItem.qc_required ? (
                        <span className={getQCStatusBadge(returnItem.qc_status || 'pending')}>
                          {(returnItem.qc_status || 'pending').replace('_', ' ').toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {returnItem.total_items}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Rp {returnItem.total_value.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/app/returns/${returnItem.id}`}
                        className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {returnsData && returnsData.pages > 1 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50"
              >
              </button>
              <button
                onClick={() => setPage(Math.min(returnsData.pages, page + 1))}
                disabled={page === returnsData.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50"
              >
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Showing page <span className="font-medium">{page}</span> of{' '}
                  <span className="font-medium">{returnsData.pages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50"
                  >
                  </button>
                  <button
                    onClick={() => setPage(Math.min(returnsData.pages, page + 1))}
                    disabled={page === returnsData.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50"
                  >
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
