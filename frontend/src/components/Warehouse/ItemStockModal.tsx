import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccessibleModal from '../ui/AccessibleModal'
import axiosInstance from '../../utils/axiosConfig'
import { Skeleton } from '../ui/Skeleton'

/**
 * Rincian satu barang tanpa meninggalkan daftar: stok per gudang/batch berikut
 * kedaluwarsanya, dan mutasi terakhirnya. Halaman penuhnya tetap ada untuk yang
 * perlu menyaring periode atau menelusuri dokumen.
 */
export default function ItemStockModal({ kind, itemId, name, onClose }: {
  kind: 'material' | 'product'
  itemId: number
  name?: string
  onClose: () => void
}) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    setData(null)
    const key = kind === 'product' ? 'product_id' : 'material_id'
    axiosInstance.get('/api/stock-transfers/item-stock', { params: { [key]: itemId, limit: 20 } })
      .then((r) => setData(r.data))
      .catch(() => setData({ error: true }))
  }, [kind, itemId])

  const n = (v: number) => (v ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 4 })
  const tgl = (v?: string | null) => (v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
  const sisaHari = (v?: string | null) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86400000) : null)
  const th = 'px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'

  const item = data?.item || {}
  const s = data?.summary || {}

  return (
    <AccessibleModal isOpen onClose={onClose} size="xl" title={name || item.name || 'Rincian barang'}>
      {!data ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      ) : data.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">Rincian barang gagal dimuat.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Stok', `${n(s.total_on_hand)} ${item.uom || ''}`],
              ['Tersedia', n(s.total_available)],
              ['Batch', `${s.batches || 0} batch · ${s.locations || 0} lokasi`],
              ['Kedaluwarsa terdekat', s.nearest_expiry ? tgl(s.nearest_expiry) : '-'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{k}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">Stok per gudang dan batch</h4>
            <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                  <tr><th className={th}>Gudang</th><th className={th}>Batch</th><th className={`${th} text-right`}>Stok</th><th className={th}>Kedaluwarsa</th><th className={th}>Status</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(data.stock || []).map((r: any, i: number) => {
                    const hari = sisaHari(r.expiry_date)
                    return (
                      <tr key={i}>
                        <td className="px-2 py-1.5">{r.zone || '-'}<span className="ml-1 text-xs text-gray-400">{r.location}</span></td>
                        <td className="px-2 py-1.5">{r.batch_number || '-'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{n(r.on_hand)}</td>
                        <td className={`px-2 py-1.5 ${hari !== null && hari < 0 ? 'text-red-600 dark:text-red-400' : hari !== null && hari <= 30 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {r.expiry_date ? tgl(r.expiry_date) : '-'}
                        </td>
                        <td className="px-2 py-1.5">{r.stock_status}</td>
                      </tr>
                    )
                  })}
                  {(data.stock || []).length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500 dark:text-gray-400">Tidak ada stok.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">Mutasi terakhir</h4>
            <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                  <tr><th className={th}>Tanggal</th><th className={th}>Dokumen</th><th className={th}>Batch</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Saldo</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(data.movements || []).map((m: any, i: number) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-2 py-1.5">{tgl(m.date)}</td>
                      <td className="px-2 py-1.5">{m.reference_number || '-'}</td>
                      <td className="px-2 py-1.5">{m.batch_number || '-'}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${m.direction === 'in' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                        {m.direction === 'in' ? '+' : '-'}{n(m.quantity)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{n(m.balance)}</td>
                    </tr>
                  ))}
                  {(data.movements || []).length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500 dark:text-gray-400">Belum ada mutasi.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <Link to={`/app/warehouse/item-stock/${kind}/${itemId}`} className="inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-300" onClick={onClose}>
            Buka halaman lengkap (saringan periode, tautan dokumen, nilai persediaan)
          </Link>
        </div>
      )}
    </AccessibleModal>
  )
}
