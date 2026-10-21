import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  CogIcon,
  CurrencyDollarIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  PauseIcon,
  PlayIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import LoadingSpinner from '../../components/Common/LoadingSpinner'
import EfficiencyAlerts from '../../components/Production/EfficiencyAlerts'

interface DashboardData {
  work_orders: {
    total: number
    active: number
    completed: number
  }
  machines: {
    total_active: number
    status_breakdown: { [key: string]: number }
  }
}

const ProductionDashboard = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const response = await axiosInstance.get('/api/production/dashboard/summary')
      setDashboardData(response.data)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #2 of 4 - see Dashboard/DashboardEnhanced.tsx for the reference
  // pattern this replicates: gradient hero KPI row, rounded-2xl white
  // content cards, icon badges on gradient squares). Sub-pages reached
  // FROM here (Work Orders list, Machine list, etc) are intentionally
  // left as-is ("materialized") - only true module-landing dashboards
  // are in scope for the bento treatment.
  const moduleCards = [
    {
      title: 'SPK',
      description: 'Create, manage and track production SPK',
      icon: ClipboardDocumentListIcon,
      href: '/app/production/work-orders',
      gradient: 'from-[#059669] to-[#047857]',
      stats: `${dashboardData?.work_orders.total || 0} total orders`
    },
    {
      title: 'Production Scheduling',
      description: 'Schedule and optimize machine production slots',
      icon: CalendarDaysIcon,
      href: '/app/production/scheduling',
      gradient: 'from-teal-500 to-teal-600',
      stats: 'Smart scheduling system'
    },
    {
      title: 'Machine Data',
      description: 'Monitor and manage production machines',
      icon: CogIcon,
      href: '/app/production/machines',
      gradient: 'from-violet-500 to-violet-600',
      stats: `${dashboardData?.machines.total_active || 0} active machines`
    },
    {
      title: 'Production Records',
      description: 'Track daily production output and quality',
      icon: ChartBarIcon,
      href: '/app/production/records',
      gradient: 'from-[#F15D2C] to-[#C73E1D]',
      stats: 'Real-time tracking'
    },
    {
      title: 'Efficiency Tracking',
      description: 'Monitor OEE, downtime and performance metrics',
      icon: ChartBarIcon,
      href: '/app/production/efficiency',
      gradient: 'from-amber-500 to-amber-600',
      stats: 'OEE & Performance'
    },
    {
      title: 'Traceability',
      description: 'Track product batches and production history',
      icon: DocumentMagnifyingGlassIcon,
      href: '/app/production/traceability',
      gradient: 'from-sky-500 to-sky-600',
      stats: 'Full batch tracking'
    },
    {
      title: 'WIP & Job Costing',
      description: 'Work in Progress tracking and job cost analysis',
      icon: CurrencyDollarIcon,
      href: '/app/production/wip',
      gradient: 'from-emerald-500 to-emerald-600',
      stats: 'Real-time WIP monitoring'
    },
    {
      title: 'Work Roster',
      description: 'Jadwal kerja operator, QC, maintenance, dan packing',
      icon: UserGroupIcon,
      href: '/app/hr/roster',
      gradient: 'from-pink-500 to-pink-600',
      stats: 'Manajemen jadwal lengkap'
    }
  ]

  const getMachineStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-emerald-500'
      case 'idle': return 'bg-amber-500'
      case 'maintenance': return 'bg-sky-500'
      case 'breakdown': return 'bg-red-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getMachineStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return PlayIcon
      case 'idle': return PauseIcon
      case 'maintenance': return WrenchScrewdriverIcon
      case 'breakdown': return ExclamationTriangleIcon
      default: return CogIcon
    }
  }

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Dashboard Produksi</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Monitor and manage your production operations</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      {/* Key Metrics - bento: Active SPK spans 2 cols (primary metric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-2 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <PlayIcon className="w-5 h-5" />
            </div>
            <p className="text-sm opacity-90">Active SPK</p>
          </div>
          <p className="text-3xl font-bold">{dashboardData?.work_orders.active || 0}</p>
          <p className="text-xs opacity-75 mt-1">{dashboardData?.work_orders.total || 0} total orders</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Completed Orders</p>
          <p className="text-2xl font-bold">{dashboardData?.work_orders.completed || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <CogIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Active Machines</p>
          <p className="text-2xl font-bold">{dashboardData?.machines.total_active || 0}</p>
        </div>
      </div>

      {/* Running Machines - standalone accent card */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <WrenchScrewdriverIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Running Machines</p>
          <p className="text-2xl font-bold">{dashboardData?.machines.status_breakdown?.running || 0}</p>
        </div>

        {/* Efficiency Alerts - spans remaining width */}
        <div className="md:col-span-1 xl:col-span-3">
          <EfficiencyAlerts />
        </div>
      </div>

      {/* Machine Status Overview */}
      {dashboardData?.machines.status_breakdown && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Machine Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(dashboardData.machines.status_breakdown).map(([status, count]) => {
              const StatusIcon = getMachineStatusIcon(status)
              return (
                <div key={status} className="flex items-center space-x-3">
                  <div className={`${getMachineStatusColor(status)} p-2 rounded-lg`}>
                    <StatusIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">{status}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Production Modules - bento grid of gradient-icon cards */}
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Production Modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/app/production/work-orders/new"
            className="px-4 py-2 bg-gradient-to-br from-[#059669] to-[#047857] text-white rounded-lg hover:shadow-lg transition-shadow font-medium text-sm"
          >
            + New SPK
          </Link>
          <Link
            to="/app/production/scheduling"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-white"
          >
            📅 View Schedule
          </Link>
          <Link
            to="/app/production/machines"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-white"
          >
            🔧 Machine Status
          </Link>
          <Link
            to="/app/production/records"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-white"
          >
            📊 Production Records
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ProductionDashboard
