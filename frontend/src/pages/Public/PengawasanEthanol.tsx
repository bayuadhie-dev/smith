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
interface Mutasi {
  tanggal: string | null; jenis: string; no_dokumen: string; batch: string | null
  masuk: number; keluar: number; saldo: number; keterangan: string | null; rincian: Rincian | null
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

  // Tanpa ini judul tab jadi tokennya sendiri - ikut tersimpan di riwayat
  // browser dan terbaca di tiap tangkapan layar atau berbagi layar.
  useEffect(() => { document.title = 'Kartu Pengawasan Ethanol' }, [])

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
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat data pengawasan...</div>
  }

  if (galat) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Tautan tidak bisa dibuka</h1>
          <p className="mt-2 text-sm text-slate-600">{galat}</p>
        </div>
      </div>
    )
  }
  if (!data) return null

  const r = data.ringkasan
  const satuan = data.barang.satuan

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-5xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">

        <header className="border-b-2 border-slate-800 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            PT Fengsheng Nonwoven Indonesia
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Kartu Pengawasan Ethanol</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.barang.kode} &middot; {data.barang.nama} &middot; satuan {satuan}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Data per {new Date(data.data_per).toLocaleString('id-ID')} &middot; halaman ini hanya menampilkan data, tidak bisa diubah dari sini
          </p>
        </header>

        <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Dari tanggal</span>
            <input type="date" className="rounded border border-slate-300 px-2 py-1.5" value={dari}
                   onChange={(e) => setDari(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Sampai tanggal</span>
            <input type="date" className="rounded border border-slate-300 px-2 py-1.5" value={sampai}
                   onChange={(e) => setSampai(e.target.value)} />
          </label>
          {(dari || sampai) && (
            <button type="button" onClick={() => { setDari(''); setSampai('') }}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Tampilkan semua
            </button>
          )}
          <button type="button" onClick={() => window.print()}
                  className="ml-auto rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            Cetak
          </button>
        </div>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Saldo awal', r.saldo_awal], ['Masuk', r.masuk], ['Dipakai', r.keluar], ['Saldo akhir', r.saldo_akhir]].map(
            ([label, nilai]) => (
              <div key={label as string} className="rounded border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{angka(nilai as number)}</p>
                <p className="text-xs text-slate-500">{satuan}</p>
              </div>
            ))}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Mutasi</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Tanggal</th>
                  <th className="py-2 pr-3">Jenis</th>
                  <th className="py-2 pr-3">No. dokumen</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3 text-right">Masuk</th>
                  <th className="py-2 pr-3 text-right">Keluar</th>
                  <th className="py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.mutasi.map((m, i) => (
                  <Fragment key={i}>
                    <tr className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                        onClick={() => setDibuka(dibuka === i ? null : i)}>
                      <td className="py-2 pr-3 whitespace-nowrap">{tanggalPanjang(m.tanggal)}</td>
                      <td className="py-2 pr-3">{JENIS_LABEL[m.jenis] || m.jenis}</td>
                      <td className="py-2 pr-3 font-medium text-slate-900">{m.no_dokumen}</td>
                      <td className="py-2 pr-3">{m.batch || '-'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{m.masuk ? angka(m.masuk) : '-'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{m.keluar ? angka(m.keluar) : '-'}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{angka(m.saldo)}</td>
                    </tr>
                    {/* Saat dicetak semua rinciannya ikut keluar, bukan cuma yang
                        sedang dibuka - pemeriksa membawa lembarnya, bukan layarnya. */}
                    {m.rincian && (
                      <tr className={dibuka === i ? '' : 'hidden print:table-row'}>
                        <td colSpan={7} className="bg-slate-50 px-3 py-3 text-xs text-slate-700 print:bg-white">
                          <RincianBaris m={m} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {data.mutasi.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-500">Belum ada mutasi pada periode ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 print:hidden">Klik satu baris untuk melihat dokumen asalnya.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Stok saat ini</h2>
          <table className="mt-2 min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Gudang</th>
                <th className="py-2 pr-3">Kedaluwarsa</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {data.stok_sekarang.map((s, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">{s.batch || '-'}</td>
                  <td className="py-2 pr-3">{s.gudang || '-'}</td>
                  <td className="py-2 pr-3">{tanggalPanjang(s.kedaluwarsa)}</td>
                  <td className="py-2 pr-3">{s.status}</td>
                  <td className="py-2 text-right tabular-nums">{angka(s.jumlah)} {satuan}</td>
                </tr>
              ))}
              {data.stok_sekarang.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">Tidak ada stok tersisa.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">
          Kartu ini dibangkitkan langsung dari pencatatan sistem ERP PT Fengsheng Nonwoven Indonesia.
          Dokumen yang statusnya belum disetujui tetap ditampilkan apa adanya beserta tanda statusnya.
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
       ['Kedaluwarsa', d.kedaluwarsa ? tanggalPanjang(d.kedaluwarsa) : null]]
    : [['Nomor perintah kerja', d.no_spk], ['Produk', d.produk ? `${d.kode_produk} - ${d.produk}` : null],
       ['Catatan pengolahan bets', d.no_catatan_bets], ['Status perintah kerja', d.status_spk],
       ['Rencana produksi', d.rencana_produksi != null ? `${angka(d.rencana_produksi)} ${d.satuan_produksi || ''}` : null],
       ['Hasil baik', d.hasil_baik != null ? `${angka(d.hasil_baik)} ${d.satuan_produksi || ''}` : null]]
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
      {baris.filter(([, v]) => v).map(([k, v]) => (
        <div key={k as string} className="flex justify-between gap-4 border-b border-slate-200/70 py-0.5">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium text-slate-800">{v as string}</dd>
        </div>
      ))}
    </dl>
  )
}
