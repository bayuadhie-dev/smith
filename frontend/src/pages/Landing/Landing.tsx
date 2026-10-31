import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  BanknotesIcon,
  BeakerIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CogIcon,
  CubeIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TruckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'

const FLOW = [
  { icon: ClipboardDocumentCheckIcon, title: 'Pesanan', text: 'Sales order dari pelanggan, lengkap dengan diskon bertingkat.' },
  { icon: CogIcon, title: 'Produksi', text: 'SPK, batch, hasil per mesin dan shift, serta downtime.' },
  { icon: BeakerIcon, title: 'Mutu', text: 'Inspeksi, release, dan karantina sebelum barang boleh dikirim.' },
  { icon: CubeIcon, title: 'Gudang', text: 'Stok per lokasi dan batch, keluar dengan urutan FIFO.' },
  { icon: TruckIcon, title: 'Pengiriman', text: 'Surat jalan terhubung ke pesanan dan potong stok otomatis.' },
  { icon: DocumentTextIcon, title: 'Faktur', text: 'Faktur dan jurnal terbentuk dari dokumen sebelumnya.' },
  { icon: BanknotesIcon, title: 'Pembayaran', text: 'Penerimaan dan pelunasan langsung ke buku besar.' },
  { icon: ChartBarIcon, title: 'Laporan', text: 'Neraca, laba rugi, dan stok dihitung dari transaksi yang sama.' },
]

const MODULES = [
  { icon: CogIcon, title: 'Produksi', items: ['SPK dan jadwal batch', 'Input hasil per mesin dan shift', 'Packing list dan konversi barang jadi', 'OEE, downtime, dan monitoring TV'] },
  { icon: CubeIcon, title: 'Gudang', items: ['Stok per lokasi dan batch', 'Pengeluaran FIFO', 'Stok opname dan transfer', 'Masa kedaluwarsa barang'] },
  { icon: BeakerIcon, title: 'Mutu', items: ['Inspeksi dan release batch', 'Karantina otomatis', 'Sertifikat analisis (COA)', 'Pengendalian dokumen (DCC)'] },
  { icon: BuildingStorefrontIcon, title: 'Penjualan', items: ['Quotation dan sales order', 'Surat jalan dan faktur', 'Retur dan nota kredit', 'Peramalan dan perencanaan'] },
  { icon: ShoppingBagIcon, title: 'Pembelian', items: ['Permintaan dan pesanan pembelian', 'Penerimaan barang (GRN)', 'Faktur dan pencocokan 3 arah', 'Mata uang asing dan kurs otomatis'] },
  { icon: BanknotesIcon, title: 'Keuangan', items: ['Jurnal, buku besar, kas dan bank', 'Neraca, laba rugi, arus kas', 'PPN dan e-Faktur', 'Impor dan ekspor data'] },
  { icon: UsersIcon, title: 'SDM', items: ['Absensi wajah dan jadwal shift', 'Cuti dan izin', 'Penggajian', 'Hak akses per peran'] },
  { icon: ShieldCheckIcon, title: 'Kontrol', items: ['Persetujuan bertingkat', 'Catatan audit perubahan data', 'Penutupan periode', 'Pencadangan terjadwal'] },
]

const FEATURES = [
  { icon: ChartBarIcon, title: 'Laporan keuangan lengkap', text: 'Neraca, laba rugi, arus kas, buku besar, dan kartu piutang atau hutang. Setiap angka bisa diklik sampai ke jurnal dan dokumen asalnya.' },
  { icon: ArrowPathIcon, title: 'Impor dan ekspor Excel', text: 'Masukkan ratusan transaksi sekaligus dari file Excel dengan pemeriksaan dulu, atau unduh datanya dengan rentang tanggal pilihan.' },
  { icon: PrinterIcon, title: 'Dokumen cetak sesuai format', text: 'Invoice, PO, surat jalan, dan bukti kas dicetak dari template yang bisa dirancang sendiri, otomatis berlanjut ke halaman berikutnya.' },
  { icon: LockClosedIcon, title: 'Hak akses dan jejak audit', text: 'Peran dan izin per menu, persetujuan bertingkat, serta catatan siapa mengubah apa dan kapan.' },
  { icon: GlobeAltIcon, title: 'Multi mata uang', text: 'Pembelian dalam mata uang asing dengan kurs otomatis, selisih kurs tercatat saat pelunasan.' },
  { icon: MagnifyingGlassIcon, title: 'Pencarian dan tab kerja', text: 'Cari transaksi lintas modul, buka banyak halaman dalam tab, dan lanjutkan form yang belum selesai.' },
  { icon: DevicePhoneMobileIcon, title: 'Nyaman dipakai di HP', text: 'Absensi wajah, pantauan produksi, dan pengajuan cuti bisa dibuka dari browser ponsel tanpa pemasangan.' },
  { icon: CloudArrowDownIcon, title: 'Data aman', text: 'Pencadangan terjadwal, penutupan periode akuntansi, dan sesi yang berakhir otomatis saat tidak dipakai.' },
]

