import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import { useGetLeavesQuery, useApproveLeaveMutation, useRejectLeaveMutation, useManagerApproveLeaveMutation } from '../../services/api'
import toast from 'react-hot-toast'
import {
  CheckIcon,
  EyeIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { showSuccess, showError } from '../../components/ui';
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

const STATUS_LABEL: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' }
const TYPE_LABEL: Record<string, string> = { annual: 'Cuti Tahunan', sick: 'Sakit', personal: 'Keperluan Pribadi', maternity: 'Melahirkan', unpaid: 'Tanpa Gaji' }
const MGR_LABEL = (l: any) => (l.required_manager_id ? (l.manager_status === 'approved' ? 'Disetujui' : l.manager_status === 'rejected' ? 'Ditolak' : 'Menunggu') : 'Tidak perlu')
const COLUMNS: ListColumn<any>[] = [
  { key: 'leave_number', label: 'No. Cuti', value: (l) => l.leave_number },
  { key: 'employee_name', label: 'Karyawan', value: (l) => l.employee_name },
  { key: 'leave_type', label: 'Jenis Cuti', value: (l) => l.leave_type, exportValue: (l) => TYPE_LABEL[l.leave_type] || l.leave_type },
  { key: 'start_date', label: 'Mulai', value: (l) => l.start_date, type: 'date' },
  { key: 'end_date', label: 'Sampai', value: (l) => l.end_date, type: 'date' },
  { key: 'total_days', label: 'Hari', value: (l) => l.total_days, type: 'number' },
  { key: 'reason', label: 'Alasan', value: (l) => l.reason },
  { key: 'manager', label: 'Persetujuan Manager', value: (l) => MGR_LABEL(l) },
  { key: 'status', label: 'Status', value: (l) => l.status, exportValue: (l) => STATUS_LABEL[l.status] || l.status },
  { key: 'approved_by', label: 'Disetujui Oleh', value: (l) => l.approved_by },
]
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('id-ID') : '')

