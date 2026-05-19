import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import { useGetExecutiveDashboardQuery } from '../../services/api'
import { useAppSelector } from '../../hooks/redux'
import { formatRupiah } from '../../utils/currencyUtils'
import axiosInstance from '../../utils/axiosConfig'
import { useQuery } from '@tanstack/react-query'
import { Zap, Package, TrendingUp as TrendUp } from 'lucide-react'
import ProductionOutputModal from '../../components/Production/ProductionOutputModal'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ComposedChart,
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChartBarIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BellIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  SparklesIcon,
  UserCircleIcon,
  SignalIcon
} from '@heroicons/react/24/outline'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

interface SessionInfo {
  user_id: number
  username: string
  full_name: string
  email: string
  role: string
  last_login: string
  session_duration_seconds: number
  session_duration_formatted: string
  idle_time_seconds: number
  idle_time_formatted: string
  is_idle: boolean
  last_activity: string
  last_activity_action: string
}

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
  const { t } = useLanguage()
  const { user } = useAppSelector((state) => state.auth)
  const { data: executiveData, isLoading, refetch } = useGetExecutiveDashboardQuery({})
  const [currentTime, setCurrentTime] = useState(new Date())
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [activeUsers, setActiveUsers] = useState<ActiveUsersData | null>(null)
  const [showProductionOutput, setShowProductionOutput] = useState(false)
  const [dateRange, setDateRange] = useState('30')

  // Fetch trends data for production chart
  const { data: trends } = useQuery({
    queryKey: ['executive-trends', dateRange],
    queryFn: () => axiosInstance.get(`/api/executive/trends?days=${dateRange}`).then(res => {
      console.log('Trends data:', res.data.data)
      return res.data.data
    }),
    enabled: true
  })

  // Fetch top performers (products)
  const { data: performers } = useQuery({
    queryKey: ['executive-performers', dateRange],
    queryFn: () => axiosInstance.get(`/api/executive/top-performers?days=${dateRange}`).then(res => {
      console.log('Performers data:', res.data.data)
      return res.data.data
    }),
    enabled: true
  })

  // Fetch session info (using current user data)
  const fetchSessionInfo = async () => {
    try {
      if (user?.last_login) {
        const now = new Date()
        const lastLogin = new Date(user.last_login)
        const sessionSeconds = Math.max(0, Math.floor((now.getTime() - lastLogin.getTime()) / 1000))
        
        const hours = Math.floor(sessionSeconds / 3600)
        const minutes = Math.floor((sessionSeconds % 3600) / 60)
        const sessionFormatted = sessionSeconds < 60 ? 'Just now' : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
        
        setSessionInfo({
          user_id: user.id,
          username: user.username,
          full_name: user.full_name || user.username,
          email: user.email,
          role: user.roles?.[0] || 'User',
          last_login: user.last_login,
          session_duration_seconds: sessionSeconds,
          session_duration_formatted: sessionFormatted,
          idle_time_seconds: 0,
          idle_time_formatted: '0m',
          is_idle: false,
          last_activity: new Date().toISOString(),
          last_activity_action: 'Dashboard View'
        })
      }
    } catch (error) {
      console.error('Error calculating session info:', error)
    }
  }

  // Fetch active users from executive dashboard
  const fetchActiveUsers = async () => {
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
  }

  // Send heartbeat to chat system (for online status)
  const sendHeartbeat = async () => {
    try {
      await axiosInstance.post('/api/chat/heartbeat')
    } catch (error) {
      console.error('Error sending heartbeat:', error)
    }
  }

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch session info on mount and every 30 seconds
  useEffect(() => {
    fetchSessionInfo()
    fetchActiveUsers()
    const interval = setInterval(() => {
      fetchSessionInfo()
      fetchActiveUsers()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Send heartbeat every 2 minutes
  useEffect(() => {
    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh dashboard every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => refetch(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refetch])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const criticalIssues = executiveData?.critical_issues || []
  const salesTrend = executiveData?.trends?.sales || []

  // Module status data for pie chart
  const moduleStatusData = [
    { name: 'Production', value: executiveData?.production?.active_work_orders || 0, color: '#3B82F6' },
    { name: 'Sales', value: executiveData?.financial?.outstanding_invoices || 0, color: '#10B981' },
    { name: 'Quality', value: executiveData?.quality?.inspections_today || 0, color: '#F59E0B' },
    { name: 'Maintenance', value: executiveData?.maintenance?.overdue || 0, color: '#EF4444' },
  ]

  return (
    <div className="space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
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
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-900 dark:text-white"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/desk')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            Go to Desk
          </button>
        </div>
      </div>

      {/* User Session & Activity Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Session */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UserCircleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Session</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{user?.full_name || 'User'}</p>
            </div>
          </div>
          {sessionInfo && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Active for:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{sessionInfo.session_duration_formatted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Idle time:</span>
                <span className={`font-semibold ${sessionInfo.is_idle ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                  {sessionInfo.idle_time_formatted}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last login:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {sessionInfo.last_login ? new Date(sessionInfo.last_login).toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) : 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Active Users */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <SignalIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Users</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Currently online</p>
            </div>
          </div>
          {activeUsers && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Online:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{activeUsers.active_count} users</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Offline:</span>
                <span className="font-semibold text-gray-600 dark:text-gray-400">{activeUsers.offline_count} users</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{activeUsers.total_users} users</span>
              </div>
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">System Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">All systems operational</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Modules:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{executiveData?.summary?.total_modules || 0} active</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Alerts:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">{criticalIssues.length} critical</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">99.9%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
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
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
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
          onClick={() => {
            console.log('Production metric card clicked!')
            setShowProductionOutput(true)
          }}
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

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
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
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-bold">
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
      </div>

      {/* Original Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sales Trend (7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                  stroke="#6B7280"
                />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} stroke="#6B7280" />
                <Tooltip 
                  formatter={(value: number) => [formatRupiah(value), 'Sales']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID')}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Module Activity</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={moduleStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {moduleStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <button
            onClick={() => navigate('/app/production/work-orders/new')}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
          >
            <CogIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">New Work Order</p>
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

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Production */}
        <Link to="/workspace/production" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CogIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.production?.active_work_orders || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Production</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active work orders</p>
        </Link>

        {/* Sales */}
        <Link to="/workspace/sales" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ShoppingCartIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.customers?.active_customers || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Sales</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active customers</p>
        </Link>

        {/* Purchasing */}
        <Link to="/workspace/purchasing" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <BuildingStorefrontIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.purchasing?.pending_orders || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Purchasing</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Pending orders</p>
        </Link>

        {/* Warehouse */}
        <Link to="/workspace/inventory" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CubeIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.inventory?.low_stock_items || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Warehouse</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Low stock items</p>
        </Link>

        {/* Quality */}
        <Link to="/workspace/quality" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-teal-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.quality?.pass_rate || 0}%</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Quality</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Pass rate</p>
        </Link>

        {/* Maintenance */}
        <Link to="/workspace/maintenance" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <WrenchScrewdriverIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.maintenance?.overdue || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Maintenance</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Overdue tasks</p>
        </Link>

        {/* HR */}
        <Link to="/workspace/hr" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <UsersIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{executiveData?.hr?.total_employees || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Human Resources</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total employees</p>
        </Link>

        {/* Documents */}
        <Link to="/workspace/dcc" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-l-4 border-pink-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
              <DocumentTextIcon className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">DCC</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Document Control</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage documents</p>
        </Link>
      </div>

      {/* User Activity List - Moved to Bottom */}
      {activeUsers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Online Users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Online Users ({activeUsers.active_count})
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeUsers.active_users.length > 0 ? (
                activeUsers.active_users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {u.full_name?.charAt(0).toUpperCase() || u.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{u.full_name || u.username}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{u.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Online</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.time_since_activity_formatted}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No users currently online</p>
                </div>
              )}
            </div>
          </div>

          {/* Offline Users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Offline Users ({activeUsers.offline_count})
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Inactive</span>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeUsers.offline_users && activeUsers.offline_users.length > 0 ? (
                activeUsers.offline_users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-400 dark:bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {u.full_name?.charAt(0).toUpperCase() || u.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{u.full_name || u.username}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{u.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Offline</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.time_since_activity_formatted}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">All users are online</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
