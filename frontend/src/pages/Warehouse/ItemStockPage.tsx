import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'
import { DetailSkeleton } from '../../components/ui/Skeleton'

const TYPE: Record<string, string> = {
  goods_receipt: 'Penerimaan Barang', receipt: 'Penerimaan Barang', transfer_out: 'Pemindahan keluar',
  transfer_in: 'Pemindahan masuk', transfer: 'Pemindahan', material_issue: 'Permintaan Barang',
  adjustment: 'Penyesuaian', stock_in: 'Stok masuk', stock_out: 'Stok keluar',
  production_receipt: 'Hasil produksi', production_issue: 'Dipakai produksi',
}
// Dari mana mutasinya berasal - dipakai untuk menautkan ke dokumen aslinya.
const DOC_LINK: Record<string, (id: number) => string> = {
  grn: (id) => `/app/purchasing/grn/${id}`,
  grn_inspection: (id) => `/app/purchasing/grn/${id}`,
  grn_location_change: (id) => `/app/purchasing/grn/${id}`,
  sales_order: (id) => `/app/shipping/orders/${id}`,
  material_issue: (id) => `/app/warehouse/material-issues/${id}`,
  production_approval: (id) => `/app/production/approvals`,
}

const GROUP: Record<string, string> = {
  raw_materials: 'Bahan baku', packaging_materials: 'Bahan kemas', chemical_materials: 'Chemical',
  finished_goods: 'Barang jadi', non_inventory: 'Non persediaan', wip: 'Barang setengah jadi',
}

