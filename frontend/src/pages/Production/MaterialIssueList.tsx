import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DocumentTextIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  FunnelIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

interface MaterialIssue {
  id: number
  issue_number: string
  work_order_id: number
  wo_number: string
  product_name: string
  issue_date: string
  status: string
  priority: string
  issue_type: string
  total_items: number
  requested_by: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', issued: 'Dikeluarkan', partial: 'Sebagian', cancelled: 'Dibatalkan' }
const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgent', high: 'Tinggi', normal: 'Normal', low: 'Rendah' }
const COLUMNS: ListColumn<MaterialIssue>[] = [
  { key: 'issue_number', label: 'No. Permintaan', value: (i) => i.issue_number },
  { key: 'wo_number', label: 'SPK', value: (i) => i.wo_number },
  { key: 'product_name', label: 'Produk', value: (i) => i.product_name },
  { key: 'issue_date', label: 'Tanggal', value: (i) => i.issue_date, type: 'date' },
  { key: 'total_items', label: 'Jumlah Item', value: (i) => i.total_items, type: 'number' },
  { key: 'priority', label: 'Prioritas', value: (i) => i.priority, exportValue: (i) => PRIORITY_LABEL[i.priority] || i.priority },
  { key: 'status', label: 'Status', value: (i) => i.status, exportValue: (i) => STATUS_LABEL[i.status] || i.status },
  { key: 'requested_by', label: 'Diminta Oleh', value: (i) => i.requested_by },
]

const MaterialIssueList: React.FC = () => {
  const [issues, setIssues] = useState<MaterialIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 1000,
    total: 0,
    pages: 0
  })
  const tools = useListTools<MaterialIssue>(issues, COLUMNS, { filename: 'Permintaan_Barang', initialSort: { key: 'issue_date', dir: 'desc' } })

  useEffect(() => {
    fetchIssues()
  }, [statusFilter])

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: pagination.page,
        per_page: pagination.per_page
      }
      if (statusFilter) params.status = statusFilter

      const response = await axiosInstance.get('/api/production/material-issues', { params })
      setIssues(response.data.material_issues || [])
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        pages: response.data.pages
      }))
    } catch (error) {
      console.error('Error fetching material issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <ClockIcon className="h-3 w-3" />
            Menunggu
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
            <CheckCircleIcon className="h-3 w-3" />
            Disetujui
          </span>
        )
      case 'issued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircleIcon className="h-3 w-3" />
            Dikeluarkan
          </span>
        )
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
            <ArrowPathIcon className="h-3 w-3" />
            Sebagian
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <XCircleIcon className="h-3 w-3" />
            Dibatalkan
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
            {status}
          </span>
        )
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Urgent</span>
      case 'high':
        return <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">Tinggi</span>
      case 'normal':
        return <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">Normal</span>
      case 'low':
        return <span className="px-2 py-1 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">Rendah</span>
      default:
        return <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{priority}</span>
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permintaan Barang</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Kelola pengeluaran material untuk produksi</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/app/production/material-issues/shortages"
            className="btn btn-secondary flex items-center gap-2"
          >
            <ExclamationTriangleIcon className="h-5 w-5" />
            Laporan Kekurangan
          </Link>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <FunnelIcon className="h-5 w-5" />
            Filter
          </button>
          <button
            onClick={fetchIssues}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Muat Ulang
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-full"
              >
                <option value="">Semua Status</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="issued">Dikeluarkan</option>
                <option value="partial">Sebagian</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6"><ListToolbar tools={tools} placeholder="Cari nomor, SPK, produk, peminta" /></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Permintaan</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pagination.total}</p>
            </div>
            <DocumentTextIcon className="h-10 w-10 text-primary-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Menunggu</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {issues.filter(i => i.status === 'pending').length}
              </p>
            </div>
            <ClockIcon className="h-10 w-10 text-yellow-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Disetujui</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {issues.filter(i => i.status === 'approved').length}
              </p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-primary-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Dikeluarkan</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {issues.filter(i => i.status === 'issued').length}
              </p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : tools.rows.length === 0 ? (
          <div className="p-8 text-center">
            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">{tools.total === 0 ? 'Belum ada permintaan barang' : 'Tidak ada permintaan yang cocok'}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="issue_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Permintaan</SortTh>
                <SortTh tools={tools} col="wo_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SPK</SortTh>
                <SortTh tools={tools} col="product_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</SortTh>
                <SortTh tools={tools} col="issue_date" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</SortTh>
                <SortTh tools={tools} col="total_items" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</SortTh>
                <SortTh tools={tools} col="priority" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prioritas</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tools.rows.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-primary-600 dark:text-primary-400">{issue.issue_number}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/app/production/work-orders/${issue.work_order_id}`} className="text-primary-600 hover:underline dark:text-primary-400">
                      {issue.wo_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {issue.product_name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {issue.issue_date ? new Date(issue.issue_date).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {issue.total_items} item
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getPriorityBadge(issue.priority)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(issue.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      to={`/app/production/material-issues/${issue.id}`}
                      className="text-primary-600 hover:text-primary-800 dark:text-primary-400"
                    >
                      <EyeIcon className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Lihat</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>
    </div>
  )
}

export default MaterialIssueList
