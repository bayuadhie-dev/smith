import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'

import { DetailSkeleton } from '../../components/ui/Skeleton'
import ItemStockModal from '../../components/Warehouse/ItemStockModal'
import { namaKategoriBarang } from './kategoriBarang'
import { useUrlFilter } from '../../hooks/useUrlState'
const TYPE: Record<string, string> = {
  goods_receipt: 'Penerimaan Barang', transfer_out: 'Pemindahan keluar', transfer_in: 'Terima Barang', transfer: 'Pemindahan', material_issue: 'Permintaan Barang',
  adjustment: 'Penyesuaian', stock_in: 'Stok masuk', stock_out: 'Stok keluar',
}

const JENIS: Record<string, string> = {
  raw_materials: 'Bahan baku', chemical_materials: 'Bahan kimia', packaging_materials: 'Bahan kemas',
  finished_goods: 'Barang jadi', wip: 'Barang setengah jadi', premix: 'Premix', waste: 'Waste',
}

export default function ZoneStockPage() {
  const { id } = useParams()
  const [d, setD] = useState<any>(null)
  const [memuat, setMemuat] = useState(true)
  const [detail, setDetail] = useState<{ kind: 'material' | 'product'; id: number; name: string } | null>(null)
  // Barang yang belum pernah masuk gudang ini tidak punya baris stok, jadi
  // daftarnya hanya memuat yang kebetulan ada isinya. Untuk memeriksa
  // "bahan kimia kita apa saja di gudang ini", yang nol justru yang dicari.
  // Kelompoknya TIDAK dipilih bebas: tiap gudang sudah punya kategorinya
  // sendiri di master. Hanya gudang serbaguna yang boleh dipilihkan.
  const [kelompok, setKelompok] = useUrlFilter<string>('kelompok', '')
  const [nolParam, setNolParam] = useUrlFilter<string>('nol', '')
  const tampilkanNol = nolParam === '1'

  useEffect(() => {
    setMemuat(true)
    const p = new URLSearchParams()
    if (kelompok) p.set('group', kelompok)
    if (tampilkanNol) p.set('include_empty', '1')
    axiosInstance.get(`/api/stock-transfers/zone-stock/${id}?${p}`)
      .then((r) => setD(r.data))
      .catch(() => showError('Data gudang gagal dimuat'))
      .finally(() => setMemuat(false))
  }, [id, kelompok, tampilkanNol])

  if (!d) return <div className="p-6"><DetailSkeleton /></div>
  const serbaguna = !d.zone.material_type || d.zone.material_type === 'all'
  const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const n = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 4 })
  return (
    <div className="space-y-4 p-6">
      <PageHeader eyebrow="GUDANG · ISI GUDANG" title={d.zone.name} subtitle={`${d.zone.code} · ${d.items.length} jenis barang · ${d.locations.length} lokasi`} />
      <Panel title="Lokasi stok">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead><tr><th className={th}>Lokasi</th><th className={`${th} text-right`}>Stok</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {d.locations.map((l: any) => (
                <tr key={l.id}><td className="px-3 py-2"><Link to={`/app/warehouse/locations/${l.id}`} className="text-emerald-700 hover:underline dark:text-emerald-300">{l.location_code}</Link></td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(l.on_hand)}</td><td className="px-3 py-2">{l.is_active ? 'Aktif' : 'Nonaktif'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Barang di gudang ini">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-gray-100 pb-4 dark:border-gray-700">
          <div>
            <p className="fn-label mb-1">Kelompok barang</p>
            {serbaguna ? (
              <select className="input w-56" value={kelompok} onChange={(e) => setKelompok(e.target.value)}>
                <option value="">Pilih kelompok</option>
                {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {JENIS[(d.zone.material_type || '').toLowerCase()] || d.zone.material_type}
                <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">mengikuti kategori gudang</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {memuat && <span className="text-sm text-gray-500 dark:text-gray-400">memuat…</span>}
            <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${serbaguna && !kelompok
              ? 'cursor-not-allowed border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600'
              : 'cursor-pointer border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
              <input type="checkbox" checked={tampilkanNol} disabled={serbaguna && !kelompok}
                onChange={(e) => setNolParam(e.target.checked ? '1' : '')} />
              Tampilkan yang stoknya nol
            </label>
          </div>
        </div>
        {d.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {serbaguna && !kelompok ? 'Belum ada stok di gudang ini. Pilih kelompok barang untuk melihat daftar lengkapnya.'
              : tampilkanNol ? 'Tidak ada barang di kelompok ini.'
                : 'Belum ada stok. Centang "Tampilkan yang stoknya nol" untuk melihat seluruh barang yang seharusnya di gudang ini.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead><tr><th className={th}>Kode</th><th className={th}>Nama</th><th className={th}>Kelompok</th><th className={`${th} text-right`}>Stok</th><th className={`${th} text-right`}>Tersedia</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {d.items.map((i: any) => (
                  <tr
                    key={`${i.kind}${i.item_id}`}
                    onClick={() => setDetail({ kind: i.kind, id: i.item_id, name: i.name })}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    title="Lihat rincian: stok per batch, kedaluwarsa, dan mutasinya"
                  >
                    <td className="px-3 py-2">{i.code}</td>
                    <td className="px-3 py-2 text-emerald-700 hover:underline dark:text-emerald-300">{i.name}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={i.luar_kelompok ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}>
                        {JENIS[(i.material_type || '').toLowerCase()] || i.material_type || '-'}
                      </span>
                      {i.luar_kelompok && (
                        <span className="ml-1 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          title="Jenis barang ini berbeda dari kategori gudangnya - salah taruh, atau master barangnya salah jenis">
                          beda kategori
                        </span>
                      )}
                      <span className="block text-gray-400 dark:text-gray-500">{namaKategoriBarang(i.category)}</span>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${i.on_hand ? '' : 'text-gray-400 dark:text-gray-500'}`}>{n(i.on_hand)} {i.uom}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${i.available ? '' : 'text-gray-400 dark:text-gray-500'}`}>{n(i.available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {detail && (
        <ItemStockModal kind={detail.kind} itemId={detail.id} name={detail.name} onClose={() => setDetail(null)} />
      )}

      <Panel title="Mutasi gudang">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead><tr><th className={th}>Tanggal</th><th className={th}>Jenis</th><th className={th}>Dokumen</th><th className={th}>Barang</th><th className={th}>Lokasi</th><th className={th}>Batch</th><th className={`${th} text-right`}>Qty</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {d.movements.map((m: any, i: number) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-2">{m.date ? new Date(m.date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-3 py-2">{TYPE[m.type] || m.type}</td><td className="px-3 py-2">{m.reference_number || '-'}</td><td className="px-3 py-2">{m.item || '-'}</td>
                  <td className="px-3 py-2">{m.location || '-'}</td><td className="px-3 py-2">{m.batch_number || '-'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${m.direction === 'in' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{m.direction === 'in' ? '+' : '-'}{n(m.quantity)}</td>
                </tr>
              ))}
              {d.movements.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Belum ada mutasi.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
