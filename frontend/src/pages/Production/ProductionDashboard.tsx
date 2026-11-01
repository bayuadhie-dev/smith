import { Link } from 'react-router-dom';
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit'
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

  const moduleCards = [
    {
      title: 'SPK',
      description: 'Buat, kelola, dan pantau SPK produksi',
      href: '/app/production/work-orders',
      stats: `${dashboardData?.work_orders.total || 0} perintah kerja`
    },
    {
      title: 'Penjadwalan Produksi',
      description: 'Atur jadwal produksi per mesin',
      href: '/app/production/scheduling',
      stats: 'Penjadwalan per mesin'
    },
    {
      title: 'Data Mesin',
      description: 'Pantau dan kelola mesin produksi',
      href: '/app/production/machines',
      stats: `${dashboardData?.machines.total_active || 0} mesin aktif`
    },
    {
      title: 'Catatan Produksi',
      description: 'Catat output dan mutu produksi harian',
      href: '/app/production/records',
      stats: 'Pencatatan langsung'
    },
    {
      title: 'Pelacakan Efisiensi',
      description: 'Pantau OEE, downtime, dan kinerja',
      href: '/app/production/efficiency',
      stats: 'OEE dan kinerja'
    },
    {
      title: 'Ketertelusuran',
      description: 'Telusuri batch produk dan riwayat produksi',
      href: '/app/production/traceability',
      stats: 'Pelacakan batch penuh'
    },
    {
      title: 'WIP dan Biaya Pekerjaan',
      description: 'Pantau WIP dan analisis biaya pekerjaan',
      href: '/app/production/wip',
      stats: 'Pemantauan WIP langsung'
    },
    {
      title: 'Jadwal Kerja',
      description: 'Jadwal kerja operator, QC, maintenance, dan packing',
      href: '/app/hr/roster',
      stats: 'Jadwal kerja lengkap'
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

  const machineStatusLabel: { [key: string]: string } = {
    running: 'Jalan', idle: 'Siaga', maintenance: 'Perawatan', breakdown: 'Rusak', offline: 'Mati'
  }

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader
        title="Dashboard Produksi"
        subtitle="Pantau dan kelola operasi produksi"
        actions={
          <>
            <button
              onClick={loadDashboardData}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Muat ulang
            </button>
            <Link to="/app/production/work-orders/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">SPK baru</Link>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'SPK aktif', value: dashboardData?.work_orders.active || 0, hint: `${dashboardData?.work_orders.total || 0} total perintah kerja` },
          { label: 'SPK selesai', value: dashboardData?.work_orders.completed || 0 },
          { label: 'Mesin aktif', value: dashboardData?.machines.total_active || 0 },
          { label: 'Mesin jalan', value: dashboardData?.machines.status_breakdown?.running || 0 },
        ]}
      />

      <EfficiencyAlerts />

      {dashboardData?.machines.status_breakdown && (
        <Panel title="Status mesin">
          <dl className="grid grid-cols-2 gap-4 p-4 md:grid-cols-5">
            {Object.entries(dashboardData.machines.status_breakdown).map(([status, count]) => (
              <div key={status} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${getMachineStatusColor(status)}`} />
                  {machineStatusLabel[status] || status}
                </dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{count}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <Panel title="Modul produksi">
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
          {moduleCards.map((module, index) => (
            <li key={index} className="border-b border-gray-100 dark:border-gray-700">
              <Link to={module.href} className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{module.title}</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{module.description}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{module.stats}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

export default ProductionDashboard
