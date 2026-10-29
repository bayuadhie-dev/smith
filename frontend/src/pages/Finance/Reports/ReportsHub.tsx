import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowsRightLeftIcon, BanknotesIcon, BookOpenIcon, BuildingLibraryIcon, CalendarDaysIcon, ChartBarSquareIcon, ChartPieIcon, ClockIcon,
  DocumentChartBarIcon, DocumentTextIcon, ReceiptPercentIcon, ScaleIcon, ShoppingBagIcon, TruckIcon, UsersIcon, PresentationChartLineIcon,
} from '@heroicons/react/24/outline'
import { ReportShell, SearchBox } from './reportKit'

type Item = { title: string; desc: string; to: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; isNew?: boolean }
const GROUPS: { title: string; hint: string; items: Item[] }[] = [
  { title: 'Laporan Keuangan', hint: 'Posisi dan kinerja perusahaan', items: [
    { title: 'Neraca', desc: 'Aset, liabilitas, dan ekuitas per tanggal', to: '/app/accounting/reports', icon: ScaleIcon },
    { title: 'Laba Rugi', desc: 'Pendapatan, HPP, beban, dan laba bersih', to: '/app/accounting/reports', icon: ChartPieIcon },
    { title: 'Arus Kas', desc: 'Kas masuk dan keluar operasi, investasi, pendanaan', to: '/app/finance/cash-flow', icon: ArrowsRightLeftIcon },
    { title: 'Neraca Saldo', desc: 'Saldo awal, mutasi, dan saldo akhir semua akun; cek debit = kredit', to: '/app/finance/reports/trial-balance', icon: ScaleIcon, isNew: true },
    { title: 'Perubahan Ekuitas', desc: 'Modal, saldo awal, laba ditahan, dan laba periode', to: '/app/finance/reports/equity', icon: ChartBarSquareIcon, isNew: true },
  ] },
  { title: 'Kas & Bank', hint: 'Pergerakan uang di rekening', items: [
    { title: 'Mutasi Rekening Bank / Kas', desc: 'Buku bank per rekening dengan saldo berjalan', to: '/app/finance/reports/bank-mutation', icon: BuildingLibraryIcon, isNew: true },
    { title: 'Rekap Kas Harian', desc: 'Penerimaan dan pengeluaran per hari, klik untuk rincian', to: '/app/finance/reports/cash-daily', icon: CalendarDaysIcon, isNew: true },
    { title: 'Daftar Penerimaan Kas/Bank', desc: 'Semua penerimaan kas/bank yang diinput, per periode, bisa dicari', to: '/app/finance/penerimaan', icon: BanknotesIcon },
    { title: 'Daftar Pembayaran Kas/Bank', desc: 'Semua pembayaran kas/bank yang diinput, per periode, bisa dicari', to: '/app/finance/pembayaran', icon: BanknotesIcon },
    { title: 'Posisi Kas & Bank', desc: 'Saldo semua rekening per tanggal', to: '/app/finance/reports/cash-position', icon: BanknotesIcon, isNew: true },
    { title: 'Rekonsiliasi Bank', desc: 'Cocokkan rekening koran dengan jurnal', to: '/app/accounting/bank-reconciliation', icon: ArrowsRightLeftIcon },
  ] },
  { title: 'Piutang & Penjualan', hint: 'Customer dan penjualan', items: [
    { title: 'Kartu Piutang per Customer', desc: 'Faktur, retur, pembayaran, dan saldo berjalan tiap customer', to: '/app/finance/reports/customer-statements', icon: UsersIcon, isNew: true },
    { title: 'Umur Piutang & Hutang', desc: 'Sisa tagihan menurut keterlambatan', to: '/app/finance/aging', icon: ClockIcon },
    { title: 'Laporan Penjualan', desc: 'Penjualan, diskon, dan HPP per faktur / produk', to: '/app/finance/sales-report', icon: PresentationChartLineIcon },
    { title: 'Daftar Penerimaan Penjualan', desc: 'Pembayaran yang diterima dari customer', to: '/app/finance/penerimaan-penjualan', icon: BanknotesIcon },
  ] },
  { title: 'Hutang & Pembelian', hint: 'Supplier dan pembelian', items: [
    { title: 'Kartu Hutang per Supplier', desc: 'Faktur, pembayaran, dan saldo berjalan tiap supplier', to: '/app/finance/reports/supplier-statements', icon: TruckIcon, isNew: true },
    { title: 'Laporan Pembelian', desc: 'Faktur pembelian per faktur dan per supplier', to: '/app/finance/reports/purchase', icon: ShoppingBagIcon, isNew: true },
    { title: 'Daftar Pembayaran Pembelian', desc: 'Pembayaran hutang ke supplier', to: '/app/finance/pembayaran-pembelian', icon: BanknotesIcon },
  ] },
  { title: 'Buku Besar & Pajak', hint: 'Jurnal dan perpajakan', items: [
    { title: 'Buku Besar', desc: 'Semua jurnal, filter per akun (akun induk didukung)', to: '/app/accounting/general-ledger', icon: BookOpenIcon },
    { title: 'Jurnal Umum', desc: 'Daftar dan input jurnal manual', to: '/app/accounting/journal', icon: DocumentTextIcon },
    { title: 'Rekap PPN', desc: 'PPN keluaran dan masukan per bulan, lengkap rincian faktur', to: '/app/finance/reports/vat', icon: ReceiptPercentIcon, isNew: true },
    { title: 'Manajemen Pajak & e-Faktur', desc: 'Ekspor e-Faktur dan Nota Retur', to: '/app/accounting/tax', icon: DocumentChartBarIcon },
  ] },
]

export default function ReportsHub() {
  const [q, setQ] = useState('')
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !q || `${i.title} ${i.desc}`.toLowerCase().includes(q.toLowerCase())) })).filter((g) => g.items.length), [q])
  return (
    <ReportShell title="Pusat Laporan Keuangan" subtitle="Semua laporan dalam satu tempat. Setiap laporan punya filter periode, rincian per baris, dan unduhan Excel."
      icon={<DocumentChartBarIcon className="h-7 w-7 text-emerald-600" />} actions={<SearchBox value={q} onChange={setQ} placeholder="Cari laporan..." />}>
      {groups.map((g) => (
        <section key={g.title}>
          <div className="mb-2 flex items-baseline gap-2"><h2 className="text-base font-bold text-gray-900 dark:text-white">{g.title}</h2><span className="text-xs text-gray-400">{g.hint}</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((it) => (
              <Link key={it.title} to={it.to} data-tab-title={it.title} className="group flex gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-900/30"><it.icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">{it.title}{it.isNew && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">Baru</span>}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{it.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!groups.length && <p className="text-center text-sm text-gray-500">Tidak ada laporan yang cocok dengan pencarian.</p>}
    </ReportShell>
  )
}
