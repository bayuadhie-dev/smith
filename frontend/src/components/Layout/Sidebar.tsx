import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logout } from '../../store/slices/authSlice'
import ThemeToggle from '../Common/ThemeToggle'
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BeakerIcon,
  BookOpenIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CogIcon,
  CubeIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  HomeIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TrashIcon,
  TruckIcon,
  TvIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  PresentationChartLineIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  CurrencyDollarIcon,
  SignalIcon,
  CalculatorIcon,
  ClipboardDocumentListIcon,
  RocketLaunchIcon,
  ArchiveBoxIcon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  ChartPieIcon,
  UserGroupIcon,
  ClockIcon,
  DocumentCheckIcon,
  SparklesIcon,
  LightBulbIcon,
  ScaleIcon,
  CheckBadgeIcon,
  CameraIcon,
  CheckCircleIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import axiosInstance from '../../utils/axiosConfig'
import { usePermissions } from '../../contexts/PermissionContext'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

function SidebarContent() {
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [navMode, setNavMode] = useState<'desk' | 'classic'>(
    () => (localStorage.getItem('erp_nav_mode') as 'desk' | 'classic') || 'desk'
  )
  const { hasPermission, hasAnyPermission, isAdmin, isSuperAdmin, isLoading } = usePermissions()
  const { user } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handler = () => setNavMode((localStorage.getItem('erp_nav_mode') as 'desk' | 'classic') || 'desk')
    window.addEventListener('erp-nav-mode-changed', handler)
    return () => window.removeEventListener('erp-nav-mode-changed', handler)
  }, [])

  // Check if a href (with query params) matches current location
  const isActiveHref = (href: string) => {
    const [path, query] = href.split('?')
    if (path !== location.pathname) return false
    if (!query) return !location.search
    return location.search === `?${query}`
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/')
  }

  // Permission-based menu visibility
  // If still loading or is admin/super admin, show all menus
  const canView = (module: string) => isLoading || isAdmin || isSuperAdmin || hasPermission(`${module}.view`)
  const canViewAny = (modules: string[]) => isLoading || isAdmin || isSuperAdmin || hasAnyPermission(modules.map(m => `${m}.view`))

  // Mapping URL paths to workspace and related menu items
  const workspacePathMap: Record<string, { workspace: string; menus: string[] }> = {
    '/app/production': { workspace: 'production', menus: ['Production', 'Products', 'Warehouse', 'Quality Control'] },
    '/app/products': { workspace: 'products', menus: ['Products', 'Warehouse'] },
    '/app/warehouse': { workspace: 'inventory', menus: ['Warehouse', 'Products'] },
    '/app/quality': { workspace: 'quality', menus: ['Quality Control', 'Document Control'] },
    '/app/sales': { workspace: 'sales', menus: ['Sales', 'Shipping', 'Returns'] },
    '/app/shipping': { workspace: 'sales', menus: ['Sales', 'Shipping', 'Returns'] },
    '/app/purchasing': { workspace: 'purchasing', menus: ['Purchasing'] },
    '/app/finance': { workspace: 'finance', menus: ['Finance', 'Accounting'] },
    '/app/accounting': { workspace: 'finance', menus: ['Finance', 'Accounting'] },
    '/app/hr': { workspace: 'hr', menus: ['Human Resources'] },
    '/app/maintenance': { workspace: 'maintenance', menus: ['Maintenance', 'OEE Monitoring', 'Waste Management'] },
    '/app/dcc': { workspace: 'dcc', menus: ['Document Control'] },
    '/app/rnd': { workspace: 'rd', menus: ['R&D', 'R&D Legacy'] },
    '/app/rd': { workspace: 'rd', menus: ['R&D', 'R&D Legacy'] },
    // Workspace routes - include main module + related modules
    '/workspace/production': { workspace: 'production', menus: ['Production', 'Products', 'Warehouse', 'Quality Control', 'Maintenance'] },
    '/workspace/sales': { workspace: 'sales', menus: ['Sales', 'Products', 'Shipping', 'Finance', 'Warehouse'] },
    '/workspace/purchasing': { workspace: 'purchasing', menus: ['Purchasing', 'Warehouse', 'Finance', 'Quality Control', 'Products'] },
    '/workspace/inventory': { workspace: 'inventory', menus: ['Warehouse', 'Products', 'Production', 'Purchasing', 'Sales'] },
    '/workspace/quality': { workspace: 'quality', menus: ['Quality Control', 'Production', 'Products', 'Purchasing', 'Document Control'] },
    '/workspace/maintenance': { workspace: 'maintenance', menus: ['Maintenance', 'Production', 'OEE Monitoring', 'Warehouse'] },
    '/workspace/hr': { workspace: 'hr', menus: ['Human Resources', 'Finance', 'Production'] },
    '/workspace/finance': { workspace: 'finance', menus: ['Finance', 'Sales', 'Purchasing', 'Human Resources', 'Warehouse'] },
    '/workspace/dcc': { workspace: 'dcc', menus: ['Document Control', 'Quality Control', 'Production'] },
    '/workspace/products': { workspace: 'products', menus: ['Products', 'Production', 'Warehouse', 'Sales', 'Purchasing'] },
    '/workspace/oee': { workspace: 'oee', menus: ['OEE Monitoring', 'Production', 'Maintenance'] },
    '/workspace/shipping': { workspace: 'shipping', menus: ['Shipping', 'Sales', 'Warehouse', 'Quality Control'] },
    '/workspace/rd': { workspace: 'rd', menus: ['R&D', 'Products', 'Production', 'Quality Control'] },
    '/workspace/waste': { workspace: 'waste', menus: ['Waste Management', 'Production', 'Warehouse'] },
    // Direct module paths (non-workspace routes yang perlu filter sidebar)
    '/app/oee': { workspace: 'oee', menus: ['OEE Monitoring', 'Production', 'Maintenance'] },
    '/app/waste': { workspace: 'waste', menus: ['Waste Management', 'Production', 'Warehouse'] },
    '/app/returns': { workspace: 'returns', menus: ['Returns', 'Sales', 'Warehouse', 'Quality Control'] },
    // Module overview pages under /desk/:module
    '/desk/production': { workspace: 'production', menus: ['Production', 'Products', 'Warehouse', 'Quality Control'] },
    '/desk/warehouse': { workspace: 'inventory', menus: ['Warehouse', 'Products'] },
    '/desk/inventory': { workspace: 'inventory', menus: ['Warehouse', 'Products'] },
    '/desk/sales': { workspace: 'sales', menus: ['Sales', 'Shipping', 'Returns'] },
    '/desk/purchasing': { workspace: 'purchasing', menus: ['Purchasing', 'Warehouse', 'Finance'] },
    '/desk/quality': { workspace: 'quality', menus: ['Quality Control', 'Production', 'Document Control'] },
    '/desk/hr': { workspace: 'hr', menus: ['Human Resources', 'Finance'] },
    '/desk/finance': { workspace: 'finance', menus: ['Finance', 'Accounting'] },
    '/desk/accounting': { workspace: 'finance', menus: ['Finance', 'Accounting'] },
    '/desk/maintenance': { workspace: 'maintenance', menus: ['Maintenance', 'OEE Monitoring', 'Waste Management'] },
    '/desk/rd': { workspace: 'rd', menus: ['R&D', 'R&D Legacy'] },
    '/desk/rnd': { workspace: 'rd', menus: ['R&D', 'R&D Legacy'] },
    '/desk/oee': { workspace: 'oee', menus: ['OEE Monitoring', 'Production', 'Maintenance'] },
    '/desk/waste': { workspace: 'waste', menus: ['Waste Management', 'Production', 'Warehouse'] },
    '/desk/returns': { workspace: 'returns', menus: ['Returns', 'Sales', 'Warehouse', 'Quality Control'] },
    '/desk/shipping': { workspace: 'shipping', menus: ['Shipping', 'Sales', 'Warehouse'] },
    '/desk/dcc': { workspace: 'dcc', menus: ['Document Control', 'Quality Control'] },
    '/desk/products': { workspace: 'products', menus: ['Products', 'Production', 'Warehouse'] },
  }

  // Detect active workspace from URL path
  const getActiveWorkspace = () => {
    for (const [path, config] of Object.entries(workspacePathMap)) {
      if (location.pathname.startsWith(path)) {
        return config
      }
    }
    return null
  }

  const activeWorkspaceConfig = getActiveWorkspace()
  const isInWorkspace = activeWorkspaceConfig !== null && 
    location.pathname !== '/app' && 
    !location.pathname.startsWith('/app/executive') && 
    location.pathname !== '/desk' &&
    (location.pathname.startsWith('/workspace/') || location.pathname.startsWith('/app/') || location.pathname.startsWith('/desk/'))
  const activeWorkspace = activeWorkspaceConfig?.workspace || null

  // Mapping workspace to menu item names (for filtering)
  const workspaceMenuMap: Record<string, string[]> = activeWorkspaceConfig 
    ? { [activeWorkspaceConfig.workspace]: activeWorkspaceConfig.menus }
    : {}

  // Menu Groups with proper labels and permissions
  const allMenuGroups = [
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
      show: canViewAny(['products', 'inventory', 'warehouse', 'production', 'quality']),
      items: [
        {
          name: 'Products',
          href: '/app/products',
          icon: CubeIcon,
          permission: 'products',
          children: [
            { name: 'All Products', href: '/app/products', icon: CubeIcon },
            { name: 'Dashboard', href: '/app/products/dashboard', icon: PresentationChartLineIcon },
            { name: 'Analytics', href: '/app/products/analytics', icon: ChartPieIcon },
            { name: 'Categories', href: '/app/products/categories', icon: ArchiveBoxIcon },
            { name: 'Bill of Materials', href: '/app/products/bom', icon: ClipboardDocumentListIcon, permission: 'bom' },
            { name: 'Lifecycle', href: '/app/products/lifecycle', icon: ArrowPathIcon },
          ]
        },
        {
          name: 'Warehouse',
          href: '/app/warehouse',
          icon: BuildingStorefrontIcon,
          permission: 'warehouse',
          children: [
            { name: 'Dashboard', href: '/app/warehouse', icon: PresentationChartLineIcon },
            {
              name: 'Transaksi', icon: ArrowsRightLeftIcon, isSubMenu: true, subChildren: [
                { name: 'Permintaan Barang', href: '/app/warehouse/material-issues' },
                { name: 'Pemindahan Barang', href: '/app/warehouse/movements' },
                { name: 'Penyesuaian Persediaan', href: '/app/warehouse/stock-input' },
                { name: 'Penambahan Bahan Baku', href: '/app/warehouse/inventory' },
              ]
            },
            {
              name: 'Stok Opname', icon: ClipboardDocumentCheckIcon, isSubMenu: true, subChildren: [
                { name: 'Perintah Opname', href: '/app/warehouse/stock-opname' },
                { name: 'Hasil Opname', href: '/app/warehouse/stock-opname/results' },
              ]
            },
            {
              name: 'Master Data', icon: CubeIcon, isSubMenu: true, subChildren: [
                { name: 'Barang & Material', href: '/app/warehouse/materials' },
                { name: 'Daftar Material', href: '/app/warehouse/materials/list' },
                { name: 'Gudang & Lokasi', href: '/app/warehouse/locations' },
                { name: 'Satuan Barang', href: '/app/warehouse/uom' },
                { name: 'Kategori Barang', href: '/app/products/categories' },
              ]
            },
            {
              name: 'Laporan', icon: DocumentChartBarIcon, isSubMenu: true, subChildren: [
                { name: 'Barang per Gudang', href: '/app/warehouse/stock-summary' },
                { name: 'Stok Minimum', href: '/app/warehouse/alerts' },
                { name: 'Analytics', href: '/app/warehouse/analytics' },
              ]
            },
          ]
        },
        {
          name: 'Production',
          href: '/app/production',
          icon: CogIcon,
          permission: 'production',
          children: [
            { name: 'Dashboard', href: '/app/production', icon: PresentationChartLineIcon },
            { name: 'Work Orders', href: '/app/production/work-orders', icon: ClipboardDocumentListIcon, permission: 'work_orders' },
            { name: 'Status Pengerjaan', href: '/app/production/work-order-status', icon: ClipboardDocumentListIcon },
            { name: 'WO Monitoring', href: '/app/production/work-orders-monitoring', icon: ChartBarIcon },
            { name: 'Machine Data', href: '/app/production/machines', icon: CogIcon },
            {
              name: 'Controller', icon: ChartBarIcon, isSubMenu: true, subChildren: [
                { name: 'Harian', href: '/app/production/controller' },
                { name: 'Mingguan', href: '/app/production/weekly-controller' },
                { name: 'Bulanan', href: '/app/production/monthly-controller' },
              ]
            },
            { name: 'Converting', href: '/app/production/converting', icon: CogIcon },
            {
              name: 'Jadwal', icon: CalendarDaysIcon, isSubMenu: true, subChildren: [
                { name: 'Mingguan', href: '/app/production/scheduling' },
                { name: 'Bulanan', href: '/app/production/monthly-schedule' },
              ]
            },
            { name: 'Work Roster', href: '/app/hr/roster', icon: UserGroupIcon },
            { name: 'Sisa Order', href: '/app/production/remaining-stock', icon: ArchiveBoxIcon },
            {
              name: 'Packing List', icon: ArchiveBoxIcon, isSubMenu: true, subChildren: [
                { name: 'Daftar Packing', href: '/app/production/packing-list' },
                { name: 'WIP Stock', href: '/app/production/wip-stock' },
              ]
            },
            { name: 'FG Conversion', href: '/app/production/fg-conversion', icon: ArrowsRightLeftIcon },
            { name: 'Changeover', href: '/app/production/changeovers', icon: ArrowsRightLeftIcon },
            { name: 'Approval', href: '/app/production/approvals', icon: ClipboardDocumentCheckIcon },
            { name: 'Quality Objective', href: '/app/quality/objective/production', icon: ChartBarIcon },
            { name: 'MRP', href: '/app/production/mrp', icon: CalculatorIcon, permission: 'mrp' },
            { name: 'Demand Planning', href: '/app/production/demand-planning', icon: ChartBarIcon, permission: 'mrp' },
            { name: 'Capacity', href: '/app/production/capacity-planning', icon: ScaleIcon, permission: 'mrp' },
            { name: 'Efficiency', href: '/app/production/efficiency', icon: SparklesIcon },
            { name: 'Traceability', href: '/app/production/traceability', icon: DocumentCheckIcon },
            { name: 'MBF Report', href: '/app/production/mbf-report', icon: DocumentTextIcon },
          ]
        },
        {
          name: 'Quality Control',
          href: '/app/quality',
          icon: CheckBadgeIcon,
          permission: 'quality',
          children: [
            { name: 'Dashboard', href: '/app/quality', icon: PresentationChartLineIcon },
            { name: 'QC Barang Masuk', href: '/app/quality/incoming', icon: ArrowDownTrayIcon },
            { name: 'QC Dalam Proses', href: '/app/quality/in-process', icon: CogIcon },
            { name: 'QC Barang Jadi', href: '/app/quality/finish-good', icon: ClipboardDocumentCheckIcon },
            { name: 'QC Packing List', href: '/app/quality/packing-list', icon: ArchiveBoxIcon },
            { name: 'Analytics', href: '/app/quality/analytics', icon: ChartPieIcon },
          ]
        },
      ]
    },
    {
      groupName: 'SUPPLY CHAIN',
      show: canViewAny(['purchasing', 'sales', 'shipping', 'returns']),
      items: [
        {
          name: 'Purchasing',
          href: '/app/purchasing',
          icon: ShoppingBagIcon,
          permission: 'purchasing',
          children: [
            { name: 'Dashboard', href: '/app/purchasing', icon: PresentationChartLineIcon },
            { name: 'Suppliers', href: '/app/purchasing/suppliers', icon: UserGroupIcon, permission: 'suppliers' },
            { name: 'Purchase Orders', href: '/app/purchasing/orders', icon: ClipboardDocumentListIcon, permission: 'purchase_orders' },
            { name: 'RFQ', href: '/app/purchasing/rfq', icon: DocumentTextIcon },
            { name: 'Contracts', href: '/app/purchasing/contracts', icon: DocumentCheckIcon },
            { name: 'Price Comparison', href: '/app/purchasing/price-comparison', icon: ScaleIcon },
          ]
        },
        {
          name: 'Sales',
          href: '/app/sales',
          icon: ShoppingCartIcon,
          permission: 'sales',
          children: [
            { name: 'Dashboard', href: '/app/sales/dashboard', icon: PresentationChartLineIcon },
            { name: 'Customers', href: '/app/sales/customers', icon: UserGroupIcon, permission: 'customers' },
            { name: 'Leads', href: '/app/sales/leads', icon: UserGroupIcon, permission: 'leads' },
            { name: 'Opportunities', href: '/app/sales/opportunities', icon: ChartBarIcon },
            { name: 'Quotations', href: '/app/sales/quotations', icon: DocumentTextIcon, permission: 'quotations' },
            { name: 'Sales Orders', href: '/app/sales/orders', icon: ClipboardDocumentListIcon, permission: 'sales_orders' },
            { name: 'Forecasts', href: '/app/sales/forecasts', icon: ChartPieIcon },
          ]
        },
        {
          name: 'Shipping',
          href: '/app/shipping',
          icon: TruckIcon,
          permission: 'shipping',
          children: [
            { name: 'Dashboard', href: '/app/shipping', icon: PresentationChartLineIcon },
            { name: 'Orders', href: '/app/shipping/orders', icon: ClipboardDocumentListIcon },
            { name: 'Tracking', href: '/app/shipping/tracking', icon: MapPinIcon },
            { name: 'Cost Calculator', href: '/app/shipping/calculator', icon: CalculatorIcon },
            { name: 'Providers', href: '/app/shipping/providers', icon: TruckIcon },
          ]
        },
        { name: 'Returns', href: '/app/returns', icon: ArrowPathIcon, permission: 'returns' },
      ]
    },
    {
      groupName: 'FINANCE & HR',
      show: canViewAny(['finance', 'accounting', 'hr', 'employees', 'payroll']),
      items: [
        {
          name: 'Finance',
          href: '/app/finance',
          icon: BanknotesIcon,
          permission: 'finance',
          children: [
            { name: 'Dashboard', href: '/app/finance', icon: PresentationChartLineIcon },
            { name: 'Budget', href: '/app/finance/budget', icon: CurrencyDollarIcon },
            { name: 'Cash Flow', href: '/app/finance/cash-flow', icon: ArrowsRightLeftIcon },
            { name: 'Approvals', href: '/app/approval', icon: DocumentCheckIcon, permission: 'approval' },
          ]
        },
        {
          name: 'Accounting',
          href: '/app/accounting',
          icon: CalculatorIcon,
          permission: 'finance',
          children: [
            { name: 'Chart of Accounts', href: '/app/accounting/chart-of-accounts', icon: DocumentTextIcon },
            { name: 'General Ledger', href: '/app/accounting/general-ledger', icon: DocumentChartBarIcon },
            { name: 'Journal Entry', href: '/app/accounting/journal', icon: PencilSquareIcon },
            { name: 'Accounts Receivable', href: '/app/accounting/receivable', icon: ArrowDownTrayIcon },
            { name: 'Accounts Payable', href: '/app/accounting/payable', icon: ArrowUpTrayIcon },
            { name: 'Fixed Assets', href: '/app/accounting/fixed-assets', icon: BuildingOfficeIcon },
            { name: 'Tax Management', href: '/app/accounting/tax', icon: ReceiptPercentIcon },
            { name: 'WIP Ledger', href: '/app/finance/wip-ledger', icon: CubeIcon },
            { name: 'Financial Reports', href: '/app/accounting/reports', icon: DocumentChartBarIcon },
          ]
        },
        {
          name: 'Human Resources',
          href: '/app/hr',
          icon: UsersIcon,
          permission: 'hr',
          children: [
            { name: 'Dashboard', href: '/app/hr/dashboard', icon: PresentationChartLineIcon },
            { name: 'Employees', href: '/app/hr/employees', icon: UserGroupIcon, permission: 'employees' },
            { name: 'Absensi (Foto)', href: '/app/hr/absensi', icon: CameraIcon, permission: 'attendance' },
            { name: 'Laporan Absensi', href: '/app/hr/attendance-report', icon: ClockIcon, permission: 'attendance' },
            { name: 'Belum Clock Out', href: '/app/hr/attendance-not-clocked-out', icon: ClockIcon, permission: 'attendance' },
            { name: 'Kelola Absensi', href: '/app/hr/attendance-admin', icon: ClockIcon, permission: 'attendance' },
            { name: 'Kelola Data Wajah', href: '/app/hr/face-admin', icon: CameraIcon, permission: 'attendance' },
            { name: 'Leave Management', href: '/app/hr/leaves', icon: CalendarDaysIcon, permission: 'leave' },
            { name: 'Payroll', href: '/app/hr/payroll', icon: CurrencyDollarIcon, permission: 'payroll' },
            { name: 'Performance', href: '/app/hr/appraisal', icon: ChartBarIcon, permission: 'appraisal' },
            { name: 'Training', href: '/app/hr/training', icon: AcademicCapIcon, permission: 'training' },
            { name: 'Work Roster', href: '/app/hr/roster', icon: CalendarDaysIcon, permission: 'roster' },
          ]
        },
      ]
    },
    {
      groupName: 'MAINTENANCE & R&D',
      show: canViewAny(['maintenance', 'rd', 'waste', 'oee']),
      items: [
        {
          name: 'Maintenance',
          href: '/app/maintenance',
          icon: WrenchScrewdriverIcon,
          permission: 'maintenance',
          children: [
            { name: 'Dashboard', href: '/app/maintenance', icon: PresentationChartLineIcon },
            { name: 'Work Orders', href: '/app/maintenance/records', icon: ClipboardDocumentListIcon },
            { name: 'Schedule', href: '/app/maintenance/schedules', icon: CalendarDaysIcon },
            { name: 'Checklist NG', href: '/app/maintenance/checklist-ng', icon: ExclamationTriangleIcon },
            { name: 'New Request', href: '/app/maintenance/request/new', icon: ClipboardDocumentCheckIcon },
            { name: 'Analytics', href: '/app/maintenance/analytics', icon: ChartPieIcon },
          ]
        },
        {
          name: 'R&D',
          href: '/app/rnd',
          icon: LightBulbIcon,
          permission: 'rd',
          children: [
            { name: 'Dashboard', href: '/app/rnd', icon: PresentationChartLineIcon },
            { name: 'Proyek', href: '/app/rnd/projects', icon: ClipboardDocumentListIcon },
            { name: 'Approvals', href: '/app/rnd/approvals', icon: CheckCircleIcon },
          ]
        },
        {
          name: 'R&D Legacy',
          href: '/app/rd',
          icon: BeakerIcon,
          permission: 'rd',
          children: [
            { name: 'Dashboard', href: '/app/rd', icon: PresentationChartLineIcon },
            { name: 'Projects', href: '/app/rd/projects', icon: ClipboardDocumentListIcon },
            { name: 'Experiments', href: '/app/rd/experiments', icon: BeakerIcon },
            { name: 'Materials', href: '/app/rd/materials', icon: CubeIcon },
            { name: 'Product Dev', href: '/app/rd/products', icon: RocketLaunchIcon },
            { name: 'Reports', href: '/app/rd/reports', icon: DocumentChartBarIcon },
          ]
        },
        { name: 'Waste Management', href: '/app/waste', icon: TrashIcon, permission: 'waste' },
        { name: 'OEE Monitoring', href: '/app/oee', icon: ChartBarIcon, permission: 'oee' },
      ]
    },
    {
      groupName: 'QUALITY & DCC',
      show: canViewAny(['dcc', 'quality']),
      items: [
        {
          name: 'Document Control',
          href: '/app/dcc',
          icon: DocumentChartBarIcon,
          permission: 'dcc',
          children: [
            { name: 'Dashboard', href: '/app/dcc?tab=dashboard', icon: PresentationChartLineIcon },
            { name: 'Daftar Induk Dokumen', href: '/app/dcc?tab=documents', icon: ClipboardDocumentListIcon },
            { name: 'Change Notice', href: '/app/dcc?tab=change_notice', icon: DocumentTextIcon },
            { name: 'Kaji Ulang', href: '/app/dcc?tab=review', icon: DocumentCheckIcon },
            { name: 'Rekaman Mutu', href: '/app/dcc?tab=quality_records', icon: DocumentTextIcon },
            { name: 'CAPA', href: '/app/dcc?tab=capa', icon: ExclamationTriangleIcon },
            { name: 'Komunikasi Internal', href: '/app/dcc?tab=memos', icon: EnvelopeIcon },
            { name: 'Pemusnahan Dokumen', href: '/app/dcc?tab=destruction', icon: TrashIcon },
          ]
        },
      ]
    },
    {
      groupName: 'REPORTS & SETTINGS',
      items: [
        { name: 'Reports', href: '/app/reports', icon: DocumentChartBarIcon, permission: 'reports' },
        {
          name: 'Documents',
          href: '/app/documents',
          icon: DocumentTextIcon,
          permission: 'documents',
          subItems: [
            { name: 'All Documents', href: '/app/documents' },
            { name: 'Generate', href: '/app/documents/generate' },
            { name: 'Templates', href: '/app/documents/templates', permission: 'templates' }
          ]
        },
        { name: 'TV Display', href: '/app/tv-display', icon: TvIcon, permission: 'tv_display' },
        { name: 'Group Chat', href: '/app/chat', icon: ChatBubbleLeftRightIcon },
        {
          name: 'User Manual',
          href: '/app/manual',
          icon: BookOpenIcon,
          children: [
            { name: 'Dokumentasi', href: '/app/manual', icon: BookOpenIcon },
            { name: 'FAQ', href: '/app/manual/faq', icon: QuestionMarkCircleIcon },
            { name: 'Kelola Manual', href: '/app/manual/admin', icon: Cog6ToothIcon, superAdminOnly: true },
          ]
        },
        { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon, permission: 'settings', superAdminOnly: true },
      ]
    }
  ]

  // Filter menu groups based on active workspace or current page
  const isDeskPage = location.pathname === '/desk'
  const isDashboardPage = location.pathname === '/app'
  const isProductionMonitoringPage = location.pathname === '/app/executive/production-monitoring'
  const utilityPaths = [
    '/app/profile',
    '/app/settings',
    '/app/chat',
    '/app/manual',
    '/app/tv-display',
    '/app/search',
    '/app/integration',
  ]
  const isUtilityPage = utilityPaths.some(p => location.pathname.startsWith(p))

  const menuGroups = navMode === 'classic'
    ? allMenuGroups
    : (isDeskPage || isDashboardPage || isProductionMonitoringPage || isUtilityPage)
      ? allMenuGroups.filter(group => group.groupName === 'MAIN')
      : isInWorkspace && activeWorkspaceConfig
        ? allMenuGroups.map(group => ({
            ...group,
            items: group.items.filter((item: any) => 
              activeWorkspaceConfig.menus.includes(item.name)
            )
          })).filter(group => group.items.length > 0)
        : allMenuGroups

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  return (
    <div className="flex grow flex-col gap-y-3 overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 pb-4">
      {/* User Header with Enhanced Design */}
      <div className="flex h-20 shrink-0 items-center border-b border-slate-700/50 mb-3">
        <div className="flex items-center gap-3 w-full group">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-105">
              <UserCircleIcon className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold tracking-tight truncate group-hover:text-blue-300 transition-colors">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col" role="navigation" aria-label="Menu utama">
        {/* Back to Desk — varian untuk Dashboard & Production Monitoring */}
        {navMode !== 'classic' && (isDashboardPage || isProductionMonitoringPage) && (
          <button
            onClick={() => navigate('/desk')}
            className="flex items-center gap-3 px-4 py-3 mb-4 text-slate-300 dark:text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-200 group"
          >
            <div className="p-1.5 bg-white/10 rounded-lg group-hover:bg-white/20 group-hover:scale-110 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs text-slate-500 leading-none mb-0.5">Navigasi</p>
              <p className="font-semibold text-sm leading-none">Buka Desk</p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Back to Desk — varian standar untuk modul & utility */}
        {navMode !== 'classic' && (isInWorkspace || isUtilityPage) && (
          <button
            onClick={() => navigate('/desk')}
            className="flex items-center gap-3 px-4 py-3 mb-4 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 group"
          >
            <div className="p-1 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span className="font-semibold">Kembali ke Desk</span>
          </button>
        )}
        
        <div className="space-y-6">
          {menuGroups
            .filter((group: any) => group.show === undefined || group.show)
            .map((group: any) => {
              // Filter items based on permission and admin status
              const visibleItems = group.items.filter((item: any) => {
                // If item requires super admin, check isSuperAdmin
                if (item.superAdminOnly && !isSuperAdmin) return false
                // Check permission
                return !item.permission || canView(item.permission)
              })

              if (visibleItems.length === 0) return null

              return (
                <div key={group.groupName}>
                  {/* Group Label with Enhanced Styling */}
                  {group.groupName !== 'MAIN' && (
                    <div className="px-2 mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                        {group.groupName}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
                    </div>
                  )}

                  <ul role="list" className="space-y-1">
                    {visibleItems.map((item: any) => (
                      <li key={item.name}>
                        {item.children ? (
                          // Menu with submenu
                          <div>
                            <button
                              onClick={() => toggleExpanded(item.name.toLowerCase())}
                              className={clsx(
                                expandedItems.includes(item.name.toLowerCase())
                                  ? 'bg-gradient-to-r from-slate-700/80 to-slate-700/50 text-white shadow-lg'
                                  : 'text-slate-300 hover:text-white hover:bg-slate-700/40',
                                'group flex w-full items-center gap-x-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 hover:shadow-md'
                              )}
                            >
                              <div className={clsx(
                                'p-1.5 rounded-lg transition-all duration-200',
                                expandedItems.includes(item.name.toLowerCase()) 
                                  ? 'bg-blue-500/20 shadow-lg shadow-blue-500/20' 
                                  : 'bg-slate-600/30 group-hover:bg-slate-600/50'
                              )}>
                                <item.icon className={clsx(
                                  'h-5 w-5 shrink-0 transition-all duration-200',
                                  expandedItems.includes(item.name.toLowerCase()) 
                                    ? 'text-blue-400 scale-110' 
                                    : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-105'
                                )} aria-hidden="true" />
                              </div>
                              <span className="flex-1 text-left">{item.name}</span>
                              <ChevronDownIcon className={clsx(
                                'h-4 w-4 transition-all duration-300',
                                expandedItems.includes(item.name.toLowerCase()) 
                                  ? 'rotate-180 text-blue-400' 
                                  : 'text-slate-500 group-hover:text-slate-300'
                              )} />
                            </button>

                            {/* Submenu with enhanced animation */}
                            <div className={clsx(
                              'overflow-hidden transition-all duration-300',
                              expandedItems.includes(item.name.toLowerCase()) ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'
                            )}>
                              <ul className="ml-4 border-l-2 border-slate-700/50 pl-3 space-y-0.5">
                                {item.children
                                  .filter((child: any) => !child.permission || canView(child.permission))
                                  .map((child: any) => (
                                    <li key={child.name}>
                                      {child.isSubMenu ? (
                                        // Sub-sub-menu (nested)
                                        <div>
                                          <button
                                            onClick={() => toggleExpanded(`${item.name}-${child.name}`.toLowerCase())}
                                            className={clsx(
                                              expandedItems.includes(`${item.name}-${child.name}`.toLowerCase())
                                                ? 'bg-slate-700/30 text-white'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700/30',
                                              'group flex w-full items-center gap-x-2.5 rounded-md py-2 px-2.5 text-sm transition-all duration-150'
                                            )}
                                          >
                                            {child.icon && <child.icon className="h-4 w-4 shrink-0" />}
                                            <span className="flex-1 text-left">{child.name}</span>
                                            <ChevronDownIcon className={clsx(
                                              'h-3 w-3 transition-transform duration-200',
                                              expandedItems.includes(`${item.name}-${child.name}`.toLowerCase()) ? 'rotate-180 text-blue-400' : 'text-slate-500'
                                            )} />
                                          </button>
                                          <div className={clsx(
                                            'overflow-hidden transition-all duration-200',
                                            expandedItems.includes(`${item.name}-${child.name}`.toLowerCase()) ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                                          )}>
                                            <ul className="mt-1 ml-3 border-l border-slate-600/50 pl-2 space-y-0.5">
                                              {child.subChildren?.map((subChild: any) => (
                                                <li key={subChild.name}>
                                                  <NavLink
                                                    to={subChild.href}
                                                    className={({ isActive }) =>
                                                      clsx(
                                                        isActive
                                                          ? 'bg-blue-600/20 text-blue-400'
                                                          : 'text-slate-400 hover:text-white hover:bg-slate-700/30',
                                                        'group flex items-center gap-x-2 rounded-md py-1.5 px-2 text-xs transition-all duration-150'
                                                      )
                                                    }
                                                  >
                                                    {subChild.name}
                                                  </NavLink>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                      ) : (
                                        // Regular child item — use query-aware active check
                                        child.href.includes('?') ? (
                                          <button
                                            onClick={() => navigate(child.href)}
                                            className={clsx(
                                              isActiveHref(child.href)
                                                ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-400 -ml-[13px] pl-[11px]'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700/30',
                                              'group flex items-center gap-x-2.5 rounded-md py-2 px-2.5 text-sm transition-all duration-150 w-full text-left'
                                            )}
                                          >
                                            {child.icon && <child.icon className="h-4 w-4 shrink-0" />}
                                            {child.name}
                                          </button>
                                        ) : (
                                          <NavLink
                                            to={child.href}
                                            className={({ isActive }) =>
                                              clsx(
                                                isActive
                                                  ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-400 -ml-[13px] pl-[11px]'
                                                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30',
                                                'group flex items-center gap-x-2.5 rounded-md py-2 px-2.5 text-sm transition-all duration-150'
                                              )
                                            }
                                          >
                                            {child.icon && <child.icon className="h-4 w-4 shrink-0" />}
                                            {child.name}
                                          </NavLink>
                                        )
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          // Regular menu item
                          <NavLink
                            to={item.href}
                            end={item.href === '/app'}
                            className={({ isActive }) =>
                              clsx(
                                isActive
                                  ? 'bg-gradient-to-r from-blue-600/20 to-transparent text-white border-l-2 border-blue-500'
                                  : 'text-slate-300 hover:text-white hover:bg-slate-700/30 border-l-2 border-transparent',
                                'group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150'
                              )
                            }
                          >
                            <item.icon className={clsx(
                              'h-5 w-5 shrink-0 transition-colors'
                            )} aria-hidden="true" />
                            {item.name}
                          </NavLink>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
        </div>
      </nav>

      {/* Footer with Theme Toggle, Profile & Logout */}
      <div className="mt-auto pt-4 border-t border-slate-700/50 space-y-3">
        {/* Theme Toggle */}
        <div className="px-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Theme</span>
          <ThemeToggle />
        </div>
        
        {/* Profile & Logout Buttons */}
        <div className="flex gap-2 px-2">
          <button
            onClick={() => navigate('/app/profile')}
            className="flex-1 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            Profil
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMobileClose = () => {
    // Only close if we're actually on mobile
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Mobile sidebar - only render on mobile */}
      {isMobile && (
        <Transition.Root show={open} as={Fragment}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={handleMobileClose}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                      <button type="button" className="-m-2.5 p-2.5" onClick={handleMobileClose}>
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </button>
                    </div>
                  </Transition.Child>
                  <SidebarContent />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:z-40 lg:w-64 lg:flex-col transition-all duration-300 ${open ? 'lg:flex' : 'lg:hidden'
        }`}>
        <SidebarContent />
      </div>
    </>
  )
}
