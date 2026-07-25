import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../hooks/redux'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../contexts/PermissionContext'
import { useGetDeskOverviewQuery } from '../../services/api'
import { getDynamicLoginGreeting } from '../../utils/greetingHelper'
import clsx from 'clsx'
import ModuleCard from '../../components/Desk/ModuleCard'
import {
  HomeIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  CogIcon,
  CheckBadgeIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TruckIcon,
  BanknotesIcon,
  CalculatorIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  LightBulbIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  TvIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  TrashIcon,
  SignalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PresentationChartLineIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxIcon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  ChartPieIcon,
  ClockIcon,
  DocumentCheckIcon,
  SparklesIcon,
  ScaleIcon,
  CameraIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'

interface RecentDocument {
  id: string
  type: string
  name: string
  date: string
  url: string
  status?: string
}

interface QuickStat {
  label: string
  value: string | number
  change?: number
  icon: string
  color: string
}

interface ModuleStats {
  [key: string]: {
    [key: string]: any
  }
}

const getStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'in_progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'approved': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'draft': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }
  return statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

const getPriorityColor = (priority: string) => {
  const priorityColors: Record<string, string> = {
    'high': 'bg-red-500',
    'medium': 'bg-yellow-500',
    'low': 'bg-green-500',
    'urgent': 'bg-red-600',
    'normal': 'bg-blue-500',
  }
  return priorityColors[priority] || 'bg-gray-500'
}

export default function DeskPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { hasPermission, isAdmin, isSuperAdmin, isLoading: permsLoading } = usePermissions()
  const { user } = useAppSelector((state) => state.auth)
  const [searchQuery, setSearchQuery] = useState('')
  const [dailyGreeting, setDailyGreeting] = useState('')

  useEffect(() => {
    const userAny = user as any;
    const isFirstTime = userAny?.is_first_login || userAny?.login_count === 1;
    const msg = getDynamicLoginGreeting(user?.full_name || user?.username, isFirstTime);
    setDailyGreeting(msg);
  }, [user]);
  const [navMode, setNavMode] = useState<'desk' | 'classic'>(
    () => (localStorage.getItem('erp_nav_mode') as 'desk' | 'classic') || 'desk'
  )

  const toggleNavMode = (mode: 'desk' | 'classic') => {
    setNavMode(mode)
    localStorage.setItem('erp_nav_mode', mode)
    window.dispatchEvent(new Event('erp-nav-mode-changed'))
  }

  // Fetch real data from API
  const { data: deskData, isLoading, error, refetch } = useGetDeskOverviewQuery({})
  
  const quickStats = deskData?.data?.quick_stats || []
  const recentDocuments = deskData?.data?.recent_documents || []
  const recentWorkOrders = deskData?.data?.recent_work_orders || []
  const moduleStats = deskData?.data?.module_stats || {}

  // Module configuration with colors and descriptions
  const moduleConfigs: Record<string, { color: string; description: string; icon: any }> = {
    'Dashboard': { color: 'blue', description: 'Executive overview & KPI metrics', icon: PresentationChartLineIcon },
    'Production Monitoring': { color: 'red', description: 'Real-time production monitoring', icon: ChartBarIcon },
    'Live Monitoring': { color: 'orange', description: 'Live production data', icon: SignalIcon },
    'Pre-Shift Checklist': { color: 'yellow', description: 'Safety checks & handover', icon: ClipboardDocumentCheckIcon },
    'Products': { color: 'purple', description: 'Product management & BOM', icon: CubeIcon },
    'Warehouse': { color: 'green', description: 'Inventory & stock management', icon: BuildingStorefrontIcon },
    'Production': { color: 'indigo', description: 'Work orders & scheduling', icon: CogIcon },
    'Quality Control': { color: 'teal', description: 'Quality inspections & reports', icon: CheckBadgeIcon },
    'Purchasing': { color: 'orange', description: 'Suppliers & purchase orders', icon: ShoppingBagIcon },
    'Sales': { color: 'blue', description: 'Customers & sales orders', icon: ShoppingCartIcon },
    'Shipping': { color: 'purple', description: 'Delivery & logistics', icon: TruckIcon },
    'Returns': { color: 'red', description: 'Return management', icon: ArrowPathIcon },
    'Finance': { color: 'green', description: 'Budget & cash flow', icon: BanknotesIcon },
    'Accounting': { color: 'blue', description: 'GL & financial reports', icon: CalculatorIcon },
    'Human Resources': { color: 'purple', description: 'Employee management', icon: UsersIcon },
    'Asset Management': { color: 'blue', description: 'Asset lifecycle & depreciation', icon: BuildingStorefrontIcon },
    'Maintenance': { color: 'orange', description: 'Equipment maintenance', icon: WrenchScrewdriverIcon },
    'R&D': { color: 'teal', description: 'Research projects', icon: LightBulbIcon },
    'R&D Legacy': { color: 'indigo', description: 'Legacy R&D module', icon: BeakerIcon },
    'Document Control': { color: 'red', description: 'DCC & document management', icon: DocumentChartBarIcon },
    'Reports': { color: 'green', description: 'Business reports', icon: DocumentChartBarIcon },
    'Documents': { color: 'blue', description: 'Document generation', icon: DocumentTextIcon },
    'TV Display': { color: 'purple', description: 'Production display', icon: TvIcon },
    'Group Chat': { color: 'blue', description: 'Team communication', icon: ChatBubbleLeftRightIcon },
    'User Manual': { color: 'green', description: 'Documentation & help', icon: BookOpenIcon },
    'Settings': { color: 'gray', description: 'System configuration', icon: Cog6ToothIcon },
    'Waste Management': { color: 'red', description: 'Waste tracking', icon: TrashIcon },
    'OEE Monitoring': { color: 'orange', description: 'OEE metrics', icon: ChartBarIcon },
  }

  // Icon mapping for quick stats
  const iconMap: Record<string, any> = {
    'clipboard-document-list': ClipboardDocumentListIcon,
    'document-check': DocumentCheckIcon,
    'archive-box': ArchiveBoxIcon,
    'chart-bar': ChartBarIcon,
  }

  // Menu groups from Sidebar (simplified for desk)
  const menuGroups = [
    {
      groupName: 'MAIN',
      items: [
        { name: 'Dashboard', href: '/app', icon: HomeIcon, permission: 'dashboard' },
        { name: 'Production Monitoring', href: '/app/executive/production-monitoring', icon: ChartBarIcon, permission: 'dashboard' },
        { name: 'Live Monitoring', href: '/app/production/live-monitoring', icon: SignalIcon, permission: 'dashboard' },
        { name: 'Pre-Shift Checklist', href: '/app/production/pre-shift-checklist', icon: ClipboardDocumentCheckIcon, permission: 'production' },
      ]
    },
    {
      groupName: 'OPERATIONS',
      items: [
        {
          name: 'Products',
          href: '/app/products',
          icon: CubeIcon,
          permission: 'products',
          children: [
            { name: 'All Products', href: '/app/products' },
            { name: 'Dashboard', href: '/app/products/dashboard' },
            { name: 'Analytics', href: '/app/products/analytics' },
            { name: 'Categories', href: '/app/products/categories' },
          ]
        },
        {
          name: 'Warehouse',
          href: '/app/warehouse',
          icon: BuildingStorefrontIcon,
          permission: 'warehouse',
          children: [
            { name: 'Dashboard', href: '/app/warehouse' },
            { name: 'Material Issues', href: '/app/warehouse/material-issues' },
            { name: 'Stock Opname', href: '/app/warehouse/stock-opname' },
            { name: 'Materials', href: '/app/warehouse/materials' },
          ],
          stats: moduleStats.warehouse ? {
            label: 'Low Stock',
            value: moduleStats.warehouse.low_stock || 0
          } : undefined
        },
        {
          name: 'Production',
          href: '/app/production',
          icon: CogIcon,
          permission: 'production',
          children: [
            { name: 'Dashboard', href: '/app/production' },
            { name: 'Work Orders', href: '/app/production/work-orders' },
            { name: 'WO Monitoring', href: '/app/production/work-orders-monitoring' },
            { name: 'Controller', href: '/app/production/controller' },
          ],
          stats: moduleStats.production ? {
            label: 'Active WOs',
            value: moduleStats.production.active_orders || 0
          } : undefined,
          badge: moduleStats.production && moduleStats.production.completed_today > 0 ? {
            text: `${moduleStats.production.completed_today} done`,
            color: 'green'
          } : undefined
        },
        {
          name: 'Quality Control',
          href: '/app/quality',
          icon: CheckBadgeIcon,
          permission: 'quality',
          children: [
            { name: 'Dashboard', href: '/app/quality' },
            { name: 'QC Incoming', href: '/app/quality/incoming' },
            { name: 'QC In-Process', href: '/app/quality/in-process' },
            { name: 'QC Finish Good', href: '/app/quality/finish-good' },
          ],
          stats: moduleStats.quality ? {
            label: 'Inspections Today',
            value: moduleStats.quality.inspections_today || 0
          } : undefined
        },
      ]
    },
    {
      groupName: 'SUPPLY CHAIN',
      items: [
        {
          name: 'Purchasing',
          href: '/app/purchasing',
          icon: ShoppingBagIcon,
          permission: 'purchasing',
          children: [
            { name: 'Dashboard', href: '/app/purchasing' },
            { name: 'Suppliers', href: '/app/purchasing/suppliers' },
            { name: 'Purchase Orders', href: '/app/purchasing/orders' },
            { name: 'RFQ', href: '/app/purchasing/rfq' },
          ],
          stats: moduleStats.purchasing ? {
            label: 'Pending POs',
            value: moduleStats.purchasing.pending_orders || 0
          } : undefined
        },
        {
          name: 'Sales',
          href: '/app/sales',
          icon: ShoppingCartIcon,
          permission: 'sales',
          children: [
            { name: 'Dashboard', href: '/app/sales/dashboard' },
            { name: 'Customers', href: '/app/sales/customers' },
            { name: 'Sales Orders', href: '/app/sales/orders' },
            { name: 'Quotations', href: '/app/sales/quotations' },
          ],
          stats: moduleStats.sales ? {
            label: 'Orders Today',
            value: moduleStats.sales.orders_today || 0
          } : undefined
        },
        {
          name: 'Shipping',
          href: '/app/shipping',
          icon: TruckIcon,
          permission: 'shipping',
          children: [
            { name: 'Dashboard', href: '/app/shipping' },
            { name: 'Orders', href: '/app/shipping/orders' },
            { name: 'Tracking', href: '/app/shipping/tracking' },
          ]
        },
      ]
    },
    {
      groupName: 'FINANCE & HR',
      items: [
        {
          name: 'Finance',
          href: '/app/finance',
          icon: BanknotesIcon,
          permission: 'finance',
          children: [
            { name: 'Dashboard', href: '/app/finance' },
            { name: 'Budget', href: '/app/finance/budget' },
            { name: 'Cash Flow', href: '/app/finance/cash-flow' },
          ],
          stats: moduleStats.finance ? {
            label: 'Pending Invoices',
            value: moduleStats.finance.pending_invoices || 0
          } : undefined
        },
        {
          name: 'Accounting',
          href: '/app/accounting',
          icon: CalculatorIcon,
          permission: 'finance',
          children: [
            { name: 'Chart of Accounts', href: '/app/accounting/chart-of-accounts' },
            { name: 'General Ledger', href: '/app/accounting/general-ledger' },
            { name: 'Journal Entry', href: '/app/accounting/journal' },
          ]
        },
        {
          name: 'Human Resources',
          href: '/app/hr',
          icon: UsersIcon,
          permission: 'hr',
          children: [
            { name: 'Dashboard', href: '/app/hr/dashboard' },
            { name: 'Employees', href: '/app/hr/employees' },
            { name: 'Attendance', href: '/app/hr/absensi' },
            { name: 'Payroll', href: '/app/hr/payroll' },
          ],
          stats: moduleStats.hr ? {
            label: 'Total Employees',
            value: moduleStats.hr.total_employees || 0
          } : undefined
        },
      ]
    },
    {
      groupName: 'SUPPORT',
      items: [
        {
          name: 'Maintenance',
          href: '/app/maintenance',
          icon: WrenchScrewdriverIcon,
          permission: 'maintenance',
          children: [
            { name: 'Dashboard', href: '/app/maintenance' },
            { name: 'Work Orders', href: '/app/maintenance/records' },
            { name: 'Schedule', href: '/app/maintenance/schedules' },
          ],
          stats: moduleStats.maintenance ? {
            label: 'Overdue',
            value: moduleStats.maintenance.overdue || 0
          } : undefined,
          badge: moduleStats.maintenance && moduleStats.maintenance.overdue > 0 ? {
            text: '!',
            color: 'red'
          } : undefined
        },
        {
          name: 'R&D',
          href: '/app/rnd',
          icon: LightBulbIcon,
          permission: 'rd',
          children: [
            { name: 'Dashboard', href: '/app/rnd' },
            { name: 'Projects', href: '/app/rnd/projects' },
            { name: 'Approvals', href: '/app/rnd/approvals' },
          ]
        },
        {
          name: 'Document Control',
          href: '/app/dcc',
          icon: DocumentChartBarIcon,
          permission: 'dcc',
          children: [
            { name: 'Dashboard', href: '/app/dcc?tab=dashboard' },
            { name: 'Documents', href: '/app/dcc?tab=documents' },
            { name: 'CAPA', href: '/app/dcc?tab=capa' },
          ]
        },
      ]
    },
    {
      groupName: 'MONITORING & OTHER',
      items: [
        { name: 'Waste Management', href: '/app/waste', icon: TrashIcon, permission: 'waste' },
        { name: 'OEE Monitoring', href: '/app/oee', icon: ChartBarIcon, permission: 'oee' },
        { name: 'Returns', href: '/app/returns', icon: ArrowPathIcon, permission: 'returns' },
      ]
    },
    {
      groupName: 'UTILITIES',
      items: [
        { name: 'Reports', href: '/app/reports', icon: DocumentChartBarIcon, permission: 'reports', directLink: true },
        { name: 'Documents', href: '/app/documents', icon: DocumentTextIcon, permission: 'documents', directLink: true },
        { name: 'TV Display', href: '/app/tv-display', icon: TvIcon, permission: 'tv_display', directLink: true },
        { name: 'Group Chat', href: '/app/chat', icon: ChatBubbleLeftRightIcon, directLink: true },
        { name: 'User Manual', href: '/app/manual', icon: BookOpenIcon, directLink: true },
        { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon, superAdminOnly: true, directLink: true },
      ]
    }
  ]

  useEffect(() => {
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      refetch()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [refetch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Navigate to global search (will be implemented later)
      navigate(`/app/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading desk data</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Please try refreshing the page.</p>
              </div>
              <button
                onClick={() => refetch()}
                className="mt-3 bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header with Gradient */}
      <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 shadow-2xl">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Content */}
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {dailyGreeting || `Welcome back, ${user?.full_name || 'User'}! 👋`}
              </h1>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="text-center">
                  <p className="text-blue-100 text-sm mb-1">Current Time</p>
                  <p className="text-white text-2xl font-bold">
                    {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-blue-100 text-xs mt-1">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
      </div>

      {/* Search Bar with Glassmorphism */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for anything... (work orders, customers, products, documents)"
                className="w-full px-6 py-4 pl-14 pr-32 text-gray-900 dark:text-white bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-2 border-gray-200 dark:border-gray-600 rounded-2xl 
                         focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800
                         transition-all duration-300 shadow-lg hover:shadow-xl
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-5">
                <svg className="w-6 h-6 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                className="absolute inset-y-0 right-2 my-2 px-6 text-sm font-semibold text-white 
                         bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl 
                         hover:from-blue-700 hover:to-indigo-700 
                         focus:ring-4 focus:ring-blue-500/50
                         transition-all duration-200 shadow-md hover:shadow-lg
                         flex items-center gap-2"
              >
                <span>Search</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">Ctrl</kbd>
            {' + '}
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">K</kbd>
            {' for quick search'}
          </p>
        </form>
      </div>

      {/* Navigation Mode Toggle */}
      <div className="mb-6 flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${navMode === 'desk' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {navMode === 'desk' ? (
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {navMode === 'desk' ? 'Mode Desk' : 'Mode Klasik'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {navMode === 'desk'
                ? 'Sidebar menampilkan menu sesuai modul yang aktif'
                : 'Sidebar menampilkan seluruh navigasi berdasarkan role'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => toggleNavMode('desk')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              navMode === 'desk'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Desk
          </button>
          <button
            onClick={() => toggleNavMode('classic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              navMode === 'classic'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Klasik
          </button>
        </div>
      </div>

      {/* Quick Stats with Modern Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickStats.map((stat: QuickStat, index: number) => {
          const IconComponent = iconMap[stat.icon] || ChartBarIcon
          const gradients = [
            'from-blue-500 to-indigo-600',
            'from-green-500 to-emerald-600',
            'from-purple-500 to-violet-600',
            'from-orange-500 to-amber-600'
          ]
          const gradient = gradients[index % gradients.length]
          
          return (
            <div 
              key={index} 
              className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              
              {/* Content */}
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                </div>
                
                {stat.change !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                      stat.change > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {stat.change > 0 ? (
                        <ArrowUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className={`text-sm font-semibold ${
                        stat.change > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                      }`}>
                        {Math.abs(stat.change)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">from yesterday</span>
                  </div>
                )}
              </div>

              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-bl-full`}></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Shortcuts with Modern Pills */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-blue-600" />
          Quick Shortcuts
        </h2>
        <div className="flex flex-wrap gap-3">
          {menuGroups
            .filter((group) => group.groupName === 'MAIN')
            .flatMap((group) => group.items as any[])
            .map((item: any, index: number) => {
              const colors = [
                'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700',
                'from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700',
                'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
                'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700',
              ]
              const gradient = colors[index % colors.length]
              
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={`group flex items-center gap-3 px-5 py-3 bg-gradient-to-r ${gradient} text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5`}
                >
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold">{item.name}</span>
                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
        </div>
      </div>

      {/* Module Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Modules</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {menuGroups
            .filter((group) => group.groupName !== 'MAIN')
            .map((group) =>
            group.items.map((item: any) => {
              const config = moduleConfigs[item.name] || { color: 'blue', description: '', icon: CubeIcon }
              return (
                <ModuleCard
                  key={item.name}
                  name={item.name}
                  description={config.description}
                  icon={item.icon}
                  href={item.href}
                  color={config.color}
                  permission={item.permission}
                  superAdminOnly={item.superAdminOnly}
                  directLink={item.directLink}
                  children={item.children}
                  stats={item.stats}
                  badge={item.badge}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Documents</h3>
            <div className="space-y-3">
              {recentDocuments?.slice(0, 5).map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30`}>
                      <DocumentTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{doc.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{doc.type} • {doc.number} • {doc.date}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
              {recentDocuments?.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent documents</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Work Orders */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Work Orders</h3>
            <div className="space-y-3">
              {recentWorkOrders?.slice(0, 5).map((wo, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPriorityColor(wo.priority)}`}>
                      <ClipboardDocumentListIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{wo.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{wo.product} • {wo.date}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(wo.status)}`}>
                    {wo.status}
                  </span>
                </div>
              ))}
              {recentWorkOrders?.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent work orders</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/app/production/work-orders/new')}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
            >
              Create Work Order
            </button>
            <button
              onClick={() => navigate('/app/sales/orders/new')}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
            >
              New Sales Order
            </button>
            <button
              onClick={() => navigate('/app/purchasing/orders/new')}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
            >
              Create PO
            </button>
            <button
              onClick={() => navigate('/app/quality/incoming')}
              className="px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
            >
              QC Inspection
            </button>
            <button
              onClick={() => navigate('/app/warehouse/material-issues/new')}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
            >
              Issue Material
            </button>
            <button
              onClick={() => navigate('/app/finance/reports')}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
            >
              View Reports
            </button>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
        Last updated: {deskData?.data?.last_updated ? new Date(deskData.data.last_updated).toLocaleString() : 'Never'}
      </div>
    </div>
  )
}
