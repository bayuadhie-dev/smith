import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import { useGetAttendanceRecordsQuery, useClockInMutation, useClockOutMutation, useBulkMarkAttendanceMutation } from '../../services/api'
import {
  CalendarIcon,
  ClockIcon,
  UserGroupIcon

} from '@heroicons/react/24/outline';
import { showSuccess, showError, showInfo } from '../../components/ui';
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'
import { TableSkeleton } from '../../components/ui/Skeleton'

const STATUS_LABEL: Record<string, string> = { present: 'Hadir', absent: 'Tidak hadir', late: 'Terlambat', half_day: 'Setengah hari' }
const clock = (v?: string | null) => (v ? new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')
const COLUMNS: ListColumn<any>[] = [
  { key: 'name', label: 'Karyawan', value: (a) => a.employee.full_name },
  { key: 'nik', label: 'NIK', value: (a) => a.employee.employee_number },
  { key: 'department', label: 'Departemen', value: (a) => a.employee.department },
  { key: 'shift', label: 'Shift', value: (a) => a.shift?.name, exportValue: (a) => (a.shift ? `${a.shift.name} (${a.shift.start_time}-${a.shift.end_time})` : '') },
  { key: 'clock_in', label: 'Jam Masuk', value: (a) => a.clock_in, exportValue: (a) => clock(a.clock_in), type: 'date' },
  { key: 'clock_out', label: 'Jam Pulang', value: (a) => a.clock_out, exportValue: (a) => clock(a.clock_out), type: 'date' },
  { key: 'worked_hours', label: 'Jam Kerja', value: (a) => a.worked_hours, type: 'number' },
  { key: 'overtime_hours', label: 'Lembur (jam)', value: (a) => a.overtime_hours, type: 'number' },
  { key: 'status', label: 'Status', value: (a) => a.status, exportValue: (a) => STATUS_LABEL[a.status] || a.status },
]

export default function AttendanceManagement() {
    const { t } = useLanguage();

const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  
  const { data, isLoading, refetch } = useGetAttendanceRecordsQuery({
    start_date: selectedDate,
    end_date: selectedDate,
    per_page: 1000,
    department_id: selectedDepartment || undefined,
    employee_id: selectedEmployee || undefined
  })
  
  const tools = useListTools<any>(data?.attendances, COLUMNS, { filename: `Absensi_${selectedDate}`, initialSort: { key: 'name' } })

  const [clockIn] = useClockInMutation()
  const [clockOut] = useClockOutMutation()
  const [bulkMarkAttendance] = useBulkMarkAttendanceMutation()

  const handleClockIn = async (employeeId: number) => {
    try {
      await clockIn({ employee_id: employeeId }).unwrap()
      refetch()
      showSuccess('Clock in berhasil')
    } catch (error) {
      showError('Gagal clock in')
    }
  }

  const handleClockOut = async (employeeId: number) => {
    try {
      await clockOut({ employee_id: employeeId }).unwrap()
      refetch()
      showSuccess('Clock out berhasil')
    } catch (error) {
      showError('Gagal clock out')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      present: 'badge-success',
      absent: 'badge-danger',
      late: 'badge-warning',
      half_day: 'badge-info'
    }
    return statusClasses[status as keyof typeof statusClasses] || 'badge-secondary'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Management</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => showInfo('Bulk Mark Attendance feature - Coming Soon!')}
            className="btn-outline inline-flex items-center gap-2"
          >
            <UserGroupIcon className="h-5 w-5" />
            Bulk Mark
          </button>
          <button 
            onClick={() => navigate('/app/reports?module=attendance')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <CalendarIcon className="h-5 w-5" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.date')}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="input"
            >
              <option value="">Semua Departemen</option>
              <option value="1">{t('navigation.production')}</option>
              <option value="2">Quality Control</option>
              <option value="3">{t('navigation.maintenance')}</option>
              <option value="4">{t('navigation.warehouse')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="input"
            >
              <option value="">Semua Karyawan</option>
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

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center dark:bg-green-900/30">
                <ClockIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Hadir</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                {data?.attendances?.filter((a: any) => a.status === 'present').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/30">
                <ClockIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Tidak hadir</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-200">
                {data?.attendances?.filter((a: any) => a.status === 'absent').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center dark:bg-yellow-900/30">
                <ClockIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Terlambat</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
                {data?.attendances?.filter((a: any) => a.status === 'late').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center dark:bg-blue-900/30">
                <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Setengah hari</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {data?.attendances?.filter((a: any) => a.status === 'half_day').length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari karyawan, NIK, atau departemen" />

      {/* Attendance Records Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh tools={tools} col="name">Karyawan</SortTh>
                  <SortTh tools={tools} col="department">Departemen</SortTh>
                  <SortTh tools={tools} col="shift">Shift</SortTh>
                  <SortTh tools={tools} col="clock_in">Jam Masuk</SortTh>
                  <SortTh tools={tools} col="clock_out">Jam Pulang</SortTh>
                  <SortTh tools={tools} col="worked_hours">Jam Kerja</SortTh>
                  <SortTh tools={tools} col="overtime_hours">Lembur</SortTh>
                  <SortTh tools={tools} col="status">Status</SortTh>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tools.rows.map((attendance: any) => (
                  <tr key={attendance.id}>
                    <td>
                      <div>
                        <div className="font-medium">{attendance.employee.full_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{attendance.employee.employee_number}</div>
                      </div>
                    </td>
                    <td>{attendance.employee.department || '-'}</td>
                    <td>
                      {attendance.shift ? (
                        <div>
                          <div className="font-medium">{attendance.shift.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {attendance.shift.start_time} - {attendance.shift.end_time}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {attendance.clock_in 
                        ? new Date(attendance.clock_in).toLocaleTimeString()
                        : '-'
                      }
                    </td>
                    <td>
                      {attendance.clock_out 
                        ? new Date(attendance.clock_out).toLocaleTimeString()
                        : '-'
                      }
                    </td>
                    <td>{attendance.worked_hours} jam</td>
                    <td>{attendance.overtime_hours} jam</td>
                    <td>
                      <span className={`badge ${getStatusBadge(attendance.status)}`}>
                        {STATUS_LABEL[attendance.status] || attendance.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {!attendance.clock_in && (
                          <button
                            onClick={() => handleClockIn(attendance.employee.id)}
                            className="btn-sm btn-success"
                          >
                            Clock In
                          </button>
                        )}
                        {attendance.clock_in && !attendance.clock_out && (
                          <button
                            onClick={() => handleClockOut(attendance.employee.id)}
                            className="btn-sm btn-warning"
                          >
                            Clock Out
                          </button>
                        )}
                        <button className="btn-sm btn-outline">{t('common.edit')}</button>
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