const PORTALS = [
  { title: 'Layar TV Produksi', text: 'Pantauan produksi, pengiriman, dan roster untuk ruang kerja. Tanpa login.', href: '/tv/overview' },
  { title: 'Absensi', text: 'Masuk dan pulang dengan verifikasi wajah dan lokasi.', href: '/absensi' },
  { title: 'Pendaftaran Wajah', text: 'Pendaftaran data wajah karyawan untuk absensi.', href: '/public/face-registration' },
  { title: 'Pengajuan Cuti dan Izin', text: 'Formulir online untuk karyawan.', href: '/public/leave-request' },
]

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'ER'

const Landing: React.FC = () => {
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    axiosInstance.get('/api/settings/company/public')
      .then((r) => { if (r.data?.name) setCompanyName(r.data.name) })
      .catch(() => undefined)
  }, [])

  const name = companyName || 'Sistem ERP'

  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#atas" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white">{initials(name)}</span>
            <span className="text-sm font-semibold leading-tight text-slate-900 sm:text-base">{name}</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
            <a href="#alur" className="hover:text-emerald-700">Alur kerja</a>
            <a href="#modul" className="hover:text-emerald-700">Modul</a>
            <a href="#kemampuan" className="hover:text-emerald-700">Kemampuan</a>
            <a href="#portal" className="hover:text-emerald-700">Portal karyawan</a>
          </nav>
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Masuk <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="atas" className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            <p className="mb-4 text-sm font-medium text-emerald-700">Sistem ERP manufaktur</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Dari bahan baku sampai faktur, dalam satu sistem.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Produksi, gudang, mutu, penjualan, pembelian, keuangan, dan SDM memakai data yang sama, sehingga satu dokumen tidak perlu diketik dua kali.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-base font-medium text-white hover:bg-emerald-700">
                Masuk ke sistem <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <a href="#portal" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:border-slate-400">
                Portal karyawan
              </a>
            </div>
          </div>

          {/* Peta area kerja */}
          <div className="grid grid-cols-4 gap-3 self-center">
            {MODULES.map((m) => (
              <div key={m.title} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-center shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><m.icon className="h-6 w-6" /></span>
                <span className="text-xs font-medium text-slate-700 sm:text-sm">{m.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alur */}
      <section id="alur" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Satu alur, tanpa input ulang</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Setiap tahap mengambil data dari tahap sebelumnya, dan jurnal akuntansi terbentuk dari dokumen yang sama.</p>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((s, i) => (
            <li key={s.title} className="bg-white p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><s.icon className="h-5 w-5" /></span>
                <span className="text-xs font-medium text-slate-400">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="font-medium text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Modul */}
      <section id="modul" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Modul</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Dikelompokkan menurut bagian pabrik. Hak akses diatur per peran, jadi tiap orang hanya melihat bagiannya.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <div key={m.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><m.icon className="h-5 w-5" /></span>
                  <p className="font-semibold text-slate-900">{m.title}</p>
                </div>
                <ul className="space-y-1.5 text-sm text-slate-600">
                  {m.items.map((it) => (
                    <li key={it} className="flex gap-2"><span className="mt-2 h-1 w-1 flex-none rounded-full bg-emerald-600" />{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kemampuan */}
      <section id="kemampuan" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Kemampuan utama</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Hal-hal yang dipakai setiap hari oleh tim keuangan, gudang, dan produksi.</p>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><f.icon className="h-5 w-5" /></span>
              <p className="mt-4 font-semibold text-slate-900">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portal */}
      <section id="portal" className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Portal karyawan</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Halaman yang bisa dibuka tanpa akun, untuk keperluan sehari-hari di lantai pabrik.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PORTALS.map((p) => (
            <Link key={p.title} to={p.href} className="group rounded-xl border border-slate-200 p-5 transition hover:border-emerald-600">
              <p className="font-semibold text-slate-900">{p.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.text}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                Buka <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
        </div>
      </section>

      {/* Ajakan */}
      <section className="bg-emerald-700">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">Siap bekerja?</h2>
            <p className="mt-1 text-emerald-100">Masuk dengan akun yang diberikan oleh administrator.</p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-medium text-emerald-800 hover:bg-emerald-50">
            Masuk ke sistem <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {name}</p>
          <p>Sistem ERP manufaktur</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
