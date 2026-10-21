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
      name: 'Total Karyawan',
      value: activeEmployees,
      icon: UserGroupIcon,
      gradient: 'from-[#059669] to-[#047857]',
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
      name: 'Cuti Pending',
      value: pendingLeaves,
      icon: CalendarDaysIcon,
      gradient: 'from-[#F15D2C] to-[#C73E1D]',
      subtext: 'Menunggu approval'
    },
    {
      name: 'Training Aktif',
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
      gradient: 'from-[#059669] to-[#047857]',
      stats: `${activeEmployees} karyawan aktif`
    },
    {
      title: 'Absensi',
      description: 'Pantau kehadiran dan rekam absensi harian',
      icon: ClockIcon,
      href: '/app/hr/attendance',
      gradient: 'from-teal-500 to-teal-600',
      stats: 'Real-time tracking'
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
      stats: 'Kalkulasi otomatis'
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
      stats: 'Drag & drop roster'
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
      gradient: 'from-[#F15D2C] to-[#C73E1D]',
      stats: 'Export Excel/PDF'
    }
  ]

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #8 of 17). Sub-pages (Employees, Attendance, Payroll, etc) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Dashboard HR</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Kelola sumber daya manusia perusahaan</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats - bento: Total Karyawan spans 2 cols (primary metric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.span ? 'xl:col-span-2' : ''} bg-gradient-to-br ${stat.gradient} rounded-xl p-4 text-white shadow-lg`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-sm opacity-90">{stat.name}</p>
            </div>
            <p className={stat.span ? 'text-3xl font-bold' : 'text-2xl font-bold'}>{stat.value}</p>
            <p className="text-xs opacity-75 mt-1">{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* HR Modules */}
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Modul HR</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {moduleCards.map((module, index) => (
            <Link
              key={index}
              to={module.href}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-5 group"
            >
              <div className="flex items-start space-x-4">
                <div className={`bg-gradient-to-br ${module.gradient} p-3 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <module.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {module.title}
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{module.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{module.stats}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Aksi Cepat</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/app/hr/employees/new" className="btn-primary flex items-center gap-2">
            <UserPlusIcon className="h-4 w-4" />
            Tambah Karyawan
          </Link>
          <Link to="/app/hr/attendance" className="btn-secondary flex items-center gap-2">
            <ClockIcon className="h-4 w-4" />
            Rekam Absensi
          </Link>
          <Link to="/app/hr/staff-leave" className="btn-secondary flex items-center gap-2">
            <CalendarDaysIcon className="h-4 w-4" />
            Approval Cuti
          </Link>
          <Link to="/app/hr/payroll" className="btn-secondary flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4" />
            Proses Payroll
          </Link>
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Attendance</h2>
          <div className="space-y-3">
            {attendanceData?.attendances?.slice(0, 5).map((attendance: any) => (
              <div key={attendance.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
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

        {/* Alerts & Notifications */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Alerts & Notifications</h2>
          <div className="space-y-3">
            {/* Pending Leave Approvals */}
            {pendingLeaves > 0 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {pendingLeaves} leave request{pendingLeaves > 1 ? 's' : ''} pending approval
                  </p>
                  <p className="text-xs text-yellow-700">Review and approve employee leave requests</p>
                </div>
              </div>
            )}

            {/* Payroll Processing */}
            {payrollData && payrollData.periods && payrollData.periods.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <BanknotesIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Payroll processing in progress
                  </p>
                  <p className="text-xs text-blue-700">
                    {payrollData.periods.length} payroll period{payrollData.periods.length > 1 ? 's' : ''} being processed
                  </p>
                </div>
              </div>
            )}

            {/* Training Sessions */}
            {ongoingTrainings > 0 && (
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <AcademicCapIcon className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-purple-800">
                    {ongoingTrainings} training session{ongoingTrainings > 1 ? 's' : ''} in progress
                  </p>
                  <p className="text-xs text-purple-700">Monitor attendance and progress</p>
                </div>
              </div>
            )}

            {/* High Attendance Rate */}
            {parseFloat(attendanceRate) >= 95 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Excellent attendance rate today!
                  </p>
                  <p className="text-xs text-green-700">{attendanceRate}% attendance rate achieved</p>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance Overview</h2>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Employee Distribution</h2>
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
