import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import { useGetPayrollPeriodsQuery, useCalculatePayrollMutation } from '../../services/api'
import {
  CalculatorIcon,
  ChartBarIcon as Calculator,
  CheckIcon,
  EyeIcon,
  PlusIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon

} from '@heroicons/react/24/outline';
import { confirmDialog, showSuccess, showError } from '../../components/ui';
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', processing: 'Diproses', completed: 'Selesai', locked: 'Terkunci' }
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('id-ID') : '-')
const rp = (v: any) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`
const COLUMNS: ListColumn<any>[] = [
  { key: 'period_name', label: 'Nama Periode', value: (p) => p.period_name },
  { key: 'start_date', label: 'Mulai', value: (p) => p.start_date, type: 'date' },
  { key: 'end_date', label: 'Selesai', value: (p) => p.end_date, type: 'date' },
  { key: 'status', label: 'Status', value: (p) => p.status, exportValue: (p) => STATUS_LABEL[p.status] || p.status },
  { key: 'total_employees', label: 'Jumlah Karyawan', value: (p) => p.total_employees, type: 'number' },
  { key: 'total_gross_salary', label: 'Gaji Kotor', value: (p) => p.total_gross_salary, type: 'number' },
  { key: 'total_net_salary', label: 'Gaji Bersih', value: (p) => p.total_net_salary, type: 'number' },
  { key: 'processed_at', label: 'Tanggal Diproses', value: (p) => p.processed_at, type: 'date' },
]

export default function PayrollList() {
    const { t } = useLanguage();

const navigate = useNavigate()
  const [selectedStatus, setSelectedStatus] = useState('')
  const { data, isLoading, refetch } = useGetPayrollPeriodsQuery({
    status: selectedStatus || undefined,
    per_page: 1000,
  })
  const tools = useListTools<any>(data?.periods, COLUMNS, { filename: 'Periode_Payroll', initialSort: { key: 'start_date', dir: 'desc' } })
  const [calculatePayroll] = useCalculatePayrollMutation()

  const handleCalculatePayroll = async (periodId: number) => {
    try {
      const result = await calculatePayroll(periodId).unwrap()
      refetch()
      let msg = result?.message || 'Payroll berhasil dihitung!'
      if (result?.summary?.skipped?.length > 0) {
        msg += '\n\nKaryawan dilewati (gaji pokok belum diisi):\n'
        msg += result.summary.skipped.map((s: any) => `- ${s.name}`).join('\n')
      }
      if (result?.summary?.unaccounted_warnings?.length > 0) {
        msg += '\n\nHari tanpa absensi maupun cuti disetujui (cek dulu sebelum approve):\n'
        msg += result.summary.unaccounted_warnings.map((w: any) => `- ${w.name}: ${w.dates.join(', ')}`).join('\n')
      }
      showSuccess(msg)
    } catch (error: any) {
      showError(error?.data?.error || 'Error menghitung payroll')
    }
  }

  const handleApprovePayroll = async (periodId: number) => {
    if (!(await confirmDialog('Setujui payroll untuk periode ini?'))) return
    try {
      const response = await fetch(`/api/hr/payroll/periods/${periodId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        refetch()
        showSuccess('Payroll berhasil disetujui')
      } else {
        showError('Gagal menyetujui payroll')
      }
    } catch (error) {
      showError('Gagal menyetujui payroll')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'badge-secondary',
      processing: 'badge-warning',
      completed: 'badge-success',
      locked: 'badge-info'
    }
    return statusClasses[status as keyof typeof statusClasses] || 'badge-secondary'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/app/hr/payroll/outsourcing-vendors')}
            className="btn-outline inline-flex items-center gap-2 text-sm"
          >
            <BuildingOffice2Icon className="h-4 w-4" />
            Vendor Outsourcing
          </button>
          <button 
            onClick={() => navigate('/app/hr/payroll/piecework-logs')}
            className="btn-outline inline-flex items-center gap-2 text-sm"
          >
            <ClipboardDocumentListIcon className="h-4 w-4" />
            Log Borongan
          </button>
          <button 
            onClick={() => navigate('/app/hr/payroll/periods/new')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Buat Periode Payroll
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.status')}</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input"
            >
              <option value="">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="processing">Diproses</option>
              <option value="completed">Selesai</option>
              <option value="locked">Terkunci</option>
            </select>
          </div>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari periode atau status" />

      {/* Payroll Periods Table */}
      {isLoading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh tools={tools} col="period_name">Nama Periode</SortTh>
                  <SortTh tools={tools} col="start_date">Periode</SortTh>
                  <SortTh tools={tools} col="status">Status</SortTh>
                  <SortTh tools={tools} col="total_employees" align="right">Karyawan</SortTh>
                  <SortTh tools={tools} col="total_gross_salary" align="right">Gaji Kotor</SortTh>
                  <SortTh tools={tools} col="total_net_salary" align="right">Gaji Bersih</SortTh>
                  <SortTh tools={tools} col="processed_at">Tanggal Diproses</SortTh>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tools.rows.map((period: any) => (
                  <tr key={period.id}>
                    <td className="font-medium">{period.period_name}</td>
                    <td>
                      {fmtDate(period.start_date)} - {fmtDate(period.end_date)}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(period.status)}`}>
                        {STATUS_LABEL[period.status] || period.status}
                      </span>
                    </td>
                    <td className="text-right">{period.total_employees}</td>
                    <td className="text-right">{rp(period.total_gross_salary)}</td>
                    <td className="text-right">{rp(period.total_net_salary)}</td>
                    <td>
                      {fmtDate(period.processed_at)}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/app/hr/payroll/periods/${period.id}/records`)}
                          className="btn-sm btn-outline inline-flex items-center gap-1"
                          title="Lihat Data Gaji"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {(period.status === 'draft' || period.status === 'processing') && (
                          <button
                            onClick={() => handleCalculatePayroll(period.id)}
                            className="btn-sm btn-primary inline-flex items-center gap-1"
                            title={period.status === 'processing' ? 'Hitung Ulang' : 'Hitung Payroll'}
                          >
                            <CalculatorIcon className="h-4 w-4" />
                          </button>
                        )}
                        {period.status === 'processing' && (
                          <button
                            onClick={() => handleApprovePayroll(period.id)}
                            className="btn-sm btn-success inline-flex items-center gap-1"
                            title="Setujui Payroll"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
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
