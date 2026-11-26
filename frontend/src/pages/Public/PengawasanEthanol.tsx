/**
 * Kartu pengawasan ethanol untuk Bea dan Cukai.
 *
 * Dibuka lewat tautan tanpa login, jadi tidak ada rangka aplikasi di sini:
 * tidak ada menu, tidak ada tombol yang mengubah apa pun.
 *
 * Batas isinya ditetapkan Presiden Direktur 2026-11-26 sesudah melihat versi
 * pertama: kuantitas liter saja - tanpa rupiah (termasuk nilai cukai yang
 * dibebaskan), tanpa nomor dokumen internal, tanpa baris rincian yang harus
 * diklik, tanpa unduhan PDF. Dari dokumen asalnya tersisa nama pemasok saja,
 * sebagai kolom biasa. Jangan dikembalikan tanpa keputusan baru.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBaseURL } from '../../utils/apiConfig'

interface Mutasi {
  tanggal: string | null; jenis: string; batch: string | null
  pemasok: string | null; produk: string | null
  masuk: number; keluar: number; saldo: number
}
interface Data {
  barang: { kode: string; nama: string; satuan: string }
  periode: { dari: string | null; sampai: string | null }
  ringkasan: { saldo_awal: number; masuk: number; keluar: number; saldo_akhir: number }
  mutasi: Mutasi[]
  stok_sekarang: { batch: string | null; jumlah: number; tersedia: number; status: string;
                   kedaluwarsa: string | null; gudang: string | null }[]
  data_per: string
}

const angka = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const tanggalPanjang = (iso: string | null | undefined) => {
  if (!iso) return '-'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Di dalam tabel tanggalnya diringkas supaya kolomnya tidak saling mendorong. */
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 print:max-w-none print:py-0">

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
            <button type="button" className="btn-primary ml-auto" onClick={() => window.print()}>Cetak</button>
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

        {/* Mutasi adalah isi utama kartu ini - yang ditelusuri pemeriksa adalah
            perjalanan barangnya, bukan angka ringkasnya. Barisnya rata: tidak
            ada yang perlu diklik, semua yang ditampilkan sudah ada di kolom. */}
        <section className="fn-card overflow-hidden p-0">
          <div className="flex flex-wrap items-baseline gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mutasi</h2>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              penerimaan &rarr; pemakaian &rarr; barang jadi
            </span>
          </div>
          <div className="px-4 pb-5 pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-800 text-left text-[11px] uppercase tracking-wide text-white dark:bg-emerald-900">
                    <th className="whitespace-nowrap rounded-l px-2.5 py-2 font-semibold">Tanggal</th>
                    <th className="px-2.5 py-2 font-semibold">Jenis</th>
                    <th className="px-2.5 py-2 font-semibold">Batch</th>
                    <th className="px-2.5 py-2 font-semibold">Pemasok / Pemakaian</th>
                    <th className="px-2.5 py-2 text-right font-semibold">Masuk</th>
                    <th className="px-2.5 py-2 text-right font-semibold">Keluar</th>
                    <th className="rounded-r px-2.5 py-2 text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.mutasi.map((m, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-2.5 py-3 text-gray-700 dark:text-gray-300">{tanggalRingkas(m.tanggal)}</td>
                      <td className="px-2.5 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          m.jenis === 'penerimaan'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : m.jenis === 'pemakaian'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {JENIS_LABEL[m.jenis] || m.jenis}
                        </span>
                      </td>
                      <td className="fn-num whitespace-nowrap px-2.5 py-3 text-gray-700 dark:text-gray-300">{m.batch || '-'}</td>
                      <td className="px-2.5 py-3 text-gray-700 dark:text-gray-300">{m.pemasok || m.produk || '-'}</td>
                      <td className="fn-num px-2.5 py-3 text-right text-gray-900 dark:text-white">{m.masuk ? angka(m.masuk) : '-'}</td>
                      <td className="fn-num px-2.5 py-3 text-right text-gray-900 dark:text-white">{m.keluar ? angka(m.keluar) : '-'}</td>
                      <td className="fn-num px-2.5 py-3 text-right font-semibold text-gray-900 dark:text-white">{angka(m.saldo)}</td>
                    </tr>
                  ))}
                  {data.mutasi.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-gray-500 dark:text-gray-400">Belum ada mutasi pada periode ini.</td></tr>
                  )}
                  {data.mutasi.length > 0 && (
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-900/40">
                      <td className="px-2.5 py-3 text-gray-700 dark:text-gray-200" colSpan={4}>Jumlah periode ini</td>
                      <td className="fn-num px-2.5 py-3 text-right text-gray-900 dark:text-white">{angka(r.masuk)}</td>
                      <td className="fn-num px-2.5 py-3 text-right text-gray-900 dark:text-white">{angka(r.keluar)}</td>
                      <td className="fn-num px-2.5 py-3 text-right text-gray-900 dark:text-white">{angka(r.saldo_akhir)}</td>
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
                  <th className="pb-2 text-right">Jumlah</th>
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
                    <td className="fn-num py-2 text-right font-semibold text-gray-900 dark:text-white">{angka(s.jumlah)} {satuan}</td>
                  </tr>
                ))}
                {data.stok_sekarang.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-500 dark:text-gray-400">Tidak ada stok tersisa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pb-2 text-xs text-gray-500 dark:text-gray-400">
          Seluruh angka dalam satuan {satuan}. Periode{' '}
          {tanggalPanjang(data.periode.dari) !== '-' ? tanggalPanjang(data.periode.dari) : 'awal pencatatan'} sampai{' '}
          {tanggalPanjang(data.periode.sampai) !== '-' ? tanggalPanjang(data.periode.sampai) : 'sekarang'}.
          Data langsung dari sistem ERP PT Fengsheng Nonwoven Indonesia.
        </footer>
      </div>
    </div>
  )
}
