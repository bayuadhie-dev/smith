import { Fragment, useState, useEffect, useRef } from 'react'
import { clearWorkspaceStorage } from '../../workspace/WorkspaceContext'
import { Dialog, Transition } from '@headlessui/react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logout } from '../../store/slices/authSlice'
import SidebarSearch from './SidebarSearch'
import SidebarActiveMarker from './SidebarActiveMarker'
import SidebarSearchResults from './SidebarSearchResults'
import { flattenMenu, getMenuEntries, searchMenu, setMenuEntries } from '../../utils/menuIndex'
import { useDataSearch } from '../../hooks/useDataSearch'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BookOpenIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
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
  ChevronRightIcon,
  ArrowUturnLeftIcon
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
  // Kelompok menu yang sedang dilipat. Dengan ~50 modul, satu kelompok yang
  // tidak pernah dipakai cuma memanjangkan gulungan - sekarang bisa ditutup,
  // dan pilihannya diingat per peramban.
  const [closedGroups, setClosedGroups] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('erp_sidebar_groups_closed') || '[]') } catch { return [] }
  })
  const isGroupClosed = (name: string) => closedGroups.includes(name)
  const toggleGroup = (name: string) => {
    setClosedGroups((prev) => {
      const next = prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
      try { localStorage.setItem('erp_sidebar_groups_closed', JSON.stringify(next)) } catch { /* abaikan */ }
      return next
    })
  }
  const [menuSearch, setMenuSearch] = useState('')
  const { hits: dataHits, loading: dataLoading } = useDataSearch(menuSearch)
  // Kalau sidebar dilebarkan otomatis gara-gara user klik menu-bersubmenu waktu lagi
  // collapsed, begitu user pilih 1 item di dalamnya (navigasi pindah halaman), otomatis
  // ciut lagi balik - user tidak perlu klik panah manual tiap kali (masukan 2026-08-25).
  // Kalau user melebarkan lewat tombol panah sendiri, ini TIDAK aktif (tetap lebar).
  const [autoExpandedFromCollapse, setAutoExpandedFromCollapse] = useState(false)
  // Nama perusahaan diambil dari Settings (bukan di-hardcode "SMITH ERP") - "SMITH ERP"
  // itu cuma nama proyek development, bukan brand yang mau ditampilkan ke user PT.
  // Falmaco. Sama pola dengan Header.tsx (loadCompanySettings + event companySettingsUpdated).
  const navRef = useRef<HTMLElement>(null)
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('erp_company_logo') || '')
  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const response = await axiosInstance.get('/api/settings/company')
        if (response.data?.name) {
          setCompanyName(response.data.name)
          // Cached so the splash screen (SplashReveal) can use the same logo
          // and initials without waiting for a request when a page opens.
          try { localStorage.setItem('erp_company_name', response.data.name) } catch { /* abaikan */ }
        }
        const logo = response.data?.logoUrl
          ? `${axiosInstance.defaults.baseURL || ''}${response.data.logoUrl}`
          : ''
        setLogoUrl(logo)
        try {
          if (logo) localStorage.setItem('erp_company_logo', logo)
          else localStorage.removeItem('erp_company_logo')
        } catch { /* abaikan */ }
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

  const handleLogout = () => {
    clearWorkspaceStorage()
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
        { name: 'Monitoring Produksi', href: '/app/executive/production-monitoring', icon: ChartBarIcon, permission: 'dashboard' },
        { name: 'Patroli Mesin', description: 'Patrol mesin berkala setiap 2 jam', href: '/app/production/live-monitoring', icon: SignalIcon, permission: 'dashboard' },
        { name: 'Checklist Awal Shift', href: '/app/production/pre-shift-checklist', icon: ClipboardDocumentCheckIcon, permission: 'production' },
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
            { name: 'Pelanggan', href: '/app/sales/customers', icon: UserGroupIcon, permission: 'customers' },
            { name: 'Calon Pelanggan (Lead)', href: '/app/sales/leads', icon: UserGroupIcon, permission: 'leads' },
            { name: 'Peluang Penjualan', href: '/app/sales/opportunities', icon: ChartBarIcon },
            { name: 'Penawaran Harga', href: '/app/sales/quotations', icon: DocumentTextIcon, permission: 'quotations' },
            { name: 'Pesanan Penjualan (SO)', href: '/app/sales/orders', icon: ClipboardDocumentListIcon, permission: 'sales_orders' },
            { name: 'Surat Jalan', href: '/app/shipping/orders', icon: TruckIcon, permission: 'shipping' },
            { name: 'Faktur Penjualan', href: '/app/finance/invoices?scope=sales', icon: ReceiptPercentIcon, permission: 'invoices' },
            { name: 'Forecast Penjualan', href: '/app/sales/forecasts', icon: ChartPieIcon },
          ]
        },
        {
          name: 'Purchasing',
          href: '/app/purchasing',
          icon: ShoppingBagIcon,
          permission: 'purchasing',
          children: [
            { name: 'Dashboard', href: '/app/purchasing', icon: PresentationChartLineIcon },
            { name: 'Pemasok', href: '/app/purchasing/suppliers', icon: UserGroupIcon, permission: 'suppliers' },
            { name: 'Permintaan Pembelian (PR)', href: '/app/purchasing/requisitions', icon: ClipboardDocumentListIcon },
            { name: 'Permintaan Penawaran (RFQ)', href: '/app/purchasing/rfq', icon: EnvelopeIcon },
            { name: 'Pesanan Pembelian (PO)', href: '/app/purchasing/orders', icon: ArchiveBoxIcon, permission: 'purchase_orders' },
            { name: 'Penerimaan Barang (GRN)', href: '/app/purchasing/grn', icon: DocumentCheckIcon },
            { name: 'Faktur Pembelian & Pencocokan', href: '/app/purchasing/invoices', icon: ScaleIcon },
            { name: 'Uang Muka Pembelian', href: '/app/purchasing/down-payments', icon: BanknotesIcon },
            { name: 'Retur Pembelian', href: '/app/purchasing/returns', icon: ArrowUturnLeftIcon },
            { name: 'Kontrak Pemasok', href: '/app/purchasing/contracts', icon: BookOpenIcon },
            { name: 'Perbandingan Harga', href: '/app/purchasing/price-comparison', icon: ChartBarIcon },
          ]
        },
        { name: 'Retur Penjualan', href: '/app/returns', icon: ArrowPathIcon, permission: 'returns' },
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
            { name: 'Daftar Produk', href: '/app/products', icon: CubeIcon },
            { name: 'Dashboard', href: '/app/products/dashboard', icon: PresentationChartLineIcon },
            { name: 'Analisa Produk', href: '/app/products/analytics', icon: ChartPieIcon },
            { name: 'Kategori Produk', href: '/app/products/categories', icon: ArchiveBoxIcon },
            { name: 'BOM (Bill of Materials)', href: '/app/products/bom', icon: ClipboardDocumentListIcon, permission: 'bom' },
            { name: 'Siklus Hidup Produk', href: '/app/products/lifecycle', icon: ArrowPathIcon },
          ]
        },
        {
          name: 'Inventory',
          href: '/app/warehouse',
          icon: BuildingStorefrontIcon,
          permission: 'warehouse',
          children: [
            { name: 'Dashboard', href: '/app/warehouse', icon: PresentationChartLineIcon },
            {
              name: 'Transaksi', icon: ArrowsRightLeftIcon, isSubMenu: true, subChildren: [
                { name: 'Permintaan Barang', href: '/app/warehouse/material-issues' },
                { name: 'Pemindahan & Penerimaan Barang', href: '/app/warehouse/transfers' },
              ]
            },
            {
              name: 'Opname & Penyesuaian', icon: AdjustmentsHorizontalIcon, isSubMenu: true, subChildren: [
                { name: 'Penyesuaian Stok', href: '/app/warehouse/adjustments' },
                { name: 'Input Stok Manual', href: '/app/warehouse/stock-input' },
                { name: 'Penambahan Bahan Baku', href: '/app/warehouse/inventory' },
                { name: 'Perintah Opname', href: '/app/warehouse/stock-opname' },
                { name: 'Hasil Opname', href: '/app/warehouse/stock-opname/results' },
                { name: 'Hitung Siklus (Cycle Count)', href: '/app/wms/cycle-counts' },
              ]
            },
            {
              name: 'Barang & Gudang', icon: CubeIcon, isSubMenu: true, subChildren: [
                { name: 'Dashboard Material', href: '/app/warehouse/materials' },
                { name: 'Daftar Barang & Material', href: '/app/warehouse/materials/list' },
                { name: 'Master Gudang', href: '/app/warehouse/zones' },
                { name: 'Lokasi Gudang', href: '/app/warehouse/locations' },
                { name: 'Satuan Barang', href: '/app/warehouse/uom' },
              ]
            },
            {
              name: 'Laporan', icon: DocumentChartBarIcon, isSubMenu: true, subChildren: [
                { name: 'Ringkasan Stok per Gudang', href: '/app/warehouse/stock-summary' },
                { name: 'Mutasi Stok', href: '/app/warehouse/movements' },
                { name: 'Nilai Persediaan', href: '/app/finance/reports/inventory-mutation' },
                { name: 'Kuantitas Barang per Gudang', href: '/app/finance/reports/inventory-by-warehouse' },
                { name: 'Selisih Stok Fisik vs Buku Stok', href: '/app/finance/reports/stock-vs-ledger' },
                { name: 'Batch Segera Kedaluwarsa', href: '/app/finance/reports/near-expiry' },
                { name: 'Stok Minimum', href: '/app/warehouse/alerts' },
                { name: 'Analisa Gudang', href: '/app/warehouse/analytics' },
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
            { name: 'SPK', description: 'Surat Perintah Kerja (Work Order)', href: '/app/production/work-orders', icon: ClipboardDocumentListIcon, permission: 'work_orders' },
            { name: 'Roll Spunlace', href: '/app/production/rolls', icon: ArrowPathIcon },
            { name: 'Stok WIP', href: '/app/production/wip-stock', icon: ArchiveBoxIcon },
            { name: 'Persetujuan Produksi', href: '/app/production/approvals', icon: ClipboardDocumentCheckIcon },
            {
              name: 'Monitoring SPK', icon: ChartBarIcon, isSubMenu: true, subChildren: [
                { name: 'Status Pengerjaan', href: '/app/production/work-order-status' },
                { name: 'Monitoring SPK Real-time', href: '/app/production/work-orders-monitoring' },
              ]
            },
            {
              name: 'Jadwal', icon: CalendarDaysIcon, isSubMenu: true, subChildren: [
                { name: 'Jadwal Mingguan', href: '/app/production/scheduling' },
                { name: 'Jadwal Bulanan', href: '/app/production/monthly-schedule' },
              ]
            },
            {
              name: 'Controller', icon: ChartBarIcon, isSubMenu: true, subChildren: [
                { name: 'Harian', href: '/app/production/controller' },
                { name: 'Mingguan', href: '/app/production/weekly-controller' },
                { name: 'Bulanan', href: '/app/production/monthly-controller' },
              ]
            },
            {
              name: 'Proses Produksi', icon: ArrowsRightLeftIcon, isSubMenu: true, subChildren: [
                { name: 'Converting', href: '/app/production/converting' },
                { name: 'Konversi Barang Jadi', href: '/app/production/fg-conversion' },
                { name: 'Changeover Mesin', href: '/app/production/changeovers' },
              ]
            },
            {
              name: 'Batch', icon: CalendarDaysIcon, isSubMenu: true, subChildren: [
                { name: 'Penjadwalan Batch', href: '/app/production/batch-scheduling' },
                { name: 'Laporan Batch', href: '/app/production/batch-records' },
                { name: 'Perencanaan Batch', href: '/app/production/batch-planning' },
              ]
            },
            {
              name: 'MRP', icon: CalculatorIcon, isSubMenu: true, permission: 'mrp', subChildren: [
                { name: 'MRP Run', href: '/app/production/mrp-run' },
                { name: 'Perencanaan Kebutuhan', href: '/app/production/demand-planning' },
                { name: 'Kapasitas Produksi', href: '/app/production/capacity-planning' },
              ]
            },
            {
              name: 'WMS (Gudang Produksi)', icon: SparklesIcon, isSubMenu: true, subChildren: [
                { name: 'Dashboard WMS', href: '/app/wms' },
                { name: 'Stok per SPK', href: '/app/wms/stock-by-wo' },
                { name: 'Konsumsi Material', href: '/app/wms/material-consumption' },
                { name: 'Daftar Ambil (Pick List)', href: '/app/wms/pick-lists' },
                { name: 'Transfer Stok', href: '/app/wms/transfers' },
                { name: 'Telusur Batch', href: '/app/wms/batch-traceability' },
              ]
            },
            {
              name: 'Sumber Daya', icon: CogIcon, isSubMenu: true, subChildren: [
                { name: 'Data Mesin', href: '/app/production/machines' },
                { name: 'Pusat Kerja (Work Center)', href: '/app/production/work-center' },
              ]
            },
            {
              name: 'Laporan & Analisa', icon: DocumentChartBarIcon, isSubMenu: true, subChildren: [
                { name: 'Sisa Order', href: '/app/production/remaining-stock' },
                { name: 'Sasaran Mutu', href: '/app/quality/objective/production' },
                { name: 'Efisiensi Produksi', href: '/app/production/efficiency' },
                { name: 'Telusur Produksi', href: '/app/production/traceability' },
                { name: 'Laporan Customer MBF', href: '/app/production/mbf-report' },
              ]
            },
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
            { name: 'Analisa Mutu', href: '/app/quality/analytics', icon: ChartPieIcon },
            { name: 'SPC (Kendali Proses)', description: 'Statistical Process Control', href: '/app/quality/spc', icon: ChartBarIcon },
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
            { name: 'Pencarian Transaksi', href: '/app/finance/search', icon: MagnifyingGlassIcon },
            { name: 'Pusat Laporan Keuangan', href: '/app/finance/reports', icon: DocumentChartBarIcon },
            { name: 'Faktur Penjualan & Pembelian', href: '/app/finance/invoices', icon: DocumentTextIcon },
            { name: 'Laporan Penjualan', href: '/app/finance/sales-report', icon: DocumentTextIcon },
            { name: 'Umur Piutang & Hutang', href: '/app/finance/aging', icon: DocumentTextIcon },
            { name: 'Nota Kredit Pelanggan', href: '/app/finance/credit-memos', icon: DocumentTextIcon },
            { name: 'Penerimaan Penjualan', href: '/app/finance/penerimaan-penjualan', icon: BanknotesIcon },
            { name: 'Pembayaran Pembelian', href: '/app/finance/pembayaran-pembelian', icon: BanknotesIcon },
            { name: 'Penerimaan Kas/Bank', href: '/app/finance/penerimaan', icon: BanknotesIcon },
            { name: 'Pembayaran Kas/Bank', href: '/app/finance/pembayaran', icon: BanknotesIcon },
            { name: 'Transfer Kas/Bank', href: '/app/finance/bank-transfers', icon: ArrowsRightLeftIcon },
            { name: 'Rekap Uang Muka Lainnya', href: '/app/finance/rekap-uang-muka', icon: BanknotesIcon },
            { name: 'Anggaran', href: '/app/finance/budget', icon: CurrencyDollarIcon },
            { name: 'Arus Kas', href: '/app/finance/cash-flow', icon: ArrowsRightLeftIcon },
            { name: 'Klaim Biaya Karyawan', href: '/app/finance/expenses', icon: DocumentTextIcon, permission: 'expense' },
            { name: 'Tagihan Rutin', href: '/app/finance/recurring-payments', icon: CurrencyDollarIcon, permission: 'expense' },
            { name: 'Persetujuan Dokumen', href: '/app/approval', icon: DocumentCheckIcon, permission: 'approval' },
          ]
        },
        {
          name: 'Accounting',
          href: '/app/accounting',
          icon: CalculatorIcon,
          permission: 'finance',
          children: [
            {
              name: 'Buku Besar', icon: DocumentTextIcon, isSubMenu: true, subChildren: [
                { name: 'Daftar Akun (COA)', href: '/app/accounting/chart-of-accounts' },
                { name: 'Buku Besar', href: '/app/accounting/general-ledger' },
                { name: 'Jurnal Umum', href: '/app/accounting/journal' },
              ]
            },
            {
              name: 'Piutang & Hutang', icon: ArrowsRightLeftIcon, isSubMenu: true, subChildren: [
                { name: 'Piutang Usaha', href: '/app/accounting/receivable' },
                { name: 'Utang Usaha', href: '/app/accounting/payable' },
              ]
            },
            { name: 'Rekonsiliasi Bank', href: '/app/accounting/bank-reconciliation', icon: ArrowsRightLeftIcon },
            { name: 'Proses Akhir Bulan', href: '/app/accounting/period-close', icon: CalculatorIcon },
            { name: 'Pajak & e-Faktur', href: '/app/accounting/tax', icon: ReceiptPercentIcon },
            { name: 'Buku Besar WIP', href: '/app/finance/wip-ledger', icon: CubeIcon },
            { name: 'Laporan Keuangan', href: '/app/accounting/reports', icon: DocumentChartBarIcon },
          ]
        },
        {
          name: 'Human Resources',
          href: '/app/hr',
          icon: UsersIcon,
          permission: 'hr',
          children: [
            { name: 'Dashboard', href: '/app/hr/dashboard', icon: PresentationChartLineIcon },
            // 2026-09-27: konsolidasi 2 sistem leave paralel (Leave vs
            // StaffLeaveRequest) jadi satu - StaffLeaveRequest yang menang
            // (office-location geofence + calendar + public submit sudah
            // lebih matang), sekarang ditambah manager routing + ESS
            // self-submit yang tadinya hanya ada di Leave. /hr/leaves
            // (LeaveManagement) dipensiunkan, jangan dipakai lagi.
            { name: 'Cuti', href: '/app/hr/staff-leave', icon: CalendarDaysIcon, permission: 'leave' },
            { name: 'Roster Shift Produksi', href: '/app/hr/roster', icon: CalendarDaysIcon, permission: 'roster' },
            { name: 'Penggajian (Payroll)', href: '/app/hr/payroll', icon: CurrencyDollarIcon, permission: 'payroll' },
            { name: 'Kas Kecil', href: '/app/hr/petty-cash', icon: BanknotesIcon, permission: 'petty_cash' },
            { name: 'Penilaian Kinerja', href: '/app/hr/appraisal', icon: ChartBarIcon, permission: 'appraisal' },
            { name: 'Pelatihan', href: '/app/hr/training', icon: AcademicCapIcon, permission: 'training' },
            {
              name: 'Master Data Karyawan', icon: UserGroupIcon, isSubMenu: true, permission: 'employees', subChildren: [
                { name: 'Karyawan', href: '/app/hr/employees' },
                { name: 'Departemen (Org Unit)', href: '/app/hr/departments' },
                { name: 'Master Data Jabatan', href: '/app/hr/positions' },
              ]
            },
            {
              name: 'Absensi', icon: ClockIcon, isSubMenu: true, permission: 'attendance', subChildren: [
                { name: 'Absensi (Foto)', href: '/app/hr/absensi' },
                { name: 'Log Absensi Fingerprint', href: '/app/hr/fingerprint-attendance' },
                { name: 'Pola Jadwal Absensi', href: '/app/hr/attendance-schedules' },
                { name: 'Laporan Absensi', href: '/app/hr/attendance-report' },
                { name: 'Belum Clock Out', href: '/app/hr/attendance-not-clocked-out' },
                { name: 'Kelola Absensi', href: '/app/hr/attendance-admin' },
                { name: 'Koreksi & Rekonsiliasi', href: '/app/hr/attendance-reconciliation' },
                { name: 'Jadwal Kerja Staf Kantor', href: '/app/hr/work-schedules' },
                { name: 'Kelola Data Wajah', href: '/app/hr/face-admin' },
              ]
            },
            { name: 'Laporan HR', href: '/app/hr/reports', icon: DocumentChartBarIcon, permission: 'hr' },
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
            { name: 'Surat Jalan', href: '/app/shipping/orders', icon: ClipboardDocumentListIcon },
            { name: 'Pelacakan Kiriman', href: '/app/shipping/tracking', icon: MapPinIcon },
            { name: 'Kalkulator Ongkos Kirim', href: '/app/shipping/calculator', icon: CalculatorIcon },
            { name: 'Ekspedisi', href: '/app/shipping/providers', icon: TruckIcon },
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
            { name: 'Suku Cadang Aset', href: '/app/assets/spare-parts', icon: WrenchScrewdriverIcon },
            { name: 'Penyusutan Aset', href: '/app/assets/depreciation', icon: CurrencyDollarIcon },
            { name: 'Tambah Aset', href: '/app/assets/new', icon: ClipboardDocumentCheckIcon },
            { name: 'Lokasi Fungsional', description: 'Hierarki lokasi Plant > Building > Line untuk penempatan aset/mesin', href: '/app/assets/functional-locations', icon: WrenchScrewdriverIcon },
          ]
        },
        {
          name: 'Maintenance',
          href: '/app/maintenance',
          icon: WrenchScrewdriverIcon,
          permission: 'maintenance',
          children: [
            { name: 'Dashboard', href: '/app/maintenance', icon: PresentationChartLineIcon },
            { name: 'SPK Perawatan', description: 'Surat Perintah Kerja (Work Order) Maintenance', href: '/app/maintenance/records', icon: ClipboardDocumentListIcon },
            { name: 'Jadwal Perawatan', href: '/app/maintenance/schedules', icon: CalendarDaysIcon },
            { name: 'Checklist Barang Reject (NG)', href: '/app/maintenance/checklist-ng', icon: ExclamationTriangleIcon },
            { name: 'Buat Permintaan Perawatan', href: '/app/maintenance/request/new', icon: ClipboardDocumentCheckIcon },
            {
              name: 'Suku Cadang', icon: CubeIcon, isSubMenu: true, subChildren: [
                { name: 'Gudang Suku Cadang', href: '/app/maintenance/spare-parts' },
                { name: 'Suku Cadang per Mesin', href: '/app/maintenance/machine-parts' },
                { name: 'Permintaan Suku Cadang', href: '/app/maintenance/spare-part-requests' },
              ]
            },
            { name: 'Analisa Perawatan', href: '/app/maintenance/analytics', icon: ChartPieIcon },
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
            { name: 'Persetujuan R&D', href: '/app/rnd/approvals', icon: CheckCircleIcon },
          ]
        },
        { name: 'Manajemen Limbah', href: '/app/waste', icon: TrashIcon, permission: 'waste' },
        { name: 'Monitoring OEE', description: 'Overall Equipment Effectiveness', href: '/app/oee', icon: ChartBarIcon, permission: 'oee' },
        { name: 'Peringatan Dini (EWS)', href: '/app/ews', icon: ExclamationTriangleIcon, permission: 'oee' },
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
            { name: 'CAPA (Tindakan Perbaikan)', href: '/app/dcc?tab=capa', icon: ExclamationTriangleIcon },
            { name: 'Komunikasi Internal', href: '/app/dcc?tab=memos', icon: EnvelopeIcon },
            { name: 'Pemusnahan Dokumen', href: '/app/dcc?tab=destruction', icon: TrashIcon },
          ]
        },
      ]
    },
    {
      groupName: 'Reports & Settings',
      items: [
        { name: 'Pusat Laporan', href: '/app/reports', icon: DocumentChartBarIcon, permission: 'reports' },
        { name: 'Pusat Impor & Ekspor Data', href: '/app/imports', icon: ArrowUpTrayIcon },
        // Lintas modul (Purchasing/Production/Shipping/Finance semua
        // menulis ke sini - lihat plan.md) - bukan cuma milik Warehouse
        // lagi, jadi ditaruh di sini bukan di bawah Warehouse > WMS
        // Advanced (2026-09-21, koreksi dari keputusan awal di plan.md
        // bagian 6 yang menaruhnya di WMS Advanced sebelum laporan ini
        // berkembang mencakup GL journal dari modul lain).
        { name: 'Transaksi Stok', href: '/app/wms/transactions', icon: ArrowsRightLeftIcon },
        {
          name: 'Dokumen Transaksi',
          href: '/app/documents',
          icon: DocumentTextIcon,
          permission: 'documents',
          subItems: [
            { name: 'Daftar Dokumen', href: '/app/documents' },
            { name: 'Buat Dokumen', href: '/app/documents/generate' },
            { name: 'Template Dokumen', href: '/app/documents/templates', permission: 'templates' }
          ]
        },
        { name: 'TV Display', href: '/app/tv-display', icon: TvIcon, permission: 'tv_display' },
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
        { name: 'Pengaturan Sistem', href: '/app/settings', icon: Cog6ToothIcon, permission: 'settings', superAdminOnly: true },
      ]
    }
  ]

  const menuGroups = allMenuGroups
  const itemAllowed = (item: any) => {
    if (item.superAdminOnly && !isSuperAdmin) return false
    if (item.adminOnly && !isAdmin && !isSuperAdmin) return false
    if (item.permission && !canView(item.permission)) return false
    return true
  }
  const menuQuery = menuSearch.trim()
  const searching = menuQuery.length > 0
  const menuHits = searching ? searchMenu(menuQuery) : []
  setMenuEntries(flattenMenu(allMenuGroups as any[], itemAllowed))

  // Penanda menu aktif: hanya menu dengan jalur TERPANJANG yang cocok yang disorot, supaya
  // "Dashboard" (/app/finance) tidak ikut menyala saat membuka /app/finance/pembayaran-pembelian.
  const normalizePath = (href: string) => (href.split('?')[0].replace(/\/+$/, '') || '/')
  const currentPath = normalizePath(location.pathname)
  const currentQuery = location.search.replace(/^\?/, '')
  const menuPaths = getMenuEntries().map((e) => ({ base: normalizePath(e.href), query: e.href.split('?')[1] || '' }))
  const activeBase = menuPaths.reduce((best, m) => (
    (currentPath === m.base || currentPath.startsWith(m.base === '/' ? '/' : `${m.base}/`)) && m.base.length > best.length ? m.base : best
  ), '')
  const isActivePath = (href?: string) => {
    if (!href) return false
    const base = normalizePath(href)
    if (base !== activeBase) return false
    const query = href.split('?')[1] || ''
    if (query) return currentQuery === query
    // Menu tanpa query tidak aktif bila ada menu lain dengan query yang persis cocok (mis. Faktur Penjualan ?scope=sales).
    return !menuPaths.some((m) => m.base === base && m.query && m.query === currentQuery)
  }
  const hasActiveChild = (node: any): boolean =>
    [...(node.children || []), ...(node.subChildren || [])].some((c: any) => isActivePath(c.href) || hasActiveChild(c))

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  return (
    <div className="dark sidebar-themed sidebar-scroll flex grow flex-col gap-y-3 overflow-y-auto bg-white dark:bg-gray-900 px-4 pb-4 border-r border-gray-200 dark:border-gray-800">
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 999px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.35); }
      `}</style>
      {/* Brand */}
      {/* Kartu ruang kerja, bukan sekadar baris judul: logo, nama perusahaan,
          dan siapa yang sedang masuk - satu blok yang berdiri sendiri. */}
      <div className={clsx(
        'mt-3 mb-1 flex shrink-0 items-center rounded-xl bg-white/[0.07] p-2.5 ring-1 ring-white/10',
        collapsed ? 'justify-center' : 'justify-between',
      )}>
        <div className={clsx('flex items-center gap-2.5 min-w-0', collapsed && 'justify-center')}>
          <div data-brand-mark className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden',
            logoUrl ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700' : 'bg-primary-600',
          )}>
            {logoUrl ? (
              <img src={logoUrl} alt={companyName || 'Logo perusahaan'} className="h-full w-full object-contain p-0.5"
                   onError={() => setLogoUrl('')} />
            ) : (
              <span className="text-white text-xs font-bold tracking-tight">{companyInitials}</span>
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-gray-900 dark:text-white text-sm font-semibold leading-none truncate" title={companyName || undefined}>{companyName || 'ERP System'}</p>
              {/* Nama pengguna ada di kartu kaki sidebar - di sini cukup
                  identitas perusahaannya saja supaya tidak dobel. */}
              <p className="fn-label mt-1 truncate">Sistem ERP</p>
            </div>
          )}
        </div>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={() => { setAutoExpandedFromCollapse(false); onToggleCollapse?.() }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
            title="Ciutkan sidebar"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {onToggleCollapse && collapsed && (
        <button
          onClick={() => { setAutoExpandedFromCollapse(false); onToggleCollapse?.() }}
          className="mx-auto w-6 h-6 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0 -mt-3 mb-1"
          title="Lebarkan sidebar"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Pencarian: menu disaring di sidebar, hasil data tampil sebagai dropdown */}
      {!collapsed && <SidebarSearch value={menuSearch} onChange={setMenuSearch} loading={dataLoading} />}

      <nav ref={navRef} className="relative flex flex-1 flex-col" role="navigation" aria-label="Menu utama">
        <SidebarActiveMarker container={navRef} />
        {searching ? (
          <SidebarSearchResults
            query={menuQuery}
            menuHits={menuHits}
            dataHits={dataHits}
            loading={dataLoading}
            onPick={() => setMenuSearch('')}
          />
        ) : (
        <div className="space-y-4">
          {menuGroups
            .filter((group: any) => group.show === undefined || group.show)
            .map((group: any) => {
              // Filter items based on permission and admin status
              const q = menuSearch.trim().toLowerCase()
              const visibleItems = group.items.filter((item: any) => itemAllowed(item) && (!q || itemMatchesSearch(item, q)))

              if (visibleItems.length === 0) return null

              return (
                <div key={group.groupName}>
                  {/* Judul kelompok: menempel di atas saat menu digulung, dan
                      bisa diklik untuk melipat seluruh kelompoknya. */}
                  {group.groupName !== 'MAIN' && !collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.groupName)}
                      aria-expanded={!isGroupClosed(group.groupName)}
                      className="sticky top-0 z-10 -mx-1 mb-1.5 mt-1 flex w-[calc(100%+0.5rem)] items-center gap-2 px-4 py-1.5 text-left"
                      style={{ backgroundColor: 'rgb(var(--sidebar-bg))' }}
                      title={isGroupClosed(group.groupName) ? 'Buka kelompok' : 'Lipat kelompok'}
                    >
                      <span className="fn-label whitespace-nowrap">{group.groupName}</span>
                      <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                      <ChevronDownIcon className={clsx(
                        'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500',
                        isGroupClosed(group.groupName) && '-rotate-90',
                      )} />
                    </button>
                  )}

                  <ul role="list" className={clsx(
                    'space-y-0.5',
                    !collapsed && group.groupName !== 'MAIN' && isGroupClosed(group.groupName) && 'hidden',
                  )}>
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
                                hasActiveChild(item)
                                  ? 'bg-gray-100 text-gray-900 dark:bg-white/[0.09] dark:text-white'
                                  : isExpanded(item.name.toLowerCase()) && !collapsed
                                    ? 'bg-gray-50 text-gray-900 dark:bg-white/[0.05] dark:text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white dark:hover:bg-white/[0.06]',
                                'group fn-press flex w-full items-center gap-x-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
                                collapsed && 'justify-center px-0'
                              )}
                            >
                              <item.icon className={clsx(
                                'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
                                isExpanded(item.name.toLowerCase()) && !collapsed || hasActiveChild(item)
                                  ? 'text-current'
                                  : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                              )} aria-hidden="true" strokeWidth={isExpanded(item.name.toLowerCase()) ? 2 : 1.5} />
                              {!collapsed && (
                                <>
                                  <span className={clsx(
                                    'flex-1 text-left',
                                    isExpanded(item.name.toLowerCase()) || hasActiveChild(item)
                                      ? 'text-current'
                                      : 'text-gray-600 dark:text-gray-300'
                                  )}>{item.name}</span>
                                  <ChevronDownIcon className={clsx(
                                    'h-4 w-4 shrink-0 transition-transform duration-200',
                                    isExpanded(item.name.toLowerCase())
                                      ? 'rotate-180 text-current'
                                      : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                  )} />
                                </>
                              )}
                            </button>

                            {/* Submenu */}
                            <div className={clsx(
                              'overflow-hidden transition-all duration-200',
                              !collapsed && (isExpanded(item.name.toLowerCase()) || hasActiveChild(item)) ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'
                            )}>
                              <ul className="ml-[18px] space-y-0.5 border-l border-gray-200 pl-3 dark:border-white/10">
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
                                              hasActiveChild(child)
                                                ? 'bg-gray-100 text-gray-900 dark:bg-white/[0.09] dark:text-white'
                                                : isExpanded(`${item.name}-${child.name}`.toLowerCase())
                                                  ? 'bg-gray-50 text-gray-900 dark:bg-white/[0.05] dark:text-white'
                                                  : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white dark:hover:bg-white/[0.06]',
                                              'group fn-press flex w-full items-center gap-x-2.5 rounded-lg py-1.5 px-2.5 text-[13px] font-medium transition-colors duration-150'
                                            )}
                                          >
                                            {child.icon && (
                                              <child.icon className={clsx(
                                                'h-4 w-4 shrink-0',
                                                isExpanded(`${item.name}-${child.name}`.toLowerCase()) || hasActiveChild(child) ? 'text-current' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                              )} />
                                            )}
                                            <span className="flex-1 text-left">{child.name}</span>
                                            <ChevronDownIcon className={clsx(
                                              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                                              isExpanded(`${item.name}-${child.name}`.toLowerCase()) ? 'rotate-180 text-current' : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-500'
                                            )} />
                                          </button>
                                          <div className={clsx(
                                            'overflow-hidden transition-all duration-200',
                                            isExpanded(`${item.name}-${child.name}`.toLowerCase()) || hasActiveChild(child) ? 'max-h-64 opacity-100 mt-0.5' : 'max-h-0 opacity-0'
                                          )}>
                                            <ul className="ml-3 space-y-0.5 border-l border-gray-200 pl-3 dark:border-white/10">
                                              {child.subChildren?.map((subChild: any) => (
                                                <li key={subChild.name}>
                                                  <NavLink
                                                    to={subChild.href}
                                                    className={
                                                      clsx(
                                                        isActivePath(subChild.href)
                                                          ? 'bg-primary-600 text-white shadow-sm ring-1 ring-white/10'
                                                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white dark:hover:bg-white/[0.06]',
                                                        'group flex items-center gap-x-2 rounded-lg py-1.5 px-2.5 text-[12.5px] transition-colors duration-150'
                                                      )
                                                    }
                                                  >
                                                    <span className={clsx(
                                                      'h-1 w-1 rounded-full shrink-0 transition-colors duration-150',
                                                      isActivePath(subChild.href) ? 'bg-white dark:bg-gray-800' : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-primary-600'
                                                    )} />
                                                    <span className="truncate">{subChild.name}</span>
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
                                            aria-current={isActivePath(child.href) ? 'page' : undefined}
                                            className={clsx(
                                              isActivePath(child.href)
                                                ? 'bg-primary-600 text-white shadow-sm ring-1 ring-white/10'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white dark:hover:bg-white/[0.06]',
                                              'group fn-press flex items-center gap-x-2.5 rounded-lg py-1.5 px-2.5 text-[13px] transition-colors duration-150 w-full text-left'
                                            )}
                                          >
                                            {child.icon && <child.icon className="h-4 w-4 shrink-0" />}
                                            {child.name}
                                          </button>
                                        ) : (
                                          <NavLink
                                            to={child.href}
                                            title={child.description}
                                            className={
                                              clsx(
                                                isActivePath(child.href)
                                                  ? 'bg-primary-600 text-white shadow-sm ring-1 ring-white/10'
                                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white dark:hover:bg-white/[0.06]',
                                                'group fn-press flex items-center gap-x-2.5 rounded-lg py-1.5 px-2.5 text-[13px] transition-colors duration-150'
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
                            title={item.description || (collapsed ? item.name : undefined)}
                            className={
                              clsx(
                                isActivePath(item.href)
                                  ? 'bg-primary-600 text-white shadow-sm ring-1 ring-white/10'
                                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white dark:hover:bg-white/[0.06]',
                                'group fn-press flex items-center gap-x-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
                                collapsed && 'justify-center px-0'
                              )
                            }
                          >
                            <item.icon className="h-[18px] w-[18px] shrink-0 transition-colors duration-150" strokeWidth={isActivePath(item.href) ? 2 : 1.5} aria-hidden="true" />
                            {!collapsed && item.name}
                          </NavLink>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
        </div>
        )}
      </nav>

      {/* Kartu pengguna di kaki sidebar: wajah, nama, jabatan, lalu keluar.
          Tombol tema pindah ke rel ikon supaya kartu ini bersih. */}
      {/* Menempel di dasar sidebar: menu bisa panjang sekali, dan tombol tema
          serta keluar tidak boleh ikut hanyut ke bawah lipatan. */}
      <div className={clsx(
        'sticky bottom-0 z-10 mt-auto -mx-4 px-4 pb-1 pt-3',
        collapsed && 'flex flex-col items-center',
      )} style={{ backgroundColor: 'rgb(var(--sidebar-bg))' }}>
        {collapsed ? (
          <button
            onClick={handleLogout}
            title="Keluar"
            className="fn-press flex h-8 w-8 items-center justify-center rounded-xl text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.07] p-2.5 ring-1 ring-white/10">
            <button
              onClick={() => navigate('/app/profile')}
              title="Buka profil"
              className="fn-press flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white ring-1 ring-white/15">
                {(user?.full_name || user?.username || 'U')
                  .split(' ')
                  .slice(0, 2)
                  .map((w: string) => w[0]?.toUpperCase())
                  .join('')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                  {user?.full_name || user?.username || 'Pengguna'}
                </span>
                <span className="fn-label block truncate">
                  {(user as any)?.role || (Array.isArray((user as any)?.roles) ? (user as any).roles[0] : 'Pengguna')}
                </span>
              </span>
            </button>
            <button
              onClick={handleLogout}
              title="Keluar"
              aria-label="Keluar"
              className="fn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
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
              enter="transition-all ease-out duration-300"
              enterFrom="opacity-0 backdrop-blur-none"
              enterTo="opacity-100 backdrop-blur-[3px]"
              leave="transition-all ease-in duration-200"
              leaveFrom="opacity-100 backdrop-blur-[3px]"
              leaveTo="opacity-0 backdrop-blur-none"
            >
              <div className="fixed inset-0 bg-gray-900/40" />
            </Transition.Child>

            <div className="fixed inset-0 flex p-4">
              <Transition.Child
                as={Fragment}
                enter="transition ease-[cubic-bezier(0.22,1,0.36,1)] duration-[380ms] transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-[cubic-bezier(0.64,0,0.78,0)] duration-250 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                {/* The close button lives INSIDE the panel. It used to sit
                    outside it (absolute left-full) yet still inside the
                    scrollable box, so when the dialog opened and that button
                    took focus the panel scrolled 64px to the right and the menu
                    looked cut off on the left - exactly what was reported on
                    phones. Dropping `mr-16` also buys the drawer 64px more
                    width. */}
                <Dialog.Panel className="relative flex w-full max-w-xs flex-1 max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-xl">
                  <button
                    type="button"
                    onClick={handleMobileClose}
                    aria-label="Tutup menu"
                    className="absolute right-2 top-2 z-10 rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <SidebarContent />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 ${collapsed ? 'lg:w-[84px]' : 'lg:w-60'} lg:flex-col transition-all duration-300 ${open ? 'lg:flex' : 'lg:hidden'
        }`}>
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>
    </>
  )
}
