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
  CircleStackIcon,
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
  ExclamationTriangleIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import axiosInstance from '../../utils/axiosConfig'
import { usePermissions } from '../../contexts/PermissionContext'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

function SidebarContent({ collapsed = false, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void }) {
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [menuSearch, setMenuSearch] = useState('')
  // Kalau sidebar dilebarkan otomatis gara-gara user klik menu-bersubmenu waktu lagi
  // collapsed, begitu user pilih 1 item di dalamnya (navigasi pindah halaman), otomatis
  // ciut lagi balik - user tidak perlu klik panah manual tiap kali (masukan 2026-08-25).
  // Kalau user melebarkan lewat tombol panah sendiri, ini TIDAK aktif (tetap lebar).
  const [autoExpandedFromCollapse, setAutoExpandedFromCollapse] = useState(false)
  // Nama perusahaan diambil dari Settings (bukan di-hardcode "SMITH ERP") - "SMITH ERP"
  // itu cuma nama proyek development, bukan brand yang mau ditampilkan ke user PT.
  // Falmaco. Sama pola dengan Header.tsx (loadCompanySettings + event companySettingsUpdated).
  const [companyName, setCompanyName] = useState('')
  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const response = await axiosInstance.get('/api/settings/company')
        if (response.data?.name) setCompanyName(response.data.name)
      } catch (e) {
        // biarkan fallback ke inisial generik di bawah
      }
    }
    loadCompanyName()
    window.addEventListener('companySettingsUpdated', loadCompanyName)
    return () => window.removeEventListener('companySettingsUpdated', loadCompanyName)
  }, [])
  const companyInitials = companyName
    ? companyName.replace(/^PT\.?\s*/i, '').replace(/,?\s*Tbk\.?$/i, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'ER'
  const { hasPermission, hasAnyPermission, isAdmin, isSuperAdmin, isLoading } = usePermissions()
  const { user } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

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

  // Begitu URL berubah (user pilih 1 menu) DAN sidebar lagi lebar gara-gara auto-expand
  // dari collapsed, ciutkan lagi balik ke rail - lihat catatan di autoExpandedFromCollapse.
  useEffect(() => {
    if (autoExpandedFromCollapse) {
      setAutoExpandedFromCollapse(false)
      onToggleCollapse?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Saat lagi cari menu, semua level otomatis "terbuka" tanpa perlu klik manual -
  // begitu search dikosongkan balik ke state expand/collapse yang user atur sendiri.
  const isExpanded = (key: string) => menuSearch.trim() !== '' || expandedItems.includes(key)

  const matchesQuery = (name: string, q: string) => name.toLowerCase().includes(q)

  // Cocok kalau nama item sendiri, salah satu child, atau salah satu subChild cocok -
  // dipakai buat nge-filter grup/menu pas search diisi, rekursif sampai level terdalam.
  const itemMatchesSearch = (item: any, q: string): boolean => {
    if (matchesQuery(item.name, q)) return true
    if (item.children) {
      return item.children.some((child: any) =>
        matchesQuery(child.name, q) || (child.subChildren?.some((sc: any) => matchesQuery(sc.name, q)) ?? false)
      )
    }
    return false
  }

  // Permission-based menu visibility
  // If still loading or is admin/super admin, show all menus
  const canView = (module: string) => isLoading || isAdmin || isSuperAdmin || hasPermission(`${module}.view`)
  const canViewAny = (modules: string[]) => isLoading || isAdmin || isSuperAdmin || hasAnyPermission(modules.map(m => `${m}.view`))

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
      groupName: 'Sales & Purchasing',
      show: canViewAny(['sales', 'purchasing', 'returns']),
      items: [
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
          name: 'Purchasing',
          href: '/app/purchasing',
          icon: ShoppingBagIcon,
          permission: 'purchasing',
          children: [
            { name: 'Dashboard', href: '/app/purchasing', icon: PresentationChartLineIcon },
            { name: 'Suppliers', href: '/app/purchasing/suppliers', icon: UserGroupIcon, permission: 'suppliers' },
            { name: 'Requisition (PR)', href: '/app/purchasing/requisitions', icon: ClipboardDocumentListIcon },
            { name: 'RFQ', href: '/app/purchasing/rfq', icon: EnvelopeIcon },
            { name: 'Purchase Orders', href: '/app/purchasing/orders', icon: ArchiveBoxIcon, permission: 'purchase_orders' },
            { name: 'Goods Receipt (GRN)', href: '/app/purchasing/grn', icon: DocumentCheckIcon },
            { name: 'Invoice & 3-Way Match', href: '/app/purchasing/invoices', icon: ScaleIcon },
            { name: 'Contracts', href: '/app/purchasing/contracts', icon: BookOpenIcon },
            { name: 'Price Comparison', href: '/app/purchasing/price-comparison', icon: ChartBarIcon },
          ]
        },
        { name: 'Returns', href: '/app/returns', icon: ArrowPathIcon, permission: 'returns' },
      ]
    },
    {
      groupName: 'Operations',
      show: canViewAny(['products', 'inventory', 'warehouse', 'production', 'quality']),
      items: [
        {
          name: 'Master Data',
          href: '/app/master-data',
          icon: CircleStackIcon,
          permission: 'products',
        },
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
                { name: 'Input Stok Manual', href: '/app/warehouse/stock-input' },
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
            {
              name: 'WMS Advanced', icon: SparklesIcon, isSubMenu: true, subChildren: [
                { name: 'Dashboard WMS', href: '/app/wms' },
                { name: 'Stok per SPK', href: '/app/wms/stock-by-wo' },
                { name: 'Konsumsi Material', href: '/app/wms/material-consumption' },
                { name: 'Transaksi Stok', href: '/app/wms/transactions' },
                { name: 'Pick List', href: '/app/wms/pick-lists' },
                { name: 'Transfer Stok', href: '/app/wms/transfers' },
                { name: 'Penyesuaian Stok', href: '/app/warehouse/adjustments' },
                { name: 'Cycle Count', href: '/app/wms/cycle-counts' },
                { name: 'Batch Traceability', href: '/app/wms/batch-traceability' },
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
            { name: 'SPK', href: '/app/production/work-orders', icon: ClipboardDocumentListIcon, permission: 'work_orders' },
            { name: 'Status Pengerjaan', href: '/app/production/work-order-status', icon: ClipboardDocumentListIcon },
            { name: 'WO Monitoring', href: '/app/production/work-orders-monitoring', icon: ChartBarIcon },
            { name: 'Machine Data', href: '/app/production/machines', icon: CogIcon },
            { name: 'Work Center', href: '/app/production/work-center', icon: ChartBarIcon },
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
                { name: 'WIP Stock', href: '/app/production/wip-stock' },
              ]
            },
            { name: 'FG Conversion', href: '/app/production/fg-conversion', icon: ArrowsRightLeftIcon },
            { name: 'Changeover', href: '/app/production/changeovers', icon: ArrowsRightLeftIcon },
            { name: 'Approval', href: '/app/production/approvals', icon: ClipboardDocumentCheckIcon },
            { name: 'Quality Objective', href: '/app/quality/objective/production', icon: ChartBarIcon },
            { name: 'Batch Scheduling', href: '/app/production/batch-scheduling', icon: CalendarDaysIcon },
            { name: 'Batch Planning', href: '/app/production/batch-planning', icon: CalendarDaysIcon },
            {
              name: 'MRP', icon: CalculatorIcon, isSubMenu: true, permission: 'mrp', subChildren: [
                { name: 'MRP Run (Time-Phased)', href: '/app/production/mrp-run' },
                { name: 'Requirement Report (Lama)', href: '/app/production/mrp' },
                { name: 'Demand Planning', href: '/app/production/demand-planning' },
                { name: 'Capacity', href: '/app/production/capacity-planning' },
              ]
            },
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
            { name: 'Ubah Status Batch', href: '/app/quality/batch-status', icon: ArrowPathIcon },
            { name: 'Analytics', href: '/app/quality/analytics', icon: ChartPieIcon },
            { name: 'SPC', href: '/app/quality/spc', icon: ChartBarIcon },
          ]
        },
      ]
    },
    {
      groupName: 'Finance & HR',
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
            { name: 'Expenses', href: '/app/finance/expenses', icon: DocumentTextIcon, permission: 'expense' },
            { name: 'Reimbursements', href: '/app/finance/reimbursements', icon: CurrencyDollarIcon, permission: 'expense' },
            { name: 'Tagihan Rutin', href: '/app/finance/recurring-payments', icon: CurrencyDollarIcon, permission: 'expense' },
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
            { name: 'Proses Akhir Bulan', href: '/app/accounting/period-close', icon: CalculatorIcon },
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
            { name: 'Departemen (Org Unit)', href: '/app/hr/departments', icon: UserGroupIcon, permission: 'employees' },
            { name: 'Master Data Jabatan', href: '/app/hr/positions', icon: UserGroupIcon, permission: 'employees' },
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
      // Ditaruh terpisah di luar alur inti Sales->...->Finance (masukan QA, 2026-08-25) -
      // shipping itu fulfillment/pengiriman akhir, bukan bagian rantai utama.
      groupName: 'Shipping',
      show: canViewAny(['shipping']),
      items: [
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
      ]
    },
    {
      groupName: 'Maintenance & R&D',
      show: canViewAny(['maintenance', 'rd', 'waste', 'oee']),
      items: [
        {
          name: 'Asset Management',
          href: '/app/assets',
          icon: BuildingOfficeIcon,
          permission: 'maintenance',
          children: [
            { name: 'Dashboard', href: '/app/assets', icon: PresentationChartLineIcon },
            { name: 'Daftar Aset', href: '/app/assets/list', icon: ClipboardDocumentListIcon },
            { name: 'Spare Parts', href: '/app/assets/spare-parts', icon: WrenchScrewdriverIcon },
            { name: 'Penyusutan', href: '/app/assets/depreciation', icon: CurrencyDollarIcon },
            { name: 'Tambah Aset', href: '/app/assets/new', icon: ClipboardDocumentCheckIcon },
            { name: 'Functional Location', href: '/app/assets/functional-locations', icon: WrenchScrewdriverIcon },
          ]
        },
        {
          name: 'Maintenance',
          href: '/app/maintenance',
          icon: WrenchScrewdriverIcon,
          permission: 'maintenance',
          children: [
            { name: 'Dashboard', href: '/app/maintenance', icon: PresentationChartLineIcon },
            { name: 'SPK', href: '/app/maintenance/records', icon: ClipboardDocumentListIcon },
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
        { name: 'Early Warning System', href: '/app/ews', icon: ExclamationTriangleIcon, permission: 'oee' },
      ]
    },
    {
      groupName: 'Quality & DCC',
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
      groupName: 'Reports & Settings',
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
        { name: 'Preferensi Akun', href: '/app/settings/account-preferences', icon: Cog6ToothIcon, adminOnly: true },
        { name: 'Accurate Integration', href: '/app/integration/accurate', icon: ArrowPathIcon, adminOnly: true },
        { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon, permission: 'settings', superAdminOnly: true },
      ]
    }
  ]

  const menuGroups = allMenuGroups

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  return (
    <div className="sidebar-scroll flex grow flex-col gap-y-3 overflow-y-auto bg-gradient-to-b from-[#F15D2C] to-[#8C2A1B] px-4 pb-4">
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 999px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.35); }
      `}</style>
      {/* Brand */}
      <div className={clsx('flex h-16 shrink-0 items-center border-b border-white/10 mb-1', collapsed ? 'justify-center' : 'justify-between')}>
        <div className={clsx('flex items-center gap-2.5 min-w-0', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center shrink-0">
            <span className="text-[#F15D2C] text-xs font-bold tracking-tight">{companyInitials}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold leading-none truncate" title={companyName || undefined}>{companyName || 'ERP System'}</p>
              <p className="text-[11px] text-white/60 truncate mt-1">{user?.full_name || 'User'}</p>
            </div>
          )}
        </div>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={() => { setAutoExpandedFromCollapse(false); onToggleCollapse?.() }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors shrink-0"
            title="Ciutkan sidebar"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {onToggleCollapse && collapsed && (
        <button
          onClick={() => { setAutoExpandedFromCollapse(false); onToggleCollapse?.() }}
          className="mx-auto w-6 h-6 flex items-center justify-center rounded-full text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors shrink-0 -mt-3 mb-1"
          title="Lebarkan sidebar"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Search menu */}
      {!collapsed && (
        <div className="relative shrink-0">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full pl-8 pr-2 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15"
          />
        </div>
      )}

      <nav className="flex flex-1 flex-col" role="navigation" aria-label="Menu utama">
        <div className="space-y-5">
          {menuGroups
            .filter((group: any) => group.show === undefined || group.show)
            .map((group: any) => {
              // Filter items based on permission and admin status
              const q = menuSearch.trim().toLowerCase()
              const visibleItems = group.items.filter((item: any) => {
                // If item requires super admin, check isSuperAdmin
                if (item.superAdminOnly && !isSuperAdmin) return false
                if (item.adminOnly && !isAdmin && !isSuperAdmin) return false
                // Check permission
                if (item.permission && !canView(item.permission)) return false
                return !q || itemMatchesSearch(item, q)
              })

              if (visibleItems.length === 0) return null

              return (
                <div key={group.groupName}>
                  {/* Group Label */}
                  {group.groupName !== 'MAIN' && !collapsed && (
                    <div className="px-3 mb-1.5 mt-1">
                      <span className="text-[11px] font-medium text-white/50">
                        {group.groupName}
                      </span>
                    </div>
                  )}

                  <ul role="list" className="space-y-1">
                    {visibleItems.map((item: any) => (
                      <li key={item.name}>
                        {item.children ? (
                          // Menu with submenu
                          <div>
                            <button
                              onClick={() => {
                                if (collapsed) {
                                  onToggleCollapse?.()
                                  setAutoExpandedFromCollapse(true)
                                }
                                toggleExpanded(item.name.toLowerCase())
                              }}
                              title={collapsed ? item.name : undefined}
                              className={clsx(
                                isExpanded(item.name.toLowerCase()) && !collapsed
                                  ? 'bg-white text-[#F15D2C] shadow-sm'
                                  : 'text-white/70 hover:text-white hover:bg-white/10',
                                'group flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                                collapsed && 'justify-center px-0'
                              )}
                            >
                              <item.icon className={clsx(
                                'h-5 w-5 shrink-0 transition-colors duration-150',
                                isExpanded(item.name.toLowerCase()) && !collapsed
                                  ? 'text-[#F15D2C]'
                                  : 'text-white/50 group-hover:text-white/80'
                              )} aria-hidden="true" strokeWidth={isExpanded(item.name.toLowerCase()) ? 2 : 1.5} />
                              {!collapsed && (
                                <>
                                  <span className={clsx(
                                    'flex-1 text-left',
                                    isExpanded(item.name.toLowerCase())
                                      ? 'text-[#F15D2C]'
                                      : 'text-white/70'
                                  )}>{item.name}</span>
                                  <ChevronDownIcon className={clsx(
                                    'h-4 w-4 shrink-0 transition-transform duration-200',
                                    isExpanded(item.name.toLowerCase())
                                      ? 'rotate-180 text-[#F15D2C]'
                                      : 'text-white/40 group-hover:text-white/70'
                                  )} />
                                </>
                              )}
                            </button>

                            {/* Submenu */}
                            <div className={clsx(
                              'overflow-hidden transition-all duration-200',
                              !collapsed && isExpanded(item.name.toLowerCase()) ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'
                            )}>
                              <ul className="ml-4 border-l border-slate-700/60 pl-3 space-y-0.5">
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
                                              isExpanded(`${item.name}-${child.name}`.toLowerCase())
                                                ? 'bg-white text-[#F15D2C] shadow-sm'
                                                : 'text-white/60 hover:text-white hover:bg-white/10',
                                              'group flex w-full items-center gap-x-2.5 rounded-lg py-2 px-2.5 text-sm transition-colors duration-150'
                                            )}
                                          >
                                            {child.icon && <child.icon className="h-4 w-4 shrink-0" />}
                                            <span className="flex-1 text-left">{child.name}</span>
                                            <ChevronDownIcon className={clsx(
                                              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                                              isExpanded(`${item.name}-${child.name}`.toLowerCase()) ? 'rotate-180 text-white' : 'text-white/50'
                                            )} />
                                          </button>
                                          <div className={clsx(
                                            'overflow-hidden transition-all duration-200',
                                            isExpanded(`${item.name}-${child.name}`.toLowerCase()) ? 'max-h-64 opacity-100 mt-0.5' : 'max-h-0 opacity-0'
                                          )}>
                                            <ul className="ml-4 border-l border-slate-700/60 pl-3 space-y-0.5">
                                              {child.subChildren?.map((subChild: any) => (
                                                <li key={subChild.name}>
                                                  <NavLink
                                                    to={subChild.href}
                                                    className={({ isActive }) =>
                                                      clsx(
                                                        isActive
                                                          ? 'bg-white text-[#F15D2C] shadow-sm'
                                                          : 'text-white/60 hover:text-white hover:bg-white/10',
                                                        'group flex items-center gap-x-2 rounded-lg py-1.5 px-2.5 text-sm transition-colors duration-150'
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
                                                ? 'bg-white text-[#F15D2C] shadow-sm'
                                                : 'text-white/60 hover:text-white hover:bg-white/10',
                                              'group flex items-center gap-x-2.5 rounded-lg py-2 px-2.5 text-sm transition-colors duration-150 w-full text-left'
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
                                                  ? 'bg-white text-[#F15D2C] shadow-sm'
                                                  : 'text-white/60 hover:text-white hover:bg-white/10',
                                                'group flex items-center gap-x-2.5 rounded-lg py-2 px-2.5 text-sm transition-colors duration-150'
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
                            end
                            title={collapsed ? item.name : undefined}
                            className={({ isActive }) =>
                              clsx(
                                isActive
                                  ? 'bg-white text-[#F15D2C] shadow-sm'
                                  : 'text-white/70 hover:text-white hover:bg-white/10',
                                'group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                                collapsed && 'justify-center px-0'
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <item.icon className="h-5 w-5 shrink-0 transition-colors duration-150" strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
                                {!collapsed && item.name}
                              </>
                            )}
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
      <div className={clsx('mt-auto pt-4 border-t border-white/10 space-y-3', collapsed && 'flex flex-col items-center')}>
        {/* Theme Toggle */}
        {collapsed ? (
          <ThemeToggle />
        ) : (
          <div className="px-2 flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Theme</span>
            <ThemeToggle />
          </div>
        )}

        {/* Profile & Logout Buttons */}
        {collapsed ? (
          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-2 px-2">
            <button
              onClick={() => navigate('/app/profile')}
              className="flex-1 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
        )}
      </div>
    </div>
  )
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  // Icon-only rail mode (desktop only) - persist di localStorage + broadcast event supaya
  // Layout.tsx bisa ikut nyesuain padding konten tanpa perlu di-lift lewat prop.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('erp_sidebar_collapsed') === 'true');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Header.tsx punya tombol hamburger sendiri (dipakai buka/tutup drawer di mobile) -
  // di desktop, tombol yang sama dipakai Layout.tsx buat toggle collapse ini (lihat
  // handleHeaderToggle di Layout.tsx) supaya tidak ada 2 kontrol beda yang bikin bingung
  // (masukan user 2026-08-25: "tombol 3 baris itu penyebabnya"). Listener ini yang bikin
  // Sidebar ikut sinkron kalau collapse di-toggle dari luar (Header), bukan cuma dari
  // tombol panah di dalam sidebar sendiri.
  useEffect(() => {
    const syncCollapsed = () => setCollapsed(localStorage.getItem('erp_sidebar_collapsed') === 'true');
    window.addEventListener('erp-sidebar-collapsed-changed', syncCollapsed);
    return () => window.removeEventListener('erp-sidebar-collapsed-changed', syncCollapsed);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('erp_sidebar_collapsed', String(next));
      window.dispatchEvent(new Event('erp-sidebar-collapsed-changed'));
      return next;
    });
  };

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
      <div className={`hidden lg:fixed lg:inset-y-0 lg:z-40 ${collapsed ? 'lg:w-[84px]' : 'lg:w-64'} lg:flex-col transition-all duration-300 ${open ? 'lg:flex' : 'lg:hidden'
        }`}>
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>
    </>
  )
}
