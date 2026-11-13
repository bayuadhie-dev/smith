import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'

import { DetailSkeleton } from '../../components/ui/Skeleton'
const TYPE: Record<string, string> = {
  goods_receipt: 'Penerimaan Barang', transfer_out: 'Pemindahan keluar', transfer_in: 'Terima Barang', transfer: 'Pemindahan', material_issue: 'Permintaan Barang',
  adjustment: 'Penyesuaian', stock_in: 'Stok masuk', stock_out: 'Stok keluar',
}

export default function ZoneStockPage() {
  const { id } = useParams()
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    axiosInstance.get(`/api/stock-transfers/zone-stock/${id}`).then((r) => setD(r.data)).catch(() => showError('Data gudang gagal dimuat'))
  }, [id])
  if (!d) return <div className="p-6"><DetailSkeleton /></div>
  const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const n = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 4 })
  return (
    <div className="space-y-4 p-6">
      <PageHeader title={d.zone.name} subtitle={`${d.zone.code} · ${d.items.length} jenis barang · ${d.locations.length} lokasi`} />
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
        {d.items.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada stok.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead><tr><th className={th}>Kode</th><th className={th}>Nama</th><th className={`${th} text-right`}>Stok</th><th className={`${th} text-right`}>Tersedia</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {d.items.map((i: any) => (
                  <tr key={`${i.kind}${i.item_id}`}>
                    <td className="px-3 py-2">{i.code}</td>
                    <td className="px-3 py-2"><Link to={`/app/warehouse/item-stock/${i.kind}/${i.item_id}`} className="text-emerald-700 hover:underline dark:text-emerald-300">{i.name}</Link></td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(i.on_hand)} {i.uom}</td><td className="px-3 py-2 text-right tabular-nums">{n(i.available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
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
