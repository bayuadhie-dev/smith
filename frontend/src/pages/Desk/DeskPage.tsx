import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../hooks/redux'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../contexts/PermissionContext'
import { useGetDeskOverviewQuery } from '../../services/api'
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
    'pending': 'bg-yellow-100 text-yellow-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
    'approved': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800',
    'draft': 'bg-gray-100 text-gray-800',
  }
  return statusColors[status] || 'bg-gray-100 text-gray-800'
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
      groupName: 'UTILITIES',
      items: [
        { name: 'Reports', href: '/app/reports', icon: DocumentChartBarIcon, permission: 'reports' },
        { name: 'Documents', href: '/app/documents', icon: DocumentTextIcon, permission: 'documents' },
        { name: 'TV Display', href: '/app/tv-display', icon: TvIcon, permission: 'tv_display' },
        { name: 'Group Chat', href: '/app/chat', icon: ChatBubbleLeftRightIcon },
        { name: 'User Manual', href: '/app/manual', icon: BookOpenIcon },
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
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {user?.full_name || 'User'}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Here's what's happening across your business today.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="max-w-2xl">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for anything... (e.g., work orders, customers, products)"
              className="w-full px-4 py-3 pl-12 pr-4 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              type="submit"
              className="absolute inset-y-0 right-0 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-r-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickStats.map((stat: QuickStat, index: number) => {
          const IconComponent = iconMap[stat.icon] || ChartBarIcon
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
                <IconComponent className={`h-8 w-8 ${stat.color}`} />
              </div>
              {stat.change !== undefined && (
                <div className="mt-2 flex items-center text-sm">
                  {stat.change > 0 ? (
                    <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={stat.change > 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(stat.change)} from yesterday
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick Shortcuts (Single Pages) */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Shortcuts</h2>
        <div className="flex flex-wrap gap-3">
          {menuGroups
            .filter((group) => group.groupName === 'MAIN')
            .flatMap((group) => group.items)
            .map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <item.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
              </button>
            ))}
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
            group.items.map((item) => {
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
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Documents</h3>
            <div className="space-y-3">
              {recentDocuments?.slice(0, 5).map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100`}>
                      <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-sm text-gray-500">{doc.type} • {doc.number} • {doc.date}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
              {recentDocuments?.length === 0 && (
                <p className="text-gray-500 text-center py-8">No recent documents</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Work Orders */}
        <div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Work Orders</h3>
            <div className="space-y-3">
              {recentWorkOrders?.slice(0, 5).map((wo, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPriorityColor(wo.priority)}`}>
                      <ClipboardDocumentListIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{wo.name}</p>
                      <p className="text-sm text-gray-500">{wo.product} • {wo.date}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(wo.status)}`}>
                    {wo.status}
                  </span>
                </div>
              ))}
              {recentWorkOrders?.length === 0 && (
                <p className="text-gray-500 text-center py-8">No recent work orders</p>
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
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Create Work Order
            </button>
            <button
              onClick={() => navigate('/app/sales/orders/new')}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              New Sales Order
            </button>
            <button
              onClick={() => navigate('/app/purchasing/orders/new')}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            >
              Create PO
            </button>
            <button
              onClick={() => navigate('/app/quality/incoming')}
              className="px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              QC Inspection
            </button>
            <button
              onClick={() => navigate('/app/warehouse/material-issues/new')}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Issue Material
            </button>
            <button
              onClick={() => navigate('/app/finance/reports')}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
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
