/**
 * Halaman pengawasan ethanol untuk Bea dan Cukai.
 *
 * Dibuka lewat tautan tanpa login, jadi tidak ada rangka aplikasi di sini:
 * tidak ada menu, tidak ada tombol yang mengubah apa pun. Yang ditampilkan satu
 * rantai utuh - penerimaan, stok, pemakaian, sampai barang jadi - dalam
 * kuantitas saja. Harga sengaja tidak ada.
 *
 * Dibuat supaya enak dicetak: pemeriksa biasanya ingin membawa lembarnya.
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBaseURL } from '../../utils/apiConfig'

interface Rincian {
  no_penerimaan?: string; tanggal?: string | null; no_po?: string | null; pemasok?: string | null
  no_surat_jalan?: string | null; status?: string; mutu?: string; kedaluwarsa?: string | null
  no_bon?: string; keperluan?: string | null; no_spk?: string | null; produk?: string | null
  kode_produk?: string | null; rencana_produksi?: number | null; satuan_produksi?: string | null
  hasil_baik?: number | null; hasil_total?: number | null; no_catatan_bets?: string | null
  status_spk?: string | null
}
interface Cukai { status: string; dokumen: string | null; tarif: number }
interface Mutasi {
  tanggal: string | null; jenis: string; no_dokumen: string; batch: string | null
  masuk: number; keluar: number; saldo: number; keterangan: string | null; rincian: Rincian | null
  cukai: Cukai | null; nilai_cukai: number
}
interface Data {
  barang: { kode: string; nama: string; satuan: string }
  periode: { dari: string | null; sampai: string | null }
  ringkasan: { saldo_awal: number; masuk: number; keluar: number; saldo_akhir: number }
  cukai: { tarif_bawaan: number; masuk: number; terpakai: number; melekat_di_stok: number }
  mutasi: Mutasi[]
  stok_sekarang: { batch: string | null; jumlah: number; tersedia: number; status: string;
                   kedaluwarsa: string | null; gudang: string | null; cukai: Cukai | null
                   nilai_cukai: number }[]
  data_per: string
}

const angka = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Nilai cukai, bukan harga beli - harga memang tidak pernah ikut ke kartu ini.
 *  Tanpa sen: tarifnya rupiah bulat per liter. */
const rupiah = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `Rp ${Math.round(n).toLocaleString('id-ID')}`

const tanggalPanjang = (iso: string | null | undefined) => {
  if (!iso) return '-'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Status cukai melekat pada batch, bukan pada barangnya: batch berikutnya bisa
 *  saja masuk dengan fasilitas pembebasan sementara yang sekarang cukainya
 *  dibayar. Karena itu tandanya menempel di baris batch, bukan di kepala kartu. */
function TandaCukai({ cukai }: { cukai: Cukai | null }) {
  if (!cukai?.status) return <span className="text-gray-400">-</span>
  const bebas = /bebas|pembebasan/i.test(cukai.status) && !/belum/i.test(cukai.status)
  // Di dalam tabel cukup anak kalimat pertama ("Cukai dibayar"). Kalimat
  // panjangnya mendorong kolom nilai keluar layar - selengkapnya ada di
  // rincian baris, yang memang tempatnya keterangan.
  const pendek = cukai.status.split(',')[0]
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${
      bebas
        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}
      title={cukai.status + (cukai.dokumen ? ` - ${cukai.dokumen}` : '')}>
      {pendek}{cukai.dokumen ? ` - ${cukai.dokumen}` : ''}
      {cukai.tarif ? <span className="fn-num"> &middot; Rp {Math.round(cukai.tarif).toLocaleString('id-ID')}</span> : null}
    </span>
  )
}

/** Di dalam tabel tanggalnya diringkas - bulan panjang memakan lebar yang
 *  dibutuhkan kolom nilai cukai. Rinciannya tetap memakai bulan penuh. */
