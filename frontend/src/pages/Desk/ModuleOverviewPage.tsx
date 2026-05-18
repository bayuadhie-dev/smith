import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import {
  ArrowLeftIcon,
  CogIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  CheckBadgeIcon,
  UsersIcon,
  BanknotesIcon,
  CalculatorIcon,
  WrenchScrewdriverIcon,
  LightBulbIcon,
  ChartBarIcon,
  TrashIcon,
  TruckIcon,
  DocumentChartBarIcon,
  CubeIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ChartPieIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  AcademicCapIcon,
  MapPinIcon,
  PresentationChartLineIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  ArrowDownTrayIcon,
  ScaleIcon,
  SignalIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface QuickLink {
  name: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

interface StatItem {
  label: string
  key: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
}

interface ModuleConfig {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  stats: StatItem[]
  links: QuickLink[]
}

const moduleConfigs: Record<string, ModuleConfig> = {
  production: {
    name: 'Production',
    description: 'Kelola work order, jadwal produksi, dan monitoring mesin',
    icon: CogIcon,
    gradient: 'from-indigo-600 via-blue-600 to-cyan-600',
    stats: [
      { label: 'Work Order Aktif', key: 'active_orders', icon: ClipboardDocumentListIcon, href: '/app/production/work-orders', color: 'blue' },
      { label: 'Selesai Hari Ini', key: 'completed_today', icon: DocumentCheckIcon, href: '/app/production/controller', color: 'green' },
      { label: 'Jadwal Minggu Ini', key: 'weekly_schedules', icon: CalendarDaysIcon, href: '/app/production/scheduling', color: 'purple' },
      { label: 'Mesin Aktif', key: 'active_machines', icon: CogIcon, href: '/app/production/machines', color: 'orange' },
    ],
    links: [
      { name: 'Work Orders', description: 'Buat & kelola perintah kerja', href: '/app/production/work-orders', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'Controller Harian', description: 'Input produksi per shift', href: '/app/production/controller', icon: ChartBarIcon, color: 'green' },
      { name: 'Controller Mingguan', description: 'Rekap produksi mingguan', href: '/app/production/weekly-controller', icon: PresentationChartLineIcon, color: 'teal' },
      { name: 'Jadwal Mingguan', description: 'Perencanaan jadwal per mesin', href: '/app/production/scheduling', icon: CalendarDaysIcon, color: 'indigo' },
      { name: 'Jadwal Bulanan', description: 'Target produksi bulanan', href: '/app/production/monthly-schedule', icon: CalendarDaysIcon, color: 'purple' },
      { name: 'WO Monitoring', description: 'Status real-time work order', href: '/app/production/work-orders-monitoring', icon: SignalIcon, color: 'orange' },
      { name: 'Packing List', description: 'Daftar packing & WIP stock', href: '/app/production/packing-list', icon: ArchiveBoxIcon, color: 'yellow' },
      { name: 'Pre-Shift Checklist', description: 'Cek keamanan sebelum shift', href: '/app/production/pre-shift-checklist', icon: DocumentCheckIcon, color: 'red' },
      { name: 'Converting', description: 'Proses converting produk', href: '/app/production/converting', icon: ArrowsRightLeftIcon, color: 'cyan' },
      { name: 'Mesin', description: 'Data & status mesin', href: '/app/production/machines', icon: CogIcon, color: 'gray' },
      { name: 'Sisa Order', description: 'Stok sisa order produksi', href: '/app/production/remaining-stock', icon: ArchiveBoxIcon, color: 'pink' },
      { name: 'MBF Report', description: 'Laporan MBF produksi', href: '/app/production/mbf-report', icon: DocumentTextIcon, color: 'violet' },
    ],
  },
  warehouse: {
    name: 'Warehouse',
    description: 'Kelola inventaris, stok, dan pergerakan barang',
    icon: BuildingStorefrontIcon,
    gradient: 'from-green-600 via-emerald-600 to-teal-600',
    stats: [
      { label: 'Total Material', key: 'total_materials', icon: CubeIcon, href: '/app/warehouse/materials', color: 'blue' },
      { label: 'Stok Minimum', key: 'low_stock', icon: ExclamationTriangleIcon, href: '/app/warehouse/alerts', color: 'red' },
      { label: 'Permintaan Pending', key: 'pending_issues', icon: ClipboardDocumentListIcon, href: '/app/warehouse/material-issues', color: 'yellow' },
      { label: 'Opname Aktif', key: 'active_opname', icon: DocumentCheckIcon, href: '/app/warehouse/stock-opname', color: 'purple' },
    ],
    links: [
      { name: 'Permintaan Barang', description: 'Kelola permintaan material', href: '/app/warehouse/material-issues', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'Pemindahan Barang', description: 'Transfer antar lokasi', href: '/app/warehouse/movements', icon: ArrowsRightLeftIcon, color: 'teal' },
      { name: 'Penyesuaian Stok', description: 'Koreksi jumlah stok', href: '/app/warehouse/stock-input', icon: ArrowDownTrayIcon, color: 'green' },
      { name: 'Penambahan Bahan', description: 'Tambah bahan baku baru', href: '/app/warehouse/inventory', icon: ArchiveBoxIcon, color: 'cyan' },
      { name: 'Stock Opname', description: 'Hitung fisik stok', href: '/app/warehouse/stock-opname', icon: DocumentCheckIcon, color: 'indigo' },
      { name: 'Hasil Opname', description: 'Lihat hasil stock opname', href: '/app/warehouse/stock-opname/results', icon: ChartPieIcon, color: 'purple' },
      { name: 'Barang & Material', description: 'Master data material', href: '/app/warehouse/materials', icon: CubeIcon, color: 'orange' },
      { name: 'Gudang & Lokasi', description: 'Kelola lokasi penyimpanan', href: '/app/warehouse/locations', icon: MapPinIcon, color: 'yellow' },
      { name: 'Stok Minimum Alert', description: 'Item mendekati batas minimum', href: '/app/warehouse/alerts', icon: ExclamationTriangleIcon, color: 'red' },
      { name: 'Ringkasan Stok', description: 'Stok per gudang', href: '/app/warehouse/stock-summary', icon: PresentationChartLineIcon, color: 'gray' },
    ],
  },
  sales: {
    name: 'Sales',
    description: 'Kelola pelanggan, pesanan, dan pipeline penjualan',
    icon: ShoppingCartIcon,
    gradient: 'from-blue-600 via-sky-600 to-cyan-600',
    stats: [
      { label: 'Order Aktif', key: 'orders_today', icon: ClipboardDocumentListIcon, href: '/app/sales/orders', color: 'blue' },
      { label: 'Total Pelanggan', key: 'total_customers', icon: UserGroupIcon, href: '/app/sales/customers', color: 'green' },
      { label: 'Penawaran Aktif', key: 'active_quotes', icon: DocumentTextIcon, href: '/app/sales/quotations', color: 'yellow' },
      { label: 'Leads Baru', key: 'new_leads', icon: UserGroupIcon, href: '/app/sales/leads', color: 'purple' },
    ],
    links: [
      { name: 'Sales Orders', description: 'Daftar & buat pesanan', href: '/app/sales/orders', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'Pelanggan', description: 'Kelola data pelanggan', href: '/app/sales/customers', icon: UserGroupIcon, color: 'green' },
      { name: 'Penawaran', description: 'Quotation untuk pelanggan', href: '/app/sales/quotations', icon: DocumentTextIcon, color: 'yellow' },
      { name: 'Leads', description: 'Prospek pelanggan baru', href: '/app/sales/leads', icon: UserGroupIcon, color: 'orange' },
      { name: 'Opportunities', description: 'Pipeline penjualan', href: '/app/sales/opportunities', icon: ChartBarIcon, color: 'indigo' },
      { name: 'Forecast', description: 'Proyeksi penjualan', href: '/app/sales/forecasts', icon: PresentationChartLineIcon, color: 'teal' },
      { name: 'Dashboard Sales', description: 'Ringkasan kinerja sales', href: '/app/sales/dashboard', icon: ChartPieIcon, color: 'cyan' },
    ],
  },
  purchasing: {
    name: 'Purchasing',
    description: 'Kelola supplier, purchase order, dan kontrak',
    icon: ShoppingBagIcon,
    gradient: 'from-orange-600 via-amber-600 to-yellow-600',
    stats: [
      { label: 'PO Pending', key: 'pending_orders', icon: ClipboardDocumentListIcon, href: '/app/purchasing/orders', color: 'orange' },
      { label: 'Total Supplier', key: 'total_suppliers', icon: UserGroupIcon, href: '/app/purchasing/suppliers', color: 'blue' },
      { label: 'RFQ Terbuka', key: 'open_rfqs', icon: DocumentTextIcon, href: '/app/purchasing/rfq', color: 'yellow' },
      { label: 'Kontrak Aktif', key: 'active_contracts', icon: DocumentCheckIcon, href: '/app/purchasing/contracts', color: 'green' },
    ],
    links: [
      { name: 'Purchase Orders', description: 'Kelola PO pembelian', href: '/app/purchasing/orders', icon: ClipboardDocumentListIcon, color: 'orange' },
      { name: 'Supplier', description: 'Data & evaluasi supplier', href: '/app/purchasing/suppliers', icon: UserGroupIcon, color: 'blue' },
      { name: 'RFQ', description: 'Request for Quotation', href: '/app/purchasing/rfq', icon: DocumentTextIcon, color: 'yellow' },
      { name: 'Kontrak', description: 'Kelola kontrak supplier', href: '/app/purchasing/contracts', icon: DocumentCheckIcon, color: 'green' },
      { name: 'Perbandingan Harga', description: 'Bandingkan penawaran', href: '/app/purchasing/price-comparison', icon: ScaleIcon, color: 'teal' },
      { name: 'Dashboard', description: 'Ringkasan purchasing', href: '/app/purchasing', icon: PresentationChartLineIcon, color: 'indigo' },
    ],
  },
  quality: {
    name: 'Quality Control',
    description: 'Inspeksi kualitas masuk, proses, dan barang jadi',
    icon: CheckBadgeIcon,
    gradient: 'from-teal-600 via-cyan-600 to-sky-600',
    stats: [
      { label: 'QC Hari Ini', key: 'inspections_today', icon: DocumentCheckIcon, href: '/app/quality/incoming', color: 'teal' },
      { label: 'QC Masuk', key: 'incoming_tests', icon: ArrowDownTrayIcon, href: '/app/quality/incoming', color: 'blue' },
      { label: 'QC Dalam Proses', key: 'inprocess_tests', icon: CogIcon, href: '/app/quality/in-process', color: 'yellow' },
      { label: 'QC Barang Jadi', key: 'fg_tests', icon: CheckBadgeIcon, href: '/app/quality/finish-good', color: 'green' },
    ],
    links: [
      { name: 'QC Barang Masuk', description: 'Inspeksi penerimaan bahan', href: '/app/quality/incoming', icon: ArrowDownTrayIcon, color: 'blue' },
      { name: 'QC Dalam Proses', description: 'Inspeksi selama produksi', href: '/app/quality/in-process', icon: CogIcon, color: 'yellow' },
      { name: 'QC Barang Jadi', description: 'Inspeksi produk selesai', href: '/app/quality/finish-good', icon: CheckBadgeIcon, color: 'green' },
      { name: 'QC Packing List', description: 'QC untuk packing list', href: '/app/quality/packing-list', icon: ArchiveBoxIcon, color: 'orange' },
      { name: 'Quality Analytics', description: 'Tren & analisis kualitas', href: '/app/quality/analytics', icon: ChartPieIcon, color: 'teal' },
      { name: 'Dashboard QC', description: 'Overview kualitas produk', href: '/app/quality', icon: PresentationChartLineIcon, color: 'indigo' },
    ],
  },
  hr: {
    name: 'Human Resources',
    description: 'Kelola karyawan, absensi, payroll, dan pengembangan SDM',
    icon: UsersIcon,
    gradient: 'from-purple-600 via-violet-600 to-indigo-600',
    stats: [
      { label: 'Total Karyawan', key: 'total_employees', icon: UserGroupIcon, href: '/app/hr/employees', color: 'purple' },
      { label: 'Absen Hari Ini', key: 'attendance_today', icon: ClockIcon, href: '/app/hr/absensi', color: 'blue' },
      { label: 'Cuti Pending', key: 'pending_leaves', icon: CalendarDaysIcon, href: '/app/hr/leaves', color: 'yellow' },
      { label: 'Payroll Bulan Ini', key: 'payroll_month', icon: CurrencyDollarIcon, href: '/app/hr/payroll', color: 'green' },
    ],
    links: [
      { name: 'Karyawan', description: 'Data & profil karyawan', href: '/app/hr/employees', icon: UserGroupIcon, color: 'purple' },
      { name: 'Absensi (Foto)', description: 'Clock in/out dengan wajah', href: '/app/hr/absensi', icon: ClockIcon, color: 'blue' },
      { name: 'Laporan Absensi', description: 'Rekap kehadiran karyawan', href: '/app/hr/attendance-report', icon: DocumentChartBarIcon, color: 'teal' },
      { name: 'Kelola Absensi', description: 'Koreksi data absensi', href: '/app/hr/attendance-admin', icon: DocumentCheckIcon, color: 'cyan' },
      { name: 'Cuti & Izin', description: 'Pengajuan & approval cuti', href: '/app/hr/leaves', icon: CalendarDaysIcon, color: 'yellow' },
      { name: 'Payroll', description: 'Penggajian karyawan', href: '/app/hr/payroll', icon: CurrencyDollarIcon, color: 'green' },
      { name: 'Work Roster', description: 'Jadwal kerja & shift', href: '/app/hr/roster', icon: CalendarDaysIcon, color: 'orange' },
      { name: 'Penilaian Kinerja', description: 'Appraisal & evaluasi', href: '/app/hr/appraisal', icon: ChartBarIcon, color: 'indigo' },
      { name: 'Pelatihan', description: 'Program training karyawan', href: '/app/hr/training', icon: AcademicCapIcon, color: 'pink' },
    ],
  },
  finance: {
    name: 'Finance',
    description: 'Kelola anggaran, arus kas, dan persetujuan keuangan',
    icon: BanknotesIcon,
    gradient: 'from-emerald-600 via-green-600 to-teal-600',
    stats: [
      { label: 'Invoice Pending', key: 'pending_invoices', icon: DocumentTextIcon, href: '/app/accounting/receivable', color: 'yellow' },
      { label: 'Budget Terpakai', key: 'budget_used_pct', icon: ChartBarIcon, href: '/app/finance/budget', color: 'orange' },
      { label: 'Approval Pending', key: 'pending_approvals', icon: DocumentCheckIcon, href: '/app/approval', color: 'red' },
      { label: 'Cash Flow Bulan', key: 'monthly_cashflow', icon: ArrowsRightLeftIcon, href: '/app/finance/cash-flow', color: 'green' },
    ],
    links: [
      { name: 'Anggaran', description: 'Kelola budget departemen', href: '/app/finance/budget', icon: BanknotesIcon, color: 'green' },
      { name: 'Arus Kas', description: 'Monitor cash flow', href: '/app/finance/cash-flow', icon: ArrowsRightLeftIcon, color: 'teal' },
      { name: 'Approval Keuangan', description: 'Persetujuan transaksi', href: '/app/approval', icon: DocumentCheckIcon, color: 'orange' },
      { name: 'WIP Ledger', description: 'Buku besar WIP', href: '/app/finance/wip-ledger', icon: DocumentChartBarIcon, color: 'indigo' },
      { name: 'Dashboard Finance', description: 'Ringkasan keuangan', href: '/app/finance', icon: PresentationChartLineIcon, color: 'emerald' },
    ],
  },
  accounting: {
    name: 'Accounting',
    description: 'Buku besar, jurnal, AR/AP, dan laporan keuangan',
    icon: CalculatorIcon,
    gradient: 'from-sky-600 via-blue-600 to-indigo-600',
    stats: [
      { label: 'Jurnal Bulan Ini', key: 'journal_entries', icon: DocumentTextIcon, href: '/app/accounting/journal', color: 'blue' },
      { label: 'AR Outstanding', key: 'ar_outstanding', icon: ArrowDownTrayIcon, href: '/app/accounting/receivable', color: 'green' },
      { label: 'AP Outstanding', key: 'ap_outstanding', icon: DocumentTextIcon, href: '/app/accounting/payable', color: 'red' },
      { label: 'Aset Tetap', key: 'fixed_assets', icon: BuildingStorefrontIcon, href: '/app/accounting/fixed-assets', color: 'purple' },
    ],
    links: [
      { name: 'Chart of Accounts', description: 'Bagan akun perusahaan', href: '/app/accounting/chart-of-accounts', icon: DocumentChartBarIcon, color: 'blue' },
      { name: 'General Ledger', description: 'Buku besar umum', href: '/app/accounting/general-ledger', icon: ArchiveBoxIcon, color: 'indigo' },
      { name: 'Jurnal Entry', description: 'Input jurnal akuntansi', href: '/app/accounting/journal', icon: DocumentTextIcon, color: 'teal' },
      { name: 'Accounts Receivable', description: 'Piutang pelanggan', href: '/app/accounting/receivable', icon: ArrowDownTrayIcon, color: 'green' },
      { name: 'Accounts Payable', description: 'Hutang supplier', href: '/app/accounting/payable', icon: DocumentTextIcon, color: 'red' },
      { name: 'Aset Tetap', description: 'Kelola aset perusahaan', href: '/app/accounting/fixed-assets', icon: BuildingStorefrontIcon, color: 'orange' },
      { name: 'Pajak', description: 'Manajemen perpajakan', href: '/app/accounting/tax', icon: DocumentCheckIcon, color: 'yellow' },
      { name: 'Laporan Keuangan', description: 'Neraca & laba rugi', href: '/app/accounting/reports', icon: PresentationChartLineIcon, color: 'purple' },
    ],
  },
  maintenance: {
    name: 'Maintenance',
    description: 'Perawatan mesin, jadwal servis, dan work order maintenance',
    icon: WrenchScrewdriverIcon,
    gradient: 'from-yellow-600 via-amber-600 to-orange-600',
    stats: [
      { label: 'WO Maintenance Aktif', key: 'active_wo', icon: ClipboardDocumentListIcon, href: '/app/maintenance/records', color: 'yellow' },
      { label: 'Terlambat', key: 'overdue', icon: ExclamationTriangleIcon, href: '/app/maintenance/records', color: 'red' },
      { label: 'Jadwal Bulan Ini', key: 'scheduled_this_month', icon: CalendarDaysIcon, href: '/app/maintenance/schedules', color: 'blue' },
      { label: 'Item NG', key: 'ng_items', icon: ExclamationTriangleIcon, href: '/app/maintenance/checklist-ng', color: 'orange' },
    ],
    links: [
      { name: 'Work Orders', description: 'Perintah kerja maintenance', href: '/app/maintenance/records', icon: ClipboardDocumentListIcon, color: 'yellow' },
      { name: 'Jadwal Maintenance', description: 'Perawatan terjadwal', href: '/app/maintenance/schedules', icon: CalendarDaysIcon, color: 'blue' },
      { name: 'Checklist NG', description: 'Item tidak normal', href: '/app/maintenance/checklist-ng', icon: ExclamationTriangleIcon, color: 'red' },
      { name: 'Request Baru', description: 'Buat permintaan maintenance', href: '/app/maintenance/request/new', icon: DocumentCheckIcon, color: 'green' },
      { name: 'Analytics', description: 'Analisis kinerja maintenance', href: '/app/maintenance/analytics', icon: ChartPieIcon, color: 'teal' },
      { name: 'Dashboard', description: 'Ringkasan maintenance', href: '/app/maintenance', icon: PresentationChartLineIcon, color: 'indigo' },
    ],
  },
  rd: {
    name: 'R&D',
    description: 'Penelitian, pengembangan produk, dan inovasi',
    icon: LightBulbIcon,
    gradient: 'from-pink-600 via-rose-600 to-red-600',
    stats: [
      { label: 'Proyek Aktif', key: 'active_projects', icon: ClipboardDocumentListIcon, href: '/app/rnd/projects', color: 'pink' },
      { label: 'Menunggu Approval', key: 'pending_approvals', icon: DocumentCheckIcon, href: '/app/rnd/approvals', color: 'yellow' },
      { label: 'Eksperimen', key: 'experiments', icon: BeakerIcon, href: '/app/rd/experiments', color: 'blue' },
      { label: 'Pengembangan Produk', key: 'product_devs', icon: CubeIcon, href: '/app/rd/products', color: 'green' },
    ],
    links: [
      { name: 'Proyek R&D', description: 'Kelola proyek penelitian', href: '/app/rnd/projects', icon: ClipboardDocumentListIcon, color: 'pink' },
      { name: 'Approval R&D', description: 'Persetujuan proyek', href: '/app/rnd/approvals', icon: DocumentCheckIcon, color: 'yellow' },
      { name: 'Eksperimen', description: 'Log eksperimen & uji coba', href: '/app/rd/experiments', icon: BeakerIcon, color: 'blue' },
      { name: 'Pengembangan Produk', description: 'Pipeline produk baru', href: '/app/rd/products', icon: CubeIcon, color: 'green' },
      { name: 'Material R&D', description: 'Material penelitian', href: '/app/rd/materials', icon: ArchiveBoxIcon, color: 'teal' },
      { name: 'Laporan Riset', description: 'Laporan hasil penelitian', href: '/app/rd/reports', icon: DocumentChartBarIcon, color: 'indigo' },
      { name: 'Dashboard R&D', description: 'Overview riset & inovasi', href: '/app/rnd', icon: PresentationChartLineIcon, color: 'purple' },
    ],
  },
  rnd: {
    name: 'R&D',
    description: 'Penelitian, pengembangan produk, dan inovasi',
    icon: LightBulbIcon,
    gradient: 'from-pink-600 via-rose-600 to-red-600',
    stats: [
      { label: 'Proyek Aktif', key: 'active_projects', icon: ClipboardDocumentListIcon, href: '/app/rnd/projects', color: 'pink' },
      { label: 'Menunggu Approval', key: 'pending_approvals', icon: DocumentCheckIcon, href: '/app/rnd/approvals', color: 'yellow' },
      { label: 'Eksperimen', key: 'experiments', icon: BeakerIcon, href: '/app/rd/experiments', color: 'blue' },
      { label: 'Pengembangan Produk', key: 'product_devs', icon: CubeIcon, href: '/app/rd/products', color: 'green' },
    ],
    links: [
      { name: 'Proyek R&D', description: 'Kelola proyek penelitian', href: '/app/rnd/projects', icon: ClipboardDocumentListIcon, color: 'pink' },
      { name: 'Approval R&D', description: 'Persetujuan proyek', href: '/app/rnd/approvals', icon: DocumentCheckIcon, color: 'yellow' },
      { name: 'Eksperimen', description: 'Log eksperimen & uji coba', href: '/app/rd/experiments', icon: BeakerIcon, color: 'blue' },
      { name: 'Pengembangan Produk', description: 'Pipeline produk baru', href: '/app/rd/products', icon: CubeIcon, color: 'green' },
      { name: 'Material R&D', description: 'Material penelitian', href: '/app/rd/materials', icon: ArchiveBoxIcon, color: 'teal' },
      { name: 'Laporan Riset', description: 'Laporan hasil penelitian', href: '/app/rd/reports', icon: DocumentChartBarIcon, color: 'indigo' },
    ],
  },
  oee: {
    name: 'OEE Monitoring',
    description: 'Overall Equipment Effectiveness — efisiensi & downtime mesin',
    icon: ChartBarIcon,
    gradient: 'from-orange-600 via-red-600 to-rose-600',
    stats: [
      { label: 'OEE Rata-rata', key: 'avg_oee', icon: ChartBarIcon, href: '/app/oee', color: 'orange' },
      { label: 'Availability', key: 'availability', icon: SignalIcon, href: '/app/oee', color: 'green' },
      { label: 'Performance', key: 'performance', icon: SparklesIcon, href: '/app/oee', color: 'blue' },
      { label: 'Quality Rate', key: 'quality_rate', icon: CheckBadgeIcon, href: '/app/oee', color: 'teal' },
    ],
    links: [
      { name: 'OEE Dashboard', description: 'Overview OEE semua mesin', href: '/app/oee', icon: ChartBarIcon, color: 'orange' },
      { name: 'Live Monitoring', description: 'Monitoring produksi live', href: '/app/production/live-monitoring', icon: SignalIcon, color: 'red' },
      { name: 'Work Orders', description: 'Work order produksi', href: '/app/production/work-orders', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'Maintenance', description: 'Perawatan mesin', href: '/app/maintenance', icon: WrenchScrewdriverIcon, color: 'yellow' },
    ],
  },
  waste: {
    name: 'Waste Management',
    description: 'Pencatatan dan analisis limbah produksi',
    icon: TrashIcon,
    gradient: 'from-red-600 via-orange-600 to-amber-600',
    stats: [
      { label: 'Total Limbah Hari Ini', key: 'waste_today', icon: TrashIcon, href: '/app/waste', color: 'red' },
      { label: 'Limbah Bulan Ini', key: 'waste_month', icon: ChartBarIcon, href: '/app/waste', color: 'orange' },
      { label: 'Jenis Limbah', key: 'waste_types', icon: ArchiveBoxIcon, href: '/app/waste', color: 'yellow' },
      { label: 'Tren vs Bulan Lalu', key: 'waste_trend', icon: PresentationChartLineIcon, href: '/app/waste', color: 'blue' },
    ],
    links: [
      { name: 'Waste Management', description: 'Catat & pantau limbah', href: '/app/waste', icon: TrashIcon, color: 'red' },
      { name: 'Controller Produksi', description: 'Input produksi harian', href: '/app/production/controller', icon: ChartBarIcon, color: 'orange' },
      { name: 'Work Orders', description: 'Work order produksi', href: '/app/production/work-orders', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'Warehouse', description: 'Stok bahan baku', href: '/app/warehouse', icon: BuildingStorefrontIcon, color: 'green' },
    ],
  },
  returns: {
    name: 'Returns',
    description: 'Pengelolaan retur barang dari pelanggan maupun ke supplier',
    icon: ArrowPathIcon,
    gradient: 'from-rose-600 via-pink-600 to-purple-600',
    stats: [
      { label: 'Retur Aktif', key: 'active_returns', icon: ArrowPathIcon, href: '/app/returns', color: 'red' },
      { label: 'Pending Proses', key: 'pending_process', icon: ClipboardDocumentListIcon, href: '/app/returns', color: 'yellow' },
      { label: 'Selesai Bulan Ini', key: 'completed_month', icon: DocumentCheckIcon, href: '/app/returns', color: 'green' },
      { label: 'Nilai Retur', key: 'return_value', icon: BanknotesIcon, href: '/app/returns', color: 'blue' },
    ],
    links: [
      { name: 'Returns', description: 'Kelola retur barang', href: '/app/returns', icon: ArrowPathIcon, color: 'red' },
      { name: 'Sales Orders', description: 'Order penjualan terkait', href: '/app/sales/orders', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'QC Barang Masuk', description: 'Inspeksi barang retur', href: '/app/quality/incoming', icon: CheckBadgeIcon, color: 'teal' },
      { name: 'Warehouse', description: 'Stok retur di gudang', href: '/app/warehouse', icon: BuildingStorefrontIcon, color: 'green' },
    ],
  },
  shipping: {
    name: 'Shipping',
    description: 'Pengiriman, tracking, dan logistik barang',
    icon: TruckIcon,
    gradient: 'from-violet-600 via-purple-600 to-indigo-600',
    stats: [
      { label: 'Pengiriman Hari Ini', key: 'shipments_today', icon: TruckIcon, href: '/app/shipping/orders', color: 'purple' },
      { label: 'Dalam Perjalanan', key: 'in_transit', icon: MapPinIcon, href: '/app/shipping/tracking', color: 'blue' },
      { label: 'Selesai Hari Ini', key: 'delivered_today', icon: DocumentCheckIcon, href: '/app/shipping/orders', color: 'green' },
      { label: 'Pending', key: 'pending_shipments', icon: ClipboardDocumentListIcon, href: '/app/shipping/orders', color: 'yellow' },
    ],
    links: [
      { name: 'Shipping Orders', description: 'Kelola pengiriman', href: '/app/shipping/orders', icon: ClipboardDocumentListIcon, color: 'purple' },
      { name: 'Tracking', description: 'Lacak pengiriman', href: '/app/shipping/tracking', icon: MapPinIcon, color: 'blue' },
      { name: 'Kalkulator Biaya', description: 'Estimasi ongkos kirim', href: '/app/shipping/calculator', icon: CalculatorIcon, color: 'teal' },
      { name: 'Provider', description: 'Data ekspedisi', href: '/app/shipping/providers', icon: TruckIcon, color: 'orange' },
      { name: 'Dashboard', description: 'Ringkasan pengiriman', href: '/app/shipping', icon: PresentationChartLineIcon, color: 'indigo' },
    ],
  },
  dcc: {
    name: 'Document Control',
    description: 'Pengendalian dokumen, CAPA, dan rekaman mutu',
    icon: DocumentChartBarIcon,
    gradient: 'from-slate-600 via-gray-600 to-zinc-600',
    stats: [
      { label: 'Dokumen Aktif', key: 'active_docs', icon: DocumentTextIcon, href: '/app/dcc?tab=documents', color: 'blue' },
      { label: 'Review Pending', key: 'pending_review', icon: DocumentCheckIcon, href: '/app/dcc?tab=review', color: 'yellow' },
      { label: 'CAPA Terbuka', key: 'open_capa', icon: ExclamationTriangleIcon, href: '/app/dcc?tab=capa', color: 'red' },
      { label: 'Memo Masuk', key: 'internal_memos', icon: DocumentTextIcon, href: '/app/dcc?tab=memos', color: 'teal' },
    ],
    links: [
      { name: 'Daftar Induk Dokumen', description: 'Semua dokumen terkendali', href: '/app/dcc?tab=documents', icon: DocumentChartBarIcon, color: 'blue' },
      { name: 'Change Notice', description: 'Perubahan dokumen', href: '/app/dcc?tab=change_notice', icon: DocumentTextIcon, color: 'orange' },
      { name: 'Kaji Ulang', description: 'Review & revisi dokumen', href: '/app/dcc?tab=review', icon: DocumentCheckIcon, color: 'yellow' },
      { name: 'Rekaman Mutu', description: 'Catatan kualitas', href: '/app/dcc?tab=quality_records', icon: ArchiveBoxIcon, color: 'green' },
      { name: 'CAPA', description: 'Corrective & Preventive Action', href: '/app/dcc?tab=capa', icon: ExclamationTriangleIcon, color: 'red' },
      { name: 'Komunikasi Internal', description: 'Memo & surat internal', href: '/app/dcc?tab=memos', icon: DocumentTextIcon, color: 'teal' },
      { name: 'Pemusnahan Dokumen', description: 'Log dokumen dimusnahkan', href: '/app/dcc?tab=destruction', icon: TrashIcon, color: 'gray' },
    ],
  },
  products: {
    name: 'Products',
    description: 'Kelola produk, BOM, kategori, dan lifecycle produk',
    icon: CubeIcon,
    gradient: 'from-fuchsia-600 via-purple-600 to-violet-600',
    stats: [
      { label: 'Total Produk', key: 'total_products', icon: CubeIcon, href: '/app/products', color: 'purple' },
      { label: 'Kategori', key: 'categories', icon: ArchiveBoxIcon, href: '/app/products/categories', color: 'blue' },
      { label: 'BOM Aktif', key: 'active_boms', icon: DocumentCheckIcon, href: '/app/products/bom', color: 'green' },
      { label: 'Produk Baru Bulan Ini', key: 'new_products', icon: SparklesIcon, href: '/app/products', color: 'yellow' },
    ],
    links: [
      { name: 'Semua Produk', description: 'Daftar lengkap produk', href: '/app/products', icon: CubeIcon, color: 'purple' },
      { name: 'Dashboard Produk', description: 'Overview produk', href: '/app/products/dashboard', icon: PresentationChartLineIcon, color: 'indigo' },
      { name: 'Analytics Produk', description: 'Analisis performa produk', href: '/app/products/analytics', icon: ChartPieIcon, color: 'blue' },
      { name: 'Kategori', description: 'Kelola kategori produk', href: '/app/products/categories', icon: ArchiveBoxIcon, color: 'orange' },
      { name: 'Bill of Materials', description: 'Komposisi bahan produk', href: '/app/products/bom', icon: DocumentCheckIcon, color: 'green' },
      { name: 'Product Lifecycle', description: 'Siklus hidup produk', href: '/app/products/lifecycle', icon: ArrowPathIcon, color: 'teal' },
    ],
  },
  inventory: {
    name: 'Warehouse',
    description: 'Kelola inventaris, stok, dan pergerakan barang',
    icon: BuildingStorefrontIcon,
    gradient: 'from-green-600 via-emerald-600 to-teal-600',
    stats: [
      { label: 'Total Material', key: 'total_materials', icon: CubeIcon, href: '/app/warehouse/materials', color: 'blue' },
      { label: 'Stok Minimum', key: 'low_stock', icon: ExclamationTriangleIcon, href: '/app/warehouse/alerts', color: 'red' },
      { label: 'Permintaan Pending', key: 'pending_issues', icon: ClipboardDocumentListIcon, href: '/app/warehouse/material-issues', color: 'yellow' },
      { label: 'Opname Aktif', key: 'active_opname', icon: DocumentCheckIcon, href: '/app/warehouse/stock-opname', color: 'purple' },
    ],
    links: [
      { name: 'Permintaan Barang', description: 'Kelola permintaan material', href: '/app/warehouse/material-issues', icon: ClipboardDocumentListIcon, color: 'blue' },
      { name: 'Pemindahan Barang', description: 'Transfer antar lokasi', href: '/app/warehouse/movements', icon: ArrowsRightLeftIcon, color: 'teal' },
      { name: 'Penyesuaian Stok', description: 'Koreksi jumlah stok', href: '/app/warehouse/stock-input', icon: ArrowDownTrayIcon, color: 'green' },
      { name: 'Stock Opname', description: 'Hitung fisik stok', href: '/app/warehouse/stock-opname', icon: DocumentCheckIcon, color: 'indigo' },
      { name: 'Barang & Material', description: 'Master data material', href: '/app/warehouse/materials', icon: CubeIcon, color: 'orange' },
      { name: 'Gudang & Lokasi', description: 'Kelola lokasi penyimpanan', href: '/app/warehouse/locations', icon: MapPinIcon, color: 'yellow' },
      { name: 'Stok Minimum Alert', description: 'Item mendekati batas minimum', href: '/app/warehouse/alerts', icon: ExclamationTriangleIcon, color: 'red' },
      { name: 'Ringkasan Stok', description: 'Stok per gudang', href: '/app/warehouse/stock-summary', icon: PresentationChartLineIcon, color: 'gray' },
    ],
  },
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
}

export default function ModuleOverviewPage() {
  const { module } = useParams<{ module: string }>()
  const navigate = useNavigate()
  const [moduleStats, setModuleStats] = useState<Record<string, any>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  const config = module ? moduleConfigs[module] : null

  useEffect(() => {
    if (!config) {
      navigate('/desk')
      return
    }
    axiosInstance.get('/api/desk/overview')
      .then(res => {
        const stats = res.data?.data?.module_stats?.[module!] || {}
        setModuleStats(stats)
      })
      .catch(() => setModuleStats({}))
      .finally(() => setLoadingStats(false))
  }, [module])

  if (!config) return null

  const Icon = config.icon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">

      {/* Header Banner */}
      <div className={`relative overflow-hidden bg-gradient-to-r ${config.gradient} px-6 py-10 shadow-xl mb-8`}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-[1400px] mx-auto">
          <button
            onClick={() => navigate('/desk')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-5 text-sm font-medium transition-colors group"
          >
            <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Desk
          </button>
          <div className="flex items-center gap-5">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{config.name}</h1>
              <p className="text-white/80 mt-1 text-base">{config.description}</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* Stats Summary */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Ringkasan</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {config.stats.map((stat) => {
              const StatIcon = stat.icon
              const val = moduleStats[stat.key]
              return (
                <button
                  key={stat.key}
                  onClick={() => navigate(stat.href)}
                  className="group bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700
                             hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={clsx('p-2.5 rounded-xl', colorMap[stat.color] || colorMap.blue)}>
                      <StatIcon className="w-5 h-5" />
                    </div>
                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors mt-1"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {loadingStats ? (
                      <span className="inline-block w-10 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : (val !== undefined && val !== null ? val : '—')}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 leading-snug">{stat.label}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Navigation */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Menu Cepat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {config.links.map((link) => {
              const LinkIcon = link.icon
              return (
                <button
                  key={link.href}
                  onClick={() => navigate(link.href)}
                  className="group bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700
                             hover:shadow-xl hover:-translate-y-1 transition-all duration-200 text-left flex items-start gap-4"
                >
                  <div className={clsx(
                    'p-3 rounded-xl shrink-0 transition-all duration-200 group-hover:scale-110',
                    colorMap[link.color] || colorMap.blue
                  )}>
                    <LinkIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {link.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-2">{link.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
