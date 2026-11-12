import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useGetEmployeesQuery,
  useGetAttendanceRecordsQuery,
  useGetTrainingSessionsQuery,
  useGetPayrollPeriodsQuery
} from '../../services/api'
import {
  AcademicCapIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  UserPlusIcon,
  DocumentTextIcon,
  CogIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, KpiStrip, QuickLinks } from '../../components/ui/PageKit'
import LoadingSpinner from '../../components/Common/LoadingSpinner'

export default function HRDashboard() {
  const navigate = useNavigate()
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  
  // Fetch data for dashboard. per_page set high (2026-10-07 bugfix) - the
  // API paginates at 50/page by default, and this dashboard used to count
  // off `employees.length` (just the current page) instead of the API's
  // own `total` field, silently undercounting once headcount passed 50.
  // A large per_page also makes the client-side activeEmployees status
  // filter below correct instead of only reflecting page 1.
  const { data: employeesData } = useGetEmployeesQuery({ per_page: 1000 })
  const { data: attendanceData } = useGetAttendanceRecordsQuery({
    start_date: dateFilter,
    end_date: dateFilter
  })
  const { data: trainingsData } = useGetTrainingSessionsQuery({ status: 'ongoing' })
  const { data: payrollData } = useGetPayrollPeriodsQuery({ status: 'processing' })

  // Cuti pending count (2026-09-27: sistem Leave lama dipensiunkan, sumber
  // data pindah ke StaffLeaveRequest - lihat konsolidasi di Sidebar.tsx)
  const [pendingLeaves, setPendingLeaves] = useState(0)
  useEffect(() => {
    axiosInstance.get('/api/staff-leave/pending')
      .then(res => setPendingLeaves(res.data?.pending_count || 0))
      .catch(() => setPendingLeaves(0))
  }, [])

  // Calculate statistics
  const totalEmployees = employeesData?.total ?? employeesData?.employees?.length ?? 0
  const activeEmployees = employeesData?.employees?.filter((emp: any) => emp.status === 'active').length || 0
  const presentToday = attendanceData?.attendances?.filter((att: any) => att.status === 'present').length || 0
  const absentToday = attendanceData?.attendances?.filter((att: any) => att.status === 'absent').length || 0
  const ongoingTrainings = trainingsData?.sessions?.length || 0

  const attendanceRate = activeEmployees > 0 ? ((presentToday / activeEmployees) * 100).toFixed(1) : '0'

  // Quick Stats - gradients (2026-10-07 Axion bento restyle, tier-1 #8 of 17)
  const quickStats = [
    {
      name: 'Karyawan aktif',
      value: activeEmployees,
      icon: UserGroupIcon,
      gradient: 'from-primary-600 to-primary-700',
      subtext: `${totalEmployees} terdaftar`,
      span: true,
    },
    {
      name: 'Kehadiran Hari Ini',
      value: `${attendanceRate}%`,
      icon: ClockIcon,
      gradient: 'from-teal-500 to-teal-600',
      subtext: `${presentToday} hadir`
    },
    {
      name: 'Cuti menunggu',
      value: pendingLeaves,
      icon: CalendarDaysIcon,
      gradient: 'from-cta-500 to-cta-700',
      subtext: 'Menunggu approval'
    },
    {
      name: 'Pelatihan aktif',
      value: ongoingTrainings,
      icon: AcademicCapIcon,
      gradient: 'from-violet-500 to-violet-600',
      subtext: 'Sesi berjalan'
    }
  ]

  // Module Cards
  const moduleCards = [
    {
      title: 'Data Karyawan',
      description: 'Kelola data karyawan, jabatan, dan departemen',
      icon: UserGroupIcon,
      href: '/app/hr/employees',
      gradient: 'from-primary-600 to-primary-700',
      stats: `${activeEmployees} karyawan aktif`
    },
    {
      title: 'Absensi',
      description: 'Pantau kehadiran dan rekam absensi harian',
      icon: ClockIcon,
      href: '/app/hr/attendance',
      gradient: 'from-teal-500 to-teal-600',
      stats: 'Pantau langsung'
    },
    {
      title: 'Manajemen Cuti',
      description: 'Kelola pengajuan dan approval cuti karyawan',
      icon: CalendarDaysIcon,
      href: '/app/hr/staff-leave',
      gradient: 'from-amber-500 to-amber-600',
      stats: `${pendingLeaves} pending`
    },
    {
      title: 'Payroll',
      description: 'Proses penggajian dan slip gaji karyawan',
      icon: BanknotesIcon,
      href: '/app/hr/payroll',
      gradient: 'from-emerald-500 to-emerald-600',
      stats: 'Hitung otomatis'
    },
    {
      title: 'Training',
      description: 'Kelola program training dan pengembangan',
      icon: AcademicCapIcon,
      href: '/app/hr/training',
      gradient: 'from-violet-500 to-violet-600',
      stats: `${ongoingTrainings} sesi aktif`
    },
    {
      title: 'Jadwal Kerja / Roster',
      description: 'Atur jadwal shift dan penugasan karyawan',
      icon: ClipboardDocumentListIcon,
      href: '/app/hr/roster',
      gradient: 'from-pink-500 to-pink-600',
      stats: 'Atur dengan seret'
    },
    {
      title: 'Departemen',
      description: 'Kelola struktur organisasi dan departemen',
      icon: BuildingOfficeIcon,
      href: '/app/hr/departments',
      gradient: 'from-indigo-500 to-indigo-600',
      stats: 'Struktur organisasi'
    },
    {
      title: 'Laporan HR',
      description: 'Laporan absensi, cuti, dan statistik karyawan',
      icon: ChartBarIcon,
      href: '/app/hr/reports',
      gradient: 'from-cta-500 to-cta-700',
      stats: 'Ekspor Excel/PDF'
    }
  ]

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #8 of 17). Sub-pages (Employees, Attendance, Payroll, etc) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader
        title="Dashboard SDM"
        subtitle="Kelola sumber daya manusia perusahaan"
        actions={
          <>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Muat ulang
            </button>
          </>
        }
      />

      <KpiStrip
        items={quickStats.map((st) => ({ label: st.name, value: st.value, hint: st.subtext }))}
      />

      <QuickLinks
        title="Modul SDM"
        links={moduleCards.map((m) => ({ to: m.href, label: `${m.title} - ${m.stats}` }))}
      />

      <QuickLinks
        title="Aksi cepat"
        links={[
          { to: '/app/hr/employees/new', label: 'Tambah karyawan' },
          { to: '/app/hr/attendance', label: 'Rekam absensi' },
          { to: '/app/hr/staff-leave', label: 'Persetujuan cuti' },
          { to: '/app/hr/payroll', label: 'Proses payroll' },
        ]}
      />

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Absensi hari ini</h2>
          <div className="space-y-3">
            {attendanceData?.attendances?.slice(0, 5).map((attendance: any) => (
              <div key={attendance.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <UserGroupIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{attendance.employee.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{attendance.employee.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    attendance.status === 'present' ? 'badge-success' : 
                    attendance.status === 'late' ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {attendance.status}
                  </span>
                  {attendance.clock_in && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(attendance.clock_in).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(!attendanceData?.attendances || attendanceData.attendances.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No attendance records for today</p>
            )}
          </div>
        </div>

        {/* Peringatan dan notifikasi */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Peringatan dan notifikasi</h2>
          <div className="space-y-3">
            {/* Pending Leave Approvals */}
            {pendingLeaves > 0 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg dark:bg-yellow-900/20">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5 dark:text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    {pendingLeaves} leave request{pendingLeaves > 1 ? 's' : ''} pending approval
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">Review and approve employee leave requests</p>
                </div>
              </div>
            )}

            {/* Payroll Processing */}
            {payrollData && payrollData.periods && payrollData.periods.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                <BanknotesIcon className="w-5 h-5 text-blue-600 mt-0.5 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Payroll processing in progress
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {payrollData.periods.length} payroll period{payrollData.periods.length > 1 ? 's' : ''} being processed
                  </p>
                </div>
              </div>
            )}

            {/* Training Sessions */}
            {ongoingTrainings > 0 && (
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg dark:bg-purple-900/20">
                <AcademicCapIcon className="w-5 h-5 text-purple-600 mt-0.5 dark:text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                    {ongoingTrainings} training session{ongoingTrainings > 1 ? 's' : ''} in progress
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">Monitor attendance and progress</p>
                </div>
              </div>
            )}

            {/* High Attendance Rate */}
            {parseFloat(attendanceRate) >= 95 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg dark:bg-green-900/20">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Excellent attendance rate today!
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">{attendanceRate}% attendance rate achieved</p>
                </div>
              </div>
            )}

            {/* No alerts */}
            {pendingLeaves === 0 && ongoingTrainings === 0 && parseFloat(attendanceRate) < 95 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No alerts at this time</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ringkasan absensi</h2>
            <ChartBarIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Present</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${(presentToday / activeEmployees) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{presentToday}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Absent</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${(absentToday / activeEmployees) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{absentToday}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Department Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sebaran karyawan</h2>
            <ChartBarIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Production</span>
              <span className="text-sm font-medium">45%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Quality Control</span>
              <span className="text-sm font-medium">20%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Maintenance</span>
              <span className="text-sm font-medium">15%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Others</span>
              <span className="text-sm font-medium">20%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
