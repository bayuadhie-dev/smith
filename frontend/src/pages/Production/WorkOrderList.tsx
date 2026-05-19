import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  FunnelIcon,
  InformationCircleIcon as StatusIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  PlusIcon,
  TagIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  BoltIcon,
  DocumentTextIcon,
  ListBulletIcon,
  ViewColumnsIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import LoadingSpinner from '../../components/Common/LoadingSpinner'
import ActivityLogModal from '../../components/ActivityLogModal'
import ProductionOutputModal from '../../components/Production/ProductionOutputModal'
import WorkOrderKanban from './WorkOrderKanban'
interface WorkOrder {
  id: number
  wo_number: string
  product_name: string
  quantity: number
  quantity_produced: number
  quantity_good: number
  quantity_scrap: number
  status: string
  priority: string
  batch_number?: string
  machine_name?: string
  supervisor_name?: string
  scheduled_start_date?: string
  scheduled_end_date?: string
  actual_start_date?: string
  actual_end_date?: string
  last_input_date?: string
  last_input_by?: string
  created_at: string
  shift_count?: number
  pack_per_carton?: number
  total_cartons?: number
}

const WorkOrderList = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: ''
  })
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [showProductionOutput, setShowProductionOutput] = useState(false)
  const [bulkCompleting, setBulkCompleting] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('wo_view_mode') as 'list' | 'kanban') || 'list'
  })
  const [summary, setSummary] = useState({ total: 0, in_progress: 0, completed: 0, total_produced: 0 })
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>(null)

  useEffect(() => {
    loadWorkOrders()
  }, [currentPage, filters])

  const loadWorkOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20',
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.search && { search: filters.search })
      })

      const response = await axiosInstance.get(`/api/production/work-orders?${params}`)
      setWorkOrders(response.data.work_orders || [])
      setTotalPages(response.data.pages || 1)
      if (response.data.summary) {
        setSummary(response.data.summary)
      }
    } catch (error) {
      console.error('Error loading work orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await axiosInstance.put(`/api/production/work-orders/${id}/status`, { status: newStatus })
      loadWorkOrders() // Refresh list
    } catch (error) {
      console.error('Error updating work order status:', error)
      alert('Failed to update work order status')
    }
  }

  const handleDelete = async (id: number, woNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete Work Order ${woNumber}?`)) {
      return
    }
    try {
      await axiosInstance.delete(`/api/production/work-orders/${id}`)
      alert('Work Order deleted successfully')
      loadWorkOrders()
    } catch (error: any) {
      console.error('Error deleting work order:', error)
      alert(error.response?.data?.error || 'Failed to delete work order')
    }
  }

  const handleBulkComplete = async () => {
    const inProgressCount = workOrders.filter(wo => wo.status === 'in_progress').length
    if (inProgressCount === 0) {
      alert('Tidak ada Work Order dengan status In Progress')
      return
    }
    if (!window.confirm(`Selesaikan semua ${inProgressCount} Work Order yang In Progress?`)) {
      return
    }
    try {
      setBulkCompleting(true)
      const response = await axiosInstance.put('/api/production/work-orders/bulk-complete')
      alert(response.data.message || `${response.data.completed} WO berhasil diselesaikan`)
      loadWorkOrders()
    } catch (error: any) {
      console.error('Error bulk completing:', error)
      alert(error.response?.data?.error || 'Gagal menyelesaikan Work Orders')
    } finally {
      setBulkCompleting(false)
    }
  }

  const handleStartNow = async (id: number) => {
    try {
      // First release if planned
      const wo = workOrders.find(w => w.id === id)
      if (wo?.status === 'planned') {
        await axiosInstance.put(`/api/production/work-orders/${id}/status`, { status: 'released' })
      }
      // Then start
      await axiosInstance.put(`/api/production/work-orders/${id}/status`, { status: 'in_progress' })
      alert('Work Order started!')
      loadWorkOrders()
    } catch (error: any) {
      console.error('Error starting work order:', error)
      alert(error.response?.data?.error || 'Failed to start work order')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800'
      case 'released': return 'bg-yellow-100 text-yellow-800'  
      case 'in_progress': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return ClockIcon
      case 'released': return ClockIcon
      case 'in_progress': return PlayIcon
      case 'completed': return CheckCircleIcon
      default: return ClockIcon
    }
  }

  const calculateProgress = (produced: number, total: number) => {
    return total > 0 ? (produced / total * 100).toFixed(1) : '0.0'
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setFilters({ status: '', priority: '', search: '' })
    setCurrentPage(1)
  }

  if (loading && workOrders.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📋 Work Orders</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage production work orders and schedules</p>
        </div>
        <div className="flex gap-3 items-center">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => { setViewMode('list'); localStorage.setItem('wo_view_mode', 'list') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ListBulletIcon className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => { setViewMode('kanban'); localStorage.setItem('wo_view_mode', 'kanban') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ViewColumnsIcon className="h-4 w-4" />
              Kanban
            </button>
          </div>
          <button
            onClick={handleBulkComplete}
            disabled={bulkCompleting || summary.in_progress === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircleIcon className="h-5 w-5" />
            {bulkCompleting ? 'Memproses...' : 'Selesaikan Semua'}
          </button>
          <button
            onClick={() => setShowActivityLog(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
          >
            <DocumentTextIcon className="h-5 w-5" />
            Log Aktivitas
          </button>
          <Link to="/app/production/work-orders/new" className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            New Work Order
          </Link>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <WorkOrderKanban />
      ) : (
      <>
      {/* Summary Cards - compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg shrink-0">
            <ClockIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Orders</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="bg-yellow-500 p-2 rounded-lg shrink-0">
            <PlayIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.in_progress}</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="bg-green-500 p-2 rounded-lg shrink-0">
            <CheckCircleIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.completed}</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all" onClick={() => setShowProductionOutput(true)}>
          <div className="bg-purple-500 p-2 rounded-lg shrink-0">
            <ChartBarIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Produced</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.total_produced.toLocaleString()}</p>
            <p className="text-xs text-purple-500">Klik detail →</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4 mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('common.search')}</label>
            <div className="relative mt-1">
              <input
                type="text"
                placeholder="WO number, product..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="input pl-10"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('common.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input mt-1"
            >
              <option value="">All Statuses</option>
              <option value="planned">Planned</option>
              <option value="released">Released</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="input mt-1"
            >
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white">Work Orders</h3>
          <span className="text-xs text-gray-400">{workOrders.length} ditampilkan</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setDateSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                  title="Klik untuk urutkan tanggal"
                >
                  <div className="flex items-center gap-1">
                    Tanggal
                    {dateSort === 'asc' ? (
                      <ChevronUpIcon className="h-3.5 w-3.5 text-blue-500" />
                    ) : dateSort === 'desc' ? (
                      <ChevronDownIcon className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <span className="flex flex-col">
                        <ChevronUpIcon className="h-2.5 w-2.5 text-gray-300" />
                        <ChevronDownIcon className="h-2.5 w-2.5 text-gray-300" />
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Work Order
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Produk & Mesin
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                  Progress
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {[...workOrders].sort((a, b) => {
                if (!dateSort) return 0;
                const da = a.scheduled_start_date ? new Date(a.scheduled_start_date).getTime() : 0;
                const db = b.scheduled_start_date ? new Date(b.scheduled_start_date).getTime() : 0;
                return dateSort === 'asc' ? da - db : db - da;
              }).map((wo) => {
                const StatusIcon = getStatusIcon(wo.status)
                const rawProgress = wo.quantity > 0 ? (wo.quantity_produced / wo.quantity * 100) : 0
                const progress = rawProgress.toFixed(1)
                const progressNum = rawProgress
                const isComplete = wo.status === 'completed'
                const progressColor = progressNum >= 100 ? 'bg-green-500' : progressNum >= 60 ? 'bg-yellow-400' : 'bg-red-500'
                const progressBarWidth = Math.min(progressNum, 100)
                const isInProgress = wo.status === 'in_progress'
                const canStart = wo.status === 'planned' || wo.status === 'released'

                return (
                  <tr key={wo.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-700 transition-colors">
                    {/* Tanggal */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {wo.scheduled_start_date ? (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <div className="font-semibold">
                            {new Date(wo.scheduled_start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="text-gray-400">
                            {new Date(wo.scheduled_start_date).getFullYear()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Work Order + Actions */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link
                        to={`/app/production/work-orders/${wo.id}`}
                        className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {wo.wo_number}
                      </Link>
                      {wo.batch_number && (
                        <div className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                          <TagIcon className="h-3 w-3" />{wo.batch_number}
                        </div>
                      )}
                      {/* Action buttons below WO number */}
                      <div className="flex items-center gap-1 mt-1.5">
                        {/* Primary action */}
                        {canStart && (
                          <button
                            onClick={() => handleStartNow(wo.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                          >
                            <BoltIcon className="h-3 w-3" />Start WO
                          </button>
                        )}
                        {isInProgress && (
                          <Link
                            to={`/app/production/work-orders/${wo.id}/input`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          >
                            <PlayIcon className="h-3 w-3" />Input
                          </Link>
                        )}
                        {isInProgress && (
                          <button
                            onClick={() => handleStatusChange(wo.id, 'completed')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-green-100 hover:text-green-700 transition-colors"
                          >
                            <CheckCircleIcon className="h-3 w-3" />Selesai
                          </button>
                        )}
                        {/* Secondary actions - icon only */}
                        <Link
                          to={`/app/production/work-orders/${wo.id}`}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Detail"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                        </Link>
                        {(canStart) && (
                          <Link
                            to={`/app/production/work-orders/${wo.id}/edit`}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {wo.status === 'planned' && (
                          <button
                            onClick={() => handleDelete(wo.id, wo.wo_number)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Hapus"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Produk & Mesin */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{wo.product_name}</span>
                        {wo.priority && wo.priority !== 'normal' && (
                          <span className={`inline-flex px-1.5 py-0 rounded text-xs font-semibold ${
                            wo.priority === 'high' || wo.priority === 'urgent'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : wo.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {wo.priority === 'urgent' ? '🔥' : wo.priority === 'high' ? '↑' : ''}{wo.priority}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {wo.machine_name && (
                          <div className="flex items-center gap-0.5">
                            <CogIcon className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">{wo.machine_name}</span>
                          </div>
                        )}
                        {(wo.shift_count ?? 0) > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0 rounded">
                            {wo.shift_count} shift
                          </span>
                        )}
                        {(wo.total_cartons ?? 0) > 0 && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0 rounded">
                            {wo.total_cartons?.toLocaleString()} ctn
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 min-w-[80px]">
                          <div
                            className={`h-1.5 rounded-full transition-all ${progressColor}`}
                            style={{ width: `${Math.max(progressBarWidth, progressNum > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                        <span className={`text-xs w-12 text-right font-medium ${
                          progressNum >= 100 ? 'text-green-600' : progressNum >= 60 ? 'text-yellow-600' : 'text-red-500'
                        }`}>{progress}%</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {wo.quantity_produced.toLocaleString()} / {wo.quantity.toLocaleString()}
                        {progressNum > 100 && <span className="ml-1 text-green-500 font-semibold">↑{(progressNum - 100).toFixed(1)}%</span>}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        <StatusIcon className="h-3 w-3" />
                        {wo.status === 'in_progress' ? 'Running' : wo.status === 'planned' ? 'Planned' : wo.status === 'released' ? 'Released' : wo.status === 'completed' ? 'Done' : wo.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {workOrders.length === 0 && !loading && (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No work orders found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating your first work order
            </p>
            <div className="mt-6">
              <Link to="/app/production/work-orders/new" className="btn-primary">
                <PlusIcon className="h-5 w-5 mr-2" />
                New Work Order
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Activity Log Modal */}
      <ActivityLogModal
        isOpen={showActivityLog}
        onClose={() => setShowActivityLog(false)}
        resourceType="work_order"
        title="Log Aktivitas Work Order"
      />

      {/* Production Output Detail Modal */}
      <ProductionOutputModal
        isOpen={showProductionOutput}
        onClose={() => setShowProductionOutput(false)}
        days={30}
      />
      </>
      )}
    </div>
  )
}

export default WorkOrderList