export default function ItemStockPage() {
  const { kind, id } = useParams()
  const [data, setData] = useState<any>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const key = kind === 'product' ? 'product_id' : 'material_id'
    axiosInstance.get('/api/stock-transfers/item-stock', {
      params: { [key]: id, date_from: from || undefined, date_to: to || undefined },
    }).then((r) => setData(r.data)).catch(() => showError('Stok barang gagal dimuat'))
  }, [kind, id, from, to])

  const perZone = useMemo(() => {
    const out: Record<string, number> = {}
    ;(data?.stock || []).forEach((s: any) => { out[s.zone || '-'] = (out[s.zone || '-'] || 0) + s.on_hand })
    return out
  }, [data])

  if (!data) return <div className="p-6"><DetailSkeleton /></div>

  const item = data.item || {}
  const s = data.summary || {}
  const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const n = (v: number) => (v ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 4 })
  const rp = (v: number) => `Rp ${(v ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
  const tgl = (v?: string | null) => (v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
  const sisaHari = (v?: string | null) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86400000) : null)

  const kartu = [
    { label: 'Stok seluruh gudang', value: `${n(s.total_on_hand)} ${item.uom || ''}`, hint: s.below_min ? `di bawah minimum ${n(item.min_stock)}` : undefined, bad: s.below_min },
    { label: 'Tersedia / direservasi', value: `${n(s.total_available)} / ${n(s.total_reserved)}` },
    { label: 'Tersebar di', value: `${s.locations || 0} lokasi · ${s.batches || 0} batch` },
    { label: 'Nilai persediaan', value: rp(s.value), hint: item.unit_cost ? `${rp(item.unit_cost)} / ${item.uom || 'unit'}` : undefined },
  ]

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={item.name || 'Stok & Mutasi Barang'}
        subtitle={[item.code, GROUP[item.group] || item.group, item.category].filter(Boolean).join(' · ')}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kartu.map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`mt-1 break-words text-lg font-bold tabular-nums ${k.bad ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{k.value}</p>
            {k.hint && <p className="mt-0.5 text-xs text-gray-400">{k.hint}</p>}
          </div>
        ))}
      </div>

      <Panel title="Keterangan barang">
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Kode', item.code || '-'],
            ['Satuan', item.uom || '-'],
            ['Kelompok', GROUP[item.group] || item.group || '-'],
            ['Stok minimum', item.min_stock ? `${n(item.min_stock)} ${item.uom || ''}` : 'tidak diatur'],
            ['Masa simpan', item.shelf_life_days ? `${item.shelf_life_days} hari` : 'tidak diatur'],
            ['Pakai nomor batch', item.require_batch ? 'ya' : 'tidak'],
            ['Pakai tanggal kedaluwarsa', item.require_expiry ? 'ya' : 'tidak'],
            ['Kedaluwarsa terdekat', s.nearest_expiry ? `${tgl(s.nearest_expiry)} (${sisaHari(s.nearest_expiry)} hari lagi)` : '-'],
            ['Mutasi terakhir', tgl(s.last_movement)],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between gap-3 border-b border-gray-100 py-1 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">{k}</span>
              <span className="text-right font-medium text-gray-900 dark:text-white">{v as string}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Stok per gudang, lokasi, dan batch">
        {data.stock.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada stok.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead>
                <tr>
                  <th className={th}>Gudang</th><th className={th}>Lokasi</th><th className={th}>Batch / Lot</th>
                  <th className={`${th} text-right`}>Stok</th><th className={`${th} text-right`}>Tersedia</th>
                  <th className={`${th} text-right`}>Direservasi</th><th className={th}>Kedaluwarsa</th><th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.stock.map((r: any, i: number) => {
                  const hari = sisaHari(r.expiry_date)
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.zone || '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.location}</td>
                      <td className="px-3 py-2">{r.batch_number || '-'}{r.lot_number ? ` / ${r.lot_number}` : ''}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(r.on_hand)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(r.available)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.reserved ? n(r.reserved) : '-'}</td>
                      <td className="px-3 py-2">
                        {r.expiry_date ? (
                          <span className={hari !== null && hari < 0 ? 'text-red-600 dark:text-red-400' : hari !== null && hari <= 30 ? 'text-amber-600 dark:text-amber-400' : ''}>
                            {tgl(r.expiry_date)}{hari !== null && ` · ${hari < 0 ? `lewat ${Math.abs(hari)} hari` : `${hari} hari`}`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2">{r.stock_status}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {Object.entries(perZone).map(([z, q]) => (
                  <tr key={z} className="text-xs text-gray-500 dark:text-gray-400">
                    <td className="px-3 py-1" colSpan={3}>Subtotal {z}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{n(q as number)}</td>
                    <td colSpan={4} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Mutasi">
        <div className="print-hide mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Dari tanggal</label>
            <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Sampai</label>
            <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button type="button" className="btn-secondary" onClick={() => { setFrom(''); setTo('') }}>Semua periode</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead>
              <tr>
                <th className={th}>Tanggal</th><th className={th}>Jenis</th><th className={th}>Dokumen</th>
                <th className={th}>Dari</th><th className={th}>Ke</th><th className={th}>Batch</th>
                <th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.movements.map((m: any, i: number) => {
                const link = m.reference_type && DOC_LINK[m.reference_type]
                return (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-3 py-2">{tgl(m.date)}</td>
                    <td className="px-3 py-2">{TYPE[m.type] || m.type}</td>
                    <td className="px-3 py-2">
                      {m.reference_number
                        ? (link ? <Link to={link(m.reference_id)} className="text-emerald-700 hover:underline dark:text-emerald-300">{m.reference_number}</Link> : m.reference_number)
                        : '-'}
                    </td>
                    <td className="px-3 py-2">{m.from_label || '-'}</td>
                    <td className="px-3 py-2">{m.to_label || '-'}</td>
                    <td className="px-3 py-2">{m.batch_number || '-'}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.direction === 'in' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                      {m.direction === 'in' ? '+' : '-'}{n(m.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{n(m.balance)}</td>
                  </tr>
                )
              })}
              {data.movements.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Belum ada mutasi pada periode ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Link to="/app/warehouse/stock-summary" className="text-sm text-emerald-700 hover:underline dark:text-emerald-300">Kembali ke Barang per Gudang</Link>
    </div>
  )
}