export default function LeaveManagement() {
    const { t } = useLanguage();

const navigate = useNavigate()
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedType, setSelectedType] = useState('')
  
  const { data, isLoading, refetch } = useGetLeavesQuery({
    status: selectedStatus || undefined,
    leave_type: selectedType || undefined
  })
  
  const visibleLeaves = (data?.leaves || []).filter((l: any) => (!selectedStatus || l.status === selectedStatus) && (!selectedType || l.leave_type === selectedType))
  const tools = useListTools<any>(visibleLeaves, COLUMNS, { filename: 'Cuti', initialSort: { key: 'start_date', dir: 'desc' } })

  const [approveLeave] = useApproveLeaveMutation()
  const [rejectLeave] = useRejectLeaveMutation()
  const [managerApproveLeave] = useManagerApproveLeaveMutation()

  const handleManagerApprove = async (leaveId: number, decision: 'approved' | 'rejected') => {
    try {
      await managerApproveLeave({ leaveId, decision }).unwrap()
      refetch()
      toast.success(decision === 'approved' ? 'Disetujui sebagai manager' : 'Ditolak sebagai manager')
    } catch (error: any) {
      toast.error(error?.data?.error || 'Gagal memproses approval manager')
    }
  }

  const handleApprove = async (leaveId: number) => {
    try {
      await approveLeave(leaveId).unwrap()
      refetch()
      showSuccess('Cuti berhasil disetujui')
    } catch (error) {
      showError('Gagal menyetujui cuti')
    }
  }

  const handleReject = async (leaveId: number) => {
    const reason = prompt('Isi alasan penolakan:')
    if (!reason) return
    
    try {
      await rejectLeave({ leaveId, rejection_reason: reason }).unwrap()
      refetch()
      showSuccess('Cuti berhasil ditolak')
    } catch (error) {
      showError('Gagal menolak cuti')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger',
      cancelled: 'badge-secondary'
    }
    return statusClasses[status as keyof typeof statusClasses] || 'badge-secondary'
  }

  const getTypeBadge = (type: string) => {
    const typeClasses = {
      annual: 'badge-info',
      sick: 'badge-warning',
      personal: 'badge-secondary',
      maternity: 'badge-success',
      unpaid: 'badge-danger'
    }
    return typeClasses[type as keyof typeof typeClasses] || 'badge-secondary'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cuti</h1>
        <button 
          onClick={() => navigate('/app/hr/leaves/new')}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Ajukan Cuti
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.status')}</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input"
            >
              <option value="">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Jenis Cuti
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input"
            >
              <option value="">Semua Jenis</option>
              <option value="annual">Cuti Tahunan</option>
              <option value="sick">Sakit</option>
              <option value="personal">Keperluan Pribadi</option>
              <option value="maternity">Melahirkan</option>
              <option value="unpaid">Tanpa Gaji</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="btn-outline w-full"
            >{t('common.filter')}</button>
          </div>
        </div>
      </div>

      {/* Leave Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center dark:bg-yellow-900/30">
                <CheckIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Menunggu</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
                {data?.leaves?.filter((l: any) => l.status === 'pending').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center dark:bg-green-900/30">
                <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Disetujui</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                {data?.leaves?.filter((l: any) => l.status === 'approved').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/30">
                <XMarkIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Ditolak</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-200">
                {data?.leaves?.filter((l: any) => l.status === 'rejected').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center dark:bg-blue-900/30">
                <EyeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Hari</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {data?.leaves?.reduce((sum: number, l: any) => sum + l.total_days, 0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor cuti, karyawan, atau alasan" />

      {/* Leave Requests Table */}
      {isLoading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh tools={tools} col="leave_number">No. Cuti</SortTh>
                  <SortTh tools={tools} col="employee_name">Karyawan</SortTh>
                  <SortTh tools={tools} col="leave_type">Jenis Cuti</SortTh>
                  <SortTh tools={tools} col="start_date">Periode</SortTh>
                  <SortTh tools={tools} col="total_days">Hari</SortTh>
                  <SortTh tools={tools} col="reason">Alasan</SortTh>
                  <SortTh tools={tools} col="manager">Persetujuan Manager</SortTh>
                  <SortTh tools={tools} col="status">Status</SortTh>
                  <SortTh tools={tools} col="approved_by">Disetujui Oleh</SortTh>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tools.rows.map((leave: any) => (
                  <tr key={leave.id}>
                    <td className="font-medium">{leave.leave_number}</td>
                    <td>
                      <div className="font-medium">{leave.employee_name}</div>
                    </td>
                    <td>
                      <span className={`badge ${getTypeBadge(leave.leave_type)}`}>
                        {TYPE_LABEL[leave.leave_type] || leave.leave_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div>{fmtDate(leave.start_date)}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          s/d {fmtDate(leave.end_date)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium">{leave.total_days}</span> hari
                    </td>
                    <td>
                      <div className="max-w-xs truncate" title={leave.reason}>
                        {leave.reason}
                      </div>
                    </td>
                    <td>
                      {leave.required_manager_id ? (
                        <div className="text-sm">
                          <div>{leave.required_manager_name}</div>
                          <span className={`badge ${leave.manager_status === 'approved' ? 'badge-success' : leave.manager_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                            {leave.manager_status === 'approved' ? 'Disetujui' : leave.manager_status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Tidak perlu</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(leave.status)}`}>
                        {STATUS_LABEL[leave.status] || leave.status}
                      </span>
                    </td>
                    <td>
                      {leave.approved_by ? (
                        <div>
                          <div className="font-medium">{leave.approved_by}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {fmtDate(leave.approved_at)}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn-sm btn-outline inline-flex items-center gap-1"
                          title="Lihat Detail"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {leave.status === 'pending' && leave.manager_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleManagerApprove(leave.id, 'approved')}
                              className="btn-sm btn-outline inline-flex items-center gap-1"
                              title="Approve sebagai Manager Departemen"
                            >
                              <CheckIcon className="h-4 w-4" /> Manager
                            </button>
                            <button
                              onClick={() => handleManagerApprove(leave.id, 'rejected')}
                              className="btn-sm btn-danger inline-flex items-center gap-1"
                              title="Tolak sebagai Manager"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {leave.status === 'pending' && leave.manager_status !== 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(leave.id)}
                              className="btn-sm btn-success inline-flex items-center gap-1"
                              title="Setujui Cuti (Final)"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleReject(leave.id)}
                              className="btn-sm btn-danger inline-flex items-center gap-1"
                              title="Tolak Cuti"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