const tanggalRingkas = (iso: string | null | undefined) => {
  if (!iso) return '-'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const JENIS_LABEL: Record<string, string> = {
  penerimaan: 'Penerimaan', pemakaian: 'Pemakaian', penyesuaian: 'Penyesuaian',
}

export default function PengawasanEthanol() {
  const { token = '' } = useParams()
  const [data, setData] = useState<Data | null>(null)
  const [galat, setGalat] = useState('')
  const [memuat, setMemuat] = useState(true)
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [dibuka, setDibuka] = useState<number | null>(null)

  const ambil = useCallback(async () => {
    setMemuat(true)
    setGalat('')
    try {
      const q = new URLSearchParams()
      if (dari) q.set('dari', dari)
      if (sampai) q.set('sampai', sampai)
      const r = await fetch(`${getBaseURL()}/api/pengawasan/ethanol/${token}?${q}`)
      const isi = await r.json()
      if (!r.ok) throw new Error(isi?.error || 'Gagal memuat data')
      setData(isi)
    } catch (e: any) {
      setData(null)
      setGalat(e?.message || 'Gagal memuat data')
    } finally {
      setMemuat(false)
    }
  }, [token, dari, sampai])

  useEffect(() => { ambil() }, [ambil])

  if (memuat && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="fn-card is-loading h-32 w-80" />
      </div>
    )
  }

  if (galat) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
        <div className="fn-card max-w-md p-6 text-center">
          <div className="fn-label mb-1.5">PENGAWASAN &middot; BEA DAN CUKAI</div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tautan tidak bisa dibuka</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{galat}</p>
        </div>
      </div>
    )
  }
  if (!data) return null

  const r = data.ringkasan
  const satuan = data.barang.satuan
  const qPdf = new URLSearchParams()
  if (dari) qPdf.set('dari', dari)
  if (sampai) qPdf.set('sampai', sampai)
  const alamatPdf = `${getBaseURL()}/api/pengawasan/ethanol/${token}/pdf?${qPdf}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 print:max-w-none print:py-0">

        <header>
          <div className="fn-label mb-1.5">PENGAWASAN &middot; BEA DAN CUKAI</div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">
            Kartu Pengawasan Ethanol
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="fn-num rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {data.barang.kode}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{data.barang.nama}</span>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              satuan {satuan}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            PT Fengsheng Nonwoven Indonesia &middot; data per {new Date(data.data_per).toLocaleString('id-ID')}
          </p>
        </header>

        <div className="fn-card p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="fn-label mb-1 block">Dari tanggal</span>
              <input type="date" className="input w-44" value={dari} onChange={(e) => setDari(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="fn-label mb-1 block">Sampai tanggal</span>
              <input type="date" className="input w-44" value={sampai} onChange={(e) => setSampai(e.target.value)} />
            </label>
            {(dari || sampai) && (
              <button type="button" className="btn-secondary" onClick={() => { setDari(''); setSampai('') }}>
                Tampilkan semua
              </button>
            )}
            <button type="button" className="btn-secondary ml-auto" onClick={() => window.print()}>Cetak</button>
            <a className="btn-primary" href={alamatPdf} target="_blank" rel="noopener noreferrer">Unduh PDF</a>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Saldo awal', r.saldo_awal], ['Masuk', r.masuk], ['Dipakai', r.keluar], ['Saldo akhir', r.saldo_akhir]].map(
            ([label, nilai]) => (
              <div key={label as string} className="fn-card fn-card-sm p-4">
                <p className="fn-label">{label}</p>
                <p className="fn-num mt-1 text-xl font-semibold text-gray-900 dark:text-white">{angka(nilai as number)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{satuan}</p>
              </div>
            ))}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Nilai cukai masuk', data.cukai.masuk, `tarif Rp ${Math.round(data.cukai.tarif_bawaan).toLocaleString('id-ID')} / ${satuan}`],
            ['Nilai cukai terpakai', data.cukai.terpakai, 'ikut keluar bersama barangnya'],
            ['Melekat di stok', data.cukai.melekat_di_stok, 'cukai atas barang yang masih ada'],
            ['Pembebasan', 0, 'belum ada fasilitas']].map(([label, nilai, ket]) => (
              <div key={label as string} className="fn-card fn-card-sm p-4">
                <p className="fn-label">{label}</p>
                <p className="fn-num mt-1 text-xl font-semibold text-amber-800 dark:text-amber-300">{rupiah(nilai as number)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{ket}</p>
              </div>
            ))}
        </section>

        {/* Mutasi adalah isi utama kartu ini - yang diperiksa Bea Cukai adalah
            perjalanan barangnya, bukan angka ringkasnya. Karena itu bloknya
            dibuat paling menonjol: kepala tabel berpita, baris lebih lega. */}
        <section className="fn-card overflow-hidden p-0">
          <div className="flex flex-wrap items-baseline gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mutasi</h2>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              penerimaan &rarr; pemakaian &rarr; barang jadi
            </span>
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 print:hidden">Klik satu baris untuk melihat dokumen asalnya</span>
          </div>
          <div className="px-5 pb-5 pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-800 text-left text-[11px] uppercase tracking-wide text-white dark:bg-emerald-900">
                  <th className="whitespace-nowrap rounded-l px-3 py-2 font-semibold">Tanggal</th>
                  <th className="px-3 py-2 font-semibold">Jenis</th>
                  <th className="px-3 py-2 font-semibold">No. Dokumen</th>
                  <th className="px-3 py-2 font-semibold">Batch</th>
                  <th className="px-3 py-2 font-semibold">Status cukai</th>
                  <th className="px-3 py-2 text-right font-semibold">Masuk</th>
                  <th className="px-3 py-2 text-right font-semibold">Keluar</th>
                  <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                  <th className="rounded-r px-3 py-2 text-right font-semibold">Nilai cukai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.mutasi.map((m, i) => (
                  <Fragment key={i}>
                    <tr className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                        onClick={() => setDibuka(dibuka === i ? null : i)}
                        title="Klik untuk lihat dokumen asalnya">
                      <td className="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300">{tanggalRingkas(m.tanggal)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          m.jenis === 'penerimaan'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : m.jenis === 'pemakaian'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {JENIS_LABEL[m.jenis] || m.jenis}
                        </span>
                      </td>
                      <td className="fn-num whitespace-nowrap px-3 py-3 font-medium text-gray-900 dark:text-white">{m.no_dokumen}</td>
                      <td className="fn-num whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300">{m.batch || '-'}</td>
                      <td className="px-3 py-3"><TandaCukai cukai={m.cukai} /></td>
                      <td className="fn-num px-3 py-3 text-right text-gray-900 dark:text-white">{m.masuk ? angka(m.masuk) : '-'}</td>
                      <td className="fn-num px-3 py-3 text-right text-gray-900 dark:text-white">{m.keluar ? angka(m.keluar) : '-'}</td>
                      <td className="fn-num px-3 py-3 text-right font-semibold text-gray-900 dark:text-white">{angka(m.saldo)}</td>
                      <td className={`fn-num whitespace-nowrap px-3 py-3 text-right font-medium ${
                        m.nilai_cukai > 0 ? 'text-emerald-700 dark:text-emerald-300'
                          : m.nilai_cukai < 0 ? 'text-amber-800 dark:text-amber-300'
                          : 'text-gray-400'}`}>
                        {m.nilai_cukai ? `${m.nilai_cukai > 0 ? '+' : '-'} ${rupiah(Math.abs(m.nilai_cukai))}` : '-'}
                      </td>
                    </tr>
                    {/* Saat dicetak semua rinciannya ikut keluar, bukan cuma yang
                        sedang dibuka - pemeriksa membawa lembarnya, bukan layarnya. */}
                    {m.rincian && (
                      <tr className={dibuka === i ? '' : 'hidden print:table-row'}>
                        <td colSpan={9} className="bg-gray-50 px-3 py-3 text-xs text-gray-700 dark:bg-gray-900/40 dark:text-gray-300 print:bg-white">
                          <RincianBaris m={m} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {data.mutasi.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-gray-500 dark:text-gray-400">Belum ada mutasi pada periode ini.</td></tr>
                )}
                {data.mutasi.length > 0 && (
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-900/40">
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200" colSpan={5}>Jumlah periode ini</td>
                    <td className="fn-num px-3 py-3 text-right text-gray-900 dark:text-white">{angka(r.masuk)}</td>
                    <td className="fn-num px-3 py-3 text-right text-gray-900 dark:text-white">{angka(r.keluar)}</td>
                    <td className="fn-num px-3 py-3 text-right text-gray-900 dark:text-white">{angka(r.saldo_akhir)}</td>
                    <td className="fn-num whitespace-nowrap px-3 py-3 text-right text-amber-800 dark:text-amber-300">{rupiah(data.cukai.melekat_di_stok)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </section>

        <section className="fn-card p-5">
          <h2 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Stok Saat Ini</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="pb-2 pr-3">Batch</th>
                  <th className="pb-2 pr-3">Gudang</th>
                  <th className="pb-2 pr-3">Kedaluwarsa</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Status cukai</th>
                  <th className="pb-2 pr-3 text-right">Jumlah</th>
                  <th className="pb-2 text-right">Nilai cukai melekat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.stok_sekarang.map((s, i) => (
                  <tr key={i}>
                    <td className="fn-num py-2 pr-3 font-medium text-gray-900 dark:text-white">{s.batch || '-'}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s.gudang || '-'}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-700 dark:text-gray-300">{tanggalRingkas(s.kedaluwarsa)}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3"><TandaCukai cukai={s.cukai} /></td>
                    <td className="fn-num py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white">{angka(s.jumlah)} {satuan}</td>
                    <td className="fn-num whitespace-nowrap py-2 text-right font-medium text-amber-800 dark:text-amber-300">{rupiah(s.nilai_cukai)}</td>
                  </tr>
                ))}
                {data.stok_sekarang.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-gray-500 dark:text-gray-400">Tidak ada stok tersisa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pb-2 text-xs text-gray-500 dark:text-gray-400">
          Kolom rupiah adalah nilai cukai, bukan harga beli. Data langsung dari sistem ERP PT Fengsheng Nonwoven Indonesia.
        </footer>
      </div>
    </div>
  )
}

function RincianBaris({ m }: { m: Mutasi }) {
  const d = m.rincian!
  const baris = m.jenis === 'penerimaan'
    ? [['Nomor pesanan', d.no_po], ['Pemasok', d.pemasok], ['Surat jalan', d.no_surat_jalan],
       ['Status penerimaan', d.status], ['Pemeriksaan mutu', d.mutu],
       ['Kedaluwarsa', d.kedaluwarsa ? tanggalPanjang(d.kedaluwarsa) : null],
       ['Status cukai', m.cukai ? m.cukai.status + (m.cukai.dokumen ? ` - ${m.cukai.dokumen}` : '') : null],
       ['Tarif cukai', m.cukai?.tarif ? `${rupiah(m.cukai.tarif)} per satuan` : null],
       ['Nilai cukai batch', m.nilai_cukai ? rupiah(Math.abs(m.nilai_cukai)) : null]]
    : [['Nomor perintah kerja', d.no_spk], ['Produk', d.produk ? `${d.kode_produk} - ${d.produk}` : null],
       ['Catatan pengolahan bets', d.no_catatan_bets], ['Status perintah kerja', d.status_spk],
       ['Rencana produksi', d.rencana_produksi != null ? `${angka(d.rencana_produksi)} ${d.satuan_produksi || ''}` : null],
       ['Hasil baik', d.hasil_baik != null ? `${angka(d.hasil_baik)} ${d.satuan_produksi || ''}` : null],
       ['Nilai cukai yang ikut keluar', m.nilai_cukai ? rupiah(Math.abs(m.nilai_cukai)) : null]]
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
      {baris.filter(([, v]) => v).map(([k, v]) => (
        <div key={k as string} className="flex justify-between gap-4 border-b border-gray-200/70 py-0.5 dark:border-gray-700/70">
          <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
          <dd className="text-right font-medium text-gray-800 dark:text-gray-200">{v as string}</dd>
        </div>
      ))}
    </dl>
  )
}
