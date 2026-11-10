import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'

const TYPE: Record<string, string> = {
  goods_receipt: 'Penerimaan Barang', transfer_out: 'Pemindahan keluar', transfer_in: 'Terima Barang', transfer: 'Pemindahan', material_issue: 'Permintaan Barang',
  adjustment: 'Penyesuaian', stock_in: 'Stok masuk', stock_out: 'Stok keluar',
}

export default function ItemStockPage() {
  const { kind, id } = useParams()
  const [data, setData] = useState<any>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    const key = kind === 'product' ? 'product_id' : 'material_id'
    axiosInstance.get('/api/stock-transfers/item-stock', { params: { [key]: id } }).then((r) => setData(r.data)).catch(() => showError('Stok barang gagal dimuat'))
    axiosInstance.get(kind === 'product' ? `/api/products/${id}` : `/api/warehouse/materials/${id}`).then((r) => setName(r.data?.name || r.data?.material?.name || r.data?.product?.name || '')).catch(() => undefined)
  }, [kind, id])

  if (!data) return <div className="p-6 text-sm text-gray-500">Memuat...</div>
  const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const n = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 4 })
  const perZone: Record<string, number> = {}
  data.stock.forEach((s: any) => { perZone[s.zone || '-'] = (perZone[s.zone || '-'] || 0) + s.on_hand })
  return (
    <div className="space-y-4 p-6">
      <PageHeader title={name || 'Stok & Mutasi Barang'} subtitle={`Total di semua gudang: ${n(data.total_on_hand)}`} />
      <Panel title="Tersedia di gudang">
        {data.stock.length === 0 ? <p className="text-sm text-gray-500">Tidak ada stok.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead><tr><th className={th}>Gudang</th><th className={th}>Lokasi</th><th className={th}>Batch</th><th className={`${th} text-right`}>Stok</th><th className={`${th} text-right`}>Tersedia</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.stock.map((s: any, i: number) => (
                  <tr key={i}><td className="px-3 py-2">{s.zone || '-'}</td><td className="px-3 py-2">{s.location}</td><td className="px-3 py-2">{s.batch_number || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.on_hand)}</td><td className="px-3 py-2 text-right tabular-nums">{n(s.available)}</td><td className="px-3 py-2">{s.stock_status}</td></tr>
                ))}
              </tbody>
              <tfoot>{Object.entries(perZone).map(([z, q]) => <tr key={z} className="text-xs text-gray-500"><td className="px-3 py-1" colSpan={3}>Subtotal {z}</td><td className="px-3 py-1 text-right tabular-nums">{n(q)}</td><td colSpan={2} /></tr>)}</tfoot>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Mutasi">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead><tr><th className={th}>Tanggal</th><th className={th}>Jenis</th><th className={th}>Dokumen</th><th className={th}>Dari</th><th className={th}>Ke</th><th className={th}>Batch</th><th className={`${th} text-right`}>Qty</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.movements.map((m: any, i: number) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-2">{m.date ? new Date(m.date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-3 py-2">{TYPE[m.type] || m.type}</td><td className="px-3 py-2">{m.reference_number || '-'}</td>
                  <td className="px-3 py-2">{m.from_label || '-'}</td><td className="px-3 py-2">{m.to_label || '-'}</td><td className="px-3 py-2">{m.batch_number || '-'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${m.direction === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>{m.direction === 'in' ? '+' : '-'}{n(m.quantity)}</td>
                </tr>
              ))}
              {data.movements.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Belum ada mutasi.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <Link to="/app/warehouse/materials/list" className="text-sm text-emerald-700 hover:underline">Kembali ke daftar material</Link>
    </div>
  )
}
