import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'ER'

const SHOWCASE = [
  {
    id: 'telusur',
    title: 'Setiap angka bisa ditelusuri',
    text: 'Di neraca saldo, klik sebuah akun untuk membuka buku besarnya. Dari baris jurnal, klik nomor transaksinya untuk membuka dokumen aslinya: faktur, pembayaran, surat jalan, atau perintah kerja. Tidak ada angka yang berdiri sendiri.',
    note: 'Neraca saldo, dengan pengecekan debit dan kredit otomatis.',
    img: '/landing/neraca-saldo.jpg',
    w: 1012, h: 568,
  },
  {
    id: 'kas',
    title: 'Kas dan bank per hari',
    text: 'Penerimaan, pengeluaran, dan saldo setiap hari ada di satu tabel. Klik satu tanggal untuk melihat tiap transaksinya beserta akun lawannya. Semua laporan bisa diunduh ke Excel atau PDF dan dicetak.',
    note: 'Rekap kas harian, per rekening.',
    img: '/landing/kas-harian.jpg',
    w: 1012, h: 568,
  },
  {
    id: 'piutang',
    title: 'Piutang per pelanggan, lengkap dengan retur',
    text: 'Faktur, retur, penerimaan, dan saldo berjalan tiap pelanggan dalam satu kartu. Aktivitas terakhir langsung terlihat, jadi tagihan yang mulai tertinggal mudah ditemukan.',
    note: 'Kartu piutang per pelanggan.',
    img: '/landing/kartu-piutang.jpg',
    w: 1012, h: 568,
  },
]

const AREAS = [
  ['Produksi', 'Perintah kerja dan jadwal batch, hasil per mesin dan shift, packing list, konversi barang jadi, OEE, downtime, dan layar TV di lantai pabrik.'],
  ['Gudang', 'Stok per lokasi dan batch, pengeluaran dengan urutan FIFO, stok opname, transfer, dan masa kedaluwarsa barang.'],
  ['Mutu', 'Inspeksi dan pelepasan batch, karantina otomatis, sertifikat analisis, dan pengendalian dokumen.'],
  ['Penjualan', 'Quotation, pesanan dengan diskon bertingkat, surat jalan, faktur, retur, dan nota kredit.'],
  ['Pembelian', 'Permintaan dan pesanan pembelian, penerimaan barang, faktur dengan pencocokan tiga arah, dan pembelian dalam mata uang asing dengan kurs otomatis.'],
  ['Keuangan', 'Jurnal, buku besar, kas dan bank, PPN dan e-Faktur, penutupan periode, serta impor dan ekspor data dari Excel.'],
  ['SDM', 'Absensi dengan verifikasi wajah dan lokasi, jadwal shift, cuti dan izin, serta penggajian.'],
  ['Kontrol', 'Hak akses per peran, persetujuan bertingkat, catatan perubahan data, dan pencadangan terjadwal.'],
]

const PORTALS = [
  ['Layar TV produksi', '/tv/overview'],
  ['Absensi', '/absensi'],
  ['Pendaftaran wajah', '/public/face-registration'],
  ['Pengajuan cuti dan izin', '/public/leave-request'],
]

const Landing: React.FC = () => {
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    axiosInstance.get('/api/settings/company/public')
      .then((r) => {
        if (r.data?.name) setCompanyName(r.data.name)
        if (r.data?.logoUrl) setLogoUrl(`${axiosInstance.defaults.baseURL || ''}${r.data.logoUrl}`)
      })
      .catch(() => undefined)
  }, [])

  const name = companyName || 'Sistem ERP'

  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased" style={{ colorScheme: 'light' }}>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#atas" className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-9 w-auto max-w-[8rem] object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white">{initials(name)}</span>
            )}
            <span className="text-sm font-semibold text-slate-900 sm:text-base">{name}</span>
          </a>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#cakupan" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Cakupan</a>
            <a href="#portal" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Portal karyawan</a>
            <Link to="/login" className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">Masuk</Link>
          </nav>
        </div>
      </header>

      <main id="atas">
        <section className="mx-auto max-w-6xl px-5 pb-6 pt-14 md:pt-20">
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl">
            Produksi, gudang, dan pembukuan pabrik di satu aplikasi.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            Dokumen yang sudah dibuat di satu bagian dipakai lagi oleh bagian berikutnya, jadi pesanan, produksi, pengiriman, faktur, dan jurnal tidak perlu diketik ulang.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/login" className="rounded-md bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800">Masuk ke sistem</Link>
            <a href="#portal" className="text-sm font-medium text-emerald-800 hover:underline">Absensi dan layar TV tanpa login</a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16 pt-8">
          <img
            src={SHOWCASE[0].img}
            width={SHOWCASE[0].w}
            height={SHOWCASE[0].h}
            alt="Tampilan neraca saldo"
            className="w-full rounded-lg border border-slate-200 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]"
          />
          <p className="mt-3 text-sm text-slate-500">Contoh tampilan memakai data fiktif.</p>
        </section>

        <section className="border-t border-slate-200">
          <div className="mx-auto max-w-6xl space-y-20 px-5 py-20">
            <div className="max-w-2xl border-l-2 border-emerald-700 pl-5">
              <h2 className="text-lg font-semibold text-slate-900">{SHOWCASE[0].title}</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{SHOWCASE[0].text}</p>
            </div>
            {SHOWCASE.slice(1).map((s, i) => (
              <div key={s.id} className="grid items-center gap-10 md:grid-cols-5">
                <div className={`md:col-span-2 ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{s.title}</h2>
                  <p className="mt-4 leading-relaxed text-slate-600">{s.text}</p>
                </div>
                <figure className={`md:col-span-3 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                  <img src={s.img} width={s.w} height={s.h} alt={s.note} loading="lazy" className="w-full rounded-lg border border-slate-200 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.3)]" />
                  <figcaption className="mt-2 text-sm text-slate-500">{s.note}</figcaption>
                </figure>
              </div>
            ))}
          </div>
        </section>

        <section id="cakupan" className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Yang dicakup</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {AREAS.map(([t, d]) => (
                <div key={t} className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-slate-200 pt-4">
                  <dt className="font-semibold text-slate-900">{t}</dt>
                  <dd className="text-sm leading-relaxed text-slate-600">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="portal" className="border-t border-slate-200">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Portal karyawan</h2>
            <p className="mt-3 max-w-2xl text-slate-600">Halaman yang bisa dibuka tanpa akun untuk keperluan harian di lantai pabrik.</p>
            <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {PORTALS.map(([t, href]) => (
                <li key={t}><Link to={href} className="font-medium text-emerald-800 underline-offset-4 hover:underline">{t}</Link></li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {name}</p>
          <Link to="/login" className="hover:text-slate-800">Masuk</Link>
        </div>
      </footer>
    </div>
  )
}

export default Landing
