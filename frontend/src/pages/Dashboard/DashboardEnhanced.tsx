import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGetExecutiveDashboardQuery } from '../../services/api'
import { formatRupiah } from '../../utils/currencyUtils'
import axiosInstance from '../../utils/axiosConfig'
import { useQuery } from '@tanstack/react-query'
import { Zap, Package, TrendingUp as TrendUp } from 'lucide-react'
import ProductionOutputModal from '../../components/Production/ProductionOutputModal'
import WelcomeBanner from '../../components/ui/WelcomeBanner'
import {
  LineChart, Line, Bar, ComposedChart,
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChartBarIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  SignalIcon,
  BanknotesIcon,
  BeakerIcon,
  TruckIcon,
  TrophyIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface ActiveUsersData {
  active_users: Array<{
    id: number
    username: string
    full_name: string
    role: string
    last_activity: string
    time_since_activity_seconds: number
    time_since_activity_formatted: string
    is_idle: boolean
  }>
  offline_users: Array<{
    id: number
    username: string
    full_name: string
    role: string
    last_activity: string
    time_since_activity_seconds: number
    time_since_activity_formatted: string
    is_idle: boolean
  }>
  active_count: number
  total_users: number
  offline_count: number
}

export default function DashboardEnhanced() {
  const navigate = useNavigate()
  const { data: executiveData, isLoading, refetch } = useGetExecutiveDashboardQuery({})
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeUsers, setActiveUsers] = useState<ActiveUsersData | null>(null)
  const [showProductionOutput, setShowProductionOutput] = useState(false)
  const [dateRange] = useState('30')

  // Fetch trends data for production chart
  const { data: trends } = useQuery({
    queryKey: ['executive-trends', dateRange],
    queryFn: () => axiosInstance.get(`/api/executive/trends?days=${dateRange}`).then(res => res.data.data),
    enabled: true
  })

  // Fetch top performers (products)
  const { data: performers } = useQuery({
    queryKey: ['executive-performers', dateRange],
    queryFn: () => axiosInstance.get(`/api/executive/top-performers?days=${dateRange}`).then(res => res.data.data),
    enabled: true
  })

  // Fetch KPI performance scorecard (actual vs target, last 30 days)
  const { data: scorecard } = useQuery({
    queryKey: ['executive-scorecard'],
    queryFn: () => axiosInstance.get('/api/executive/performance-scorecard').then(res => res.data.data),
    enabled: true
  })

  // Fetch recent real activity (audit log)
  const { data: activityLogs } = useQuery({
    queryKey: ['executive-audit-logs'],
    queryFn: () => axiosInstance.get('/api/executive/real-audit-logs').then(res => res.data.logs),
    enabled: true,
    refetchInterval: 60000
  })

  // Fetch product margin (Omzet) - HPP material (dari BOM) vs harga jual
  const { data: marginData } = useQuery({
    queryKey: ['executive-product-margin'],
    queryFn: () => axiosInstance.get('/api/executive/product-margin').then(res => res.data.data),
    enabled: true
  })

  // Fetch active users from executive dashboard
  const fetchActiveUsers = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/api/executive/active-users')
      if (response.data.success) {
        const users = response.data.data.users || []
        const onlineUsers = users.filter((u: any) => u.status === 'online')
        const offlineUsers = users.filter((u: any) => u.status === 'offline' || u.status === 'never' || u.status === 'recent')

        setActiveUsers({
          active_users: onlineUsers.map((u: any) => ({
            id: u.id,
            username: u.username,
            full_name: u.full_name,
            role: u.roles?.[0] || 'User',
            last_activity: u.last_login || new Date().toISOString(),
            time_since_activity_seconds: 0,
            time_since_activity_formatted: u.time_ago || 'Just now',
            is_idle: false
          })),
          offline_users: offlineUsers.map((u: any) => ({
            id: u.id,
            username: u.username,
            full_name: u.full_name,
            role: u.roles?.[0] || 'User',
            last_activity: u.last_login || new Date().toISOString(),
            time_since_activity_seconds: 0,
            time_since_activity_formatted: u.time_ago || 'Never',
            is_idle: u.status === 'recent'
          })),
          active_count: onlineUsers.length,
          total_users: users.length,
          offline_count: offlineUsers.length
        })
      }
    } catch (error) {
      console.error('Error fetching active users:', error)
    }
  }, [])

  // Send heartbeat to chat system (for online status)
  const sendHeartbeat = useCallback(async () => {
    try {
      await axiosInstance.post('/api/chat/heartbeat')
    } catch (error) {
      console.error('Error sending heartbeat:', error)
    }
  }, [])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch active users on mount and every 30 seconds
  useEffect(() => {
    fetchActiveUsers()
    const interval = setInterval(fetchActiveUsers, 30000)
    return () => clearInterval(interval)
  }, [fetchActiveUsers])

  // Send heartbeat every 2 minutes
  useEffect(() => {
    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sendHeartbeat])

  // Auto-refresh dashboard every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => refetch(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refetch])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F15D2C]"></div>
      </div>
    )
  }

  const criticalIssues = executiveData?.critical_issues || []
  const salesTrend = executiveData?.trends?.sales || []

  // Module shortcuts - covers the hub modules (Production/Warehouse/Sales/Finance/HR/Quality)
  // plus other high-traffic modules. Cards without a reliable live-stat field intentionally
  // show no number rather than a fabricated one.
  const moduleCards = [
    { name: 'Production', href: '/app/production', icon: CogIcon, color: 'blue', stat: executiveData?.production?.active_work_orders, label: 'Active SPK' },
    { name: 'Sales', href: '/app/sales', icon: ShoppingCartIcon, color: 'green', stat: executiveData?.customers?.active_customers, label: 'Active customers' },
    { name: 'Purchasing', href: '/app/purchasing', icon: BuildingStorefrontIcon, color: 'orange', stat: executiveData?.purchasing?.pending_orders, label: 'Pending orders' },
    { name: 'Warehouse', href: '/app/warehouse', icon: CubeIcon, color: 'purple', stat: executiveData?.inventory?.low_stock_items, label: 'Low stock items' },
    { name: 'Quality', href: '/app/quality', icon: CheckCircleIcon, color: 'teal', stat: executiveData?.quality?.pass_rate, statSuffix: '%', label: 'Pass rate' },
    { name: 'Finance', href: '/app/finance', icon: BanknotesIcon, color: 'emerald', stat: executiveData?.financial?.outstanding_invoices, label: 'Outstanding invoices' },
    { name: 'Human Resources', href: '/app/hr', icon: UsersIcon, color: 'indigo', stat: executiveData?.hr?.total_employees, label: 'Total employees' },
    { name: 'Maintenance', href: '/app/maintenance', icon: WrenchScrewdriverIcon, color: 'red', stat: executiveData?.maintenance?.overdue, label: 'Overdue tasks' },
    { name: 'OEE Monitoring', href: '/app/oee', icon: ChartBarIcon, color: 'amber', stat: executiveData?.oee?.average_oee, statSuffix: '%', label: 'Average OEE' },
    { name: 'Shipping', href: '/app/shipping', icon: TruckIcon, color: 'sky', label: 'Delivery & logistics' },
    { name: 'R&D', href: '/app/rnd', icon: BeakerIcon, color: 'violet', label: 'Research projects' },
    { name: 'Document Control', href: '/app/dcc', icon: DocumentTextIcon, color: 'pink', label: 'Manage documents' },
  ] as Array<{
    name: string
    href: string
    icon: typeof CogIcon
    color: string
    stat?: number
    statSuffix?: string
    label: string
  }>

  const colorClasses: Record<string, { border: string; bg: string; text: string }> = {
    blue: { border: 'border-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    green: { border: 'border-green-500', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
    teal: { border: 'border-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },
    emerald: { border: 'border-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
    indigo: { border: 'border-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
    red: { border: 'border-red-500', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
    sky: { border: 'border-sky-500', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-600 dark:text-sky-400' },
    violet: { border: 'border-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400' },
    pink: { border: 'border-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },
  }

  return (
    <div className="space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <WelcomeBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {currentTime.toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} • {currentTime.toLocaleTimeString('id-ID')}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-900 dark:text-white"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Critical Alerts - most urgent, shown first */}
      {criticalIssues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 dark:text-red-400 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Critical Issues Detected</h3>
              <div className="space-y-1">
                {criticalIssues.slice(0, 3).map((issue, index) => (
                  <p key={index} className="text-sm text-red-700 dark:text-red-400">
                    <span className="font-medium">{issue.module}:</span> {issue.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Sales Today */}
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <ShoppingCartIcon className="w-6 h-6" />
            </div>
            {(executiveData?.financial?.revenue_growth || 0) >= 0 ? (
              <ArrowUpIcon className="w-5 h-5" />
            ) : (
              <ArrowDownIcon className="w-5 h-5" />
            )}
          </div>
          <p className="text-sm opacity-90 mb-1">Sales Today</p>
          <p className="text-3xl font-bold mb-2">
            {formatRupiah(executiveData?.financial?.sales_today || 0)}
          </p>
          <p className="text-sm opacity-75">
            {executiveData?.financial?.revenue_growth || 0}% from yesterday
          </p>
        </div>

        {/* Production Output - Clickable */}
        <div
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300"
          onClick={() => setShowProductionOutput(true)}
          title="Klik untuk lihat detail per mesin & produk"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <Zap className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Production Output</p>
          <p className="text-3xl font-bold mb-2">
            {(executiveData?.production?.output || 0).toLocaleString()}
          </p>
          <p className="text-sm opacity-75">
            {executiveData?.production?.avg_oee || 0}% avg OEE • Click for details
          </p>
        </div>

        {/* Quality Pass Rate */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <CheckCircleIcon className="w-6 h-6" />
            </div>
            <CheckCircleIcon className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Quality Pass Rate</p>
          <p className="text-3xl font-bold mb-2">
            {executiveData?.quality?.pass_rate || 0}%
          </p>
          <p className="text-sm opacity-75">
            {executiveData?.quality?.inspections_today || 0} inspections today
          </p>
        </div>

        {/* OEE Average */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <ChartBarIcon className="w-6 h-6" />
            </div>
            <ChartBarIcon className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Average OEE</p>
          <p className="text-3xl font-bold mb-2">
            {executiveData?.oee?.average_oee || 0}%
          </p>
          <p className="text-sm opacity-75">
            {executiveData?.oee?.machine_utilization || 0}% utilization
          </p>
        </div>
      </div>

      {/* Performance Scorecard - actual vs target per KPI, last 30 days */}
      {scorecard && scorecard.kpis?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl">
                <TrophyIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Performance Scorecard</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Actual vs target, last 30 days</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{scorecard.overall_score}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Overall score</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {scorecard.kpis.map((kpi: any) => {
              const statusStyle = kpi.status === 'good'
                ? { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', bar: 'bg-green-500' }
                : kpi.status === 'warning'
                  ? { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', bar: 'bg-amber-500' }
                  : { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', bar: 'bg-red-500' }
              const displayActual = kpi.unit === 'IDR' ? formatRupiah(kpi.actual) : `${kpi.actual}${kpi.unit}`
              const displayTarget = kpi.unit === 'IDR' ? formatRupiah(kpi.target) : `${kpi.target}${kpi.unit}`
              return (
                <div key={kpi.kpi_code} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusStyle.badge}`}>
                      {kpi.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{kpi.category}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{kpi.kpi_name}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">{displayActual}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Target: {displayTarget}</p>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusStyle.bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, kpi.achievement))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{kpi.achievement}% of target</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Omzet & Margin Produk - HPP (material dari BOM) vs Harga Jual */}
      {marginData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                <BanknotesIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Omzet &amp; Margin Produk</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">HPP material (dari BOM) vs harga jual</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{marginData.summary.produk_data_lengkap}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">dari {marginData.summary.total_produk_ada_bom} produk siap dihitung</p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-800 dark:text-amber-300">{marginData.summary.catatan}</p>
          </div>

          {marginData.summary.produk_data_lengkap === 0 ? (
            <div className="text-center py-10">
              <BanknotesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Belum ada produk dengan data harga jual &amp; HPP lengkap</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tabel margin akan otomatis terisi begitu harga jual disinkronkan dari Accurate Online.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4">Produk</th>
                    <th className="pb-2 pr-4 text-right">HPP Material</th>
                    <th className="pb-2 pr-4 text-right">Harga Jual</th>
                    <th className="pb-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {marginData.rows.filter((r: any) => r.status === 'lengkap').slice(0, 10).map((r: any) => (
                    <tr key={r.product_id}>
                      <td className="py-2 pr-4">
                        <p className="font-medium text-gray-900 dark:text-white">{r.product_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{r.product_code}</p>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatRupiah(r.hpp_material)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatRupiah(r.selling_price)}</td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${r.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatRupiah(r.margin)} <span className="text-xs font-normal">({r.margin_percent}%)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production & OEE Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-200 dark:border-gray-700 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Production & OEE</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Output vs efficiency</p>
            </div>
            <TrendUp className="w-5 h-5 text-violet-500" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trends?.production || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(31, 41, 55, 0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Output" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={(d: any) => trends?.oee?.find((o: any) => o.period === d.period)?.value || 0}
                stroke="#10b981"
                strokeWidth={2}
                name="OEE %"
                dot={{ fill: '#10b981', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Sales Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-200 dark:border-gray-700 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sales Trend</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last 7 days</p>
            </div>
            <ShoppingCartIcon className="w-5 h-5 text-[#F15D2C]" />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value: number) => [formatRupiah(value), 'Sales']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID')}
                  contentStyle={{
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#F15D2C"
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Top Products</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">By quantity produced</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {!performers?.top_products || performers.top_products.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No product data available</p>
              </div>
            ) : (
              performers.top_products.slice(0, 5).map((product: any, index: number) => (
                <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.code}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-gray-900 dark:text-white">{product.quantity?.toLocaleString() || 0}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">units</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity - real audit log, not simulated */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg">
                <ClockIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Live audit trail</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[360px] overflow-y-auto">
            {!activityLogs || activityLogs.length === 0 ? (
              <div className="p-8 text-center">
                <ClockIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
              </div>
            ) : (
              activityLogs.slice(0, 8).map((log: any) => {
                const actionStyle: Record<string, string> = {
                  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  UPDATE: 'bg-orange-100 text-[#C73E1D] dark:bg-orange-900/30 dark:text-orange-400',
                  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                }
                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${actionStyle[log.action] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {log.action}
                          </span>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{log.module}</span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white truncate">{log.resource_name || log.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{log.user_name}</p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{log.timestamp}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Module Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {moduleCards.map((m) => {
          const c = colorClasses[m.color]
          const Icon = m.icon
          return (
            <Link
              key={m.name}
              to={m.href}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 ${c.border}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${c.bg} rounded-lg`}>
                  <Icon className={`w-6 h-6 ${c.text}`} />
                </div>
                {m.stat !== undefined && (
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {m.stat}{m.statSuffix || ''}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{m.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{m.label}</p>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <button
            onClick={() => navigate('/app/production/work-orders/new')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#F15D2C] hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
          >
            <CogIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-[#F15D2C] dark:group-hover:text-orange-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#F15D2C] dark:group-hover:text-orange-400">New SPK</p>
          </button>

          <button
            onClick={() => navigate('/app/sales/orders/new')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
          >
            <ShoppingCartIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">New Sales Order</p>
          </button>

          <button
            onClick={() => navigate('/app/purchasing/orders/new')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
          >
            <BuildingStorefrontIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-orange-600 dark:group-hover:text-orange-400">New PO</p>
          </button>

          <button
            onClick={() => navigate('/app/quality/incoming')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
          >
            <CheckCircleIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">QC Inspection</p>
          </button>

          <button
            onClick={() => navigate('/app/warehouse/material-issues/new')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all group"
          >
            <CubeIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">Issue Material</p>
          </button>

          <button
            onClick={() => navigate('/app/reports')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
          >
            <DocumentTextIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">View Reports</p>
          </button>
        </div>
      </div>

      {/* Team Activity - de-prioritized below the business data, single consolidated view (no duplicate counts) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <SignalIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Team Activity</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activeUsers ? `${activeUsers.active_count} online • ${activeUsers.offline_count} offline • ${activeUsers.total_users} total` : 'Loading...'}
              </p>
            </div>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {(executiveData?.summary?.total_modules || 0)} modules active
            {criticalIssues.length > 0 && <span className="text-red-500 dark:text-red-400"> • {criticalIssues.length} critical alert{criticalIssues.length > 1 ? 's' : ''}</span>}
          </span>
        </div>
        {activeUsers && (activeUsers.active_users.length > 0 || activeUsers.offline_users.length > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
            {[...activeUsers.active_users, ...activeUsers.offline_users].map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                  activeUsers.active_users.some(a => a.id === u.id)
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                  activeUsers.active_users.some(a => a.id === u.id) ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-400 dark:bg-gray-600'
                }`}>
                  {u.full_name?.charAt(0).toUpperCase() || u.username?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.full_name || u.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.time_since_activity_formatted}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No team activity data</p>
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Last updated: {executiveData?.summary?.last_updated
          ? new Date(executiveData.summary.last_updated).toLocaleString('id-ID')
          : 'Never'}
      </div>

      {/* Production Output Detail Modal */}
      <ProductionOutputModal
        isOpen={showProductionOutput}
        onClose={() => setShowProductionOutput(false)}
        days={parseInt(dateRange)}
      />
    </div>
  )
}
