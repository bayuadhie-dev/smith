import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { useGetLogisticsProvidersQuery } from '../../services/shippingApi'

interface Line {
  so_item_id: number
  product_id: number
  code: string
  name: string
  description: string
  ordered: number
  shipped: number
  uom: string
  ship: string
}

const SHIPPABLE_EXCLUDED = ['draft', 'cancelled', 'shipped', 'completed', 'closed']
const fmt = (n: number) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 })

export default function ShippingOrderForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: providersData } = useGetLogisticsProvidersQuery({})
  const providers: any[] = providersData?.logistics_providers || providersData?.providers || []

  const [orders, setOrders] = useState<any[]>([])
  const [soId, setSoId] = useState<number | string | null>(null)
  const [so, setSo] = useState<any>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    shipping_date: new Date().toISOString().split('T')[0],
    shipping_address: '',
    driver_name: '',
    driver_phone: '',
    vehicle_number: '',
    vehicle_type: '',
    logistics_provider_id: '',
    tracking_number: '',
    notes: '',
  })

  useEffect(() => {
    axiosInstance.get('/api/sales/orders?per_page=500')
      .then((r) => setOrders((r.data?.orders || []).filter((o: any) => !SHIPPABLE_EXCLUDED.includes(String(o.status || '').toLowerCase()))))
      .catch(() => setOrders([]))
  }, [])

  useEffect(() => {
    if (!soId) { setSo(null); setLines([]); return }
    axiosInstance.get(`/api/sales/orders/${soId}`).then((r) => {
      const o = r.data
      setSo(o)
      setF((p) => ({ ...p, shipping_address: o.delivery_address || p.shipping_address, notes: p.notes || o.notes || '' }))
      setLines((o.items || []).map((i: any) => {
        const remaining = Math.max(0, Number(i.quantity) - Number(i.quantity_shipped || 0))
        return {
          so_item_id: i.id, product_id: i.product_id, code: i.product_code, name: i.product_name,
          description: i.description || '', ordered: Number(i.quantity), shipped: Number(i.quantity_shipped || 0),
          uom: i.uom, ship: remaining > 0 ? String(remaining) : '',
        }
      }))
    }).catch(() => toast.error('Gagal memuat Sales Order'))
  }, [soId])

  const totalQty = useMemo(() => lines.reduce((s, l) => s + (Number(l.ship) || 0), 0), [lines])
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const setShip = (idx: number, v: string) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ship: v } : l)))

  if (id) {
    return (
      <div className="p-6 max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Surat Jalan tidak dapat diubah</h1>
        <p className="text-gray-600 dark:text-gray-300">Stok sudah terpotong saat surat jalan dibuat. Untuk koreksi, batalkan surat jalan lalu buat yang baru.</p>
        <Link to={`/app/shipping/orders/${id}`} className="btn-primary inline-block">Kembali ke detail</Link>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!so) { toast.error('Pilih Sales Order dulu'); return }
    const items = lines.filter((l) => Number(l.ship) > 0)
    if (items.length === 0) { toast.error('Isi qty kirim minimal satu barang'); return }
    const over = items.find((l) => Number(l.ship) > l.ordered - l.shipped + 0.01)
    if (over) { toast.error(`Qty kirim ${over.name} melebihi sisa (${fmt(over.ordered - over.shipped)})`); return }
    setSaving(true)
    try {
      const res = await axiosInstance.post('/api/shipping/orders', {
        sales_order_id: so.id,
        customer_id: so.customer_id,
        shipping_date: f.shipping_date,
        shipping_address: f.shipping_address || undefined,
        driver_name: f.driver_name || undefined,
        driver_phone: f.driver_phone || undefined,
        vehicle_number: f.vehicle_number || undefined,
        vehicle_type: f.vehicle_type || undefined,
        logistics_provider_id: f.logistics_provider_id ? Number(f.logistics_provider_id) : undefined,
        tracking_number: f.tracking_number || undefined,
        notes: f.notes || undefined,
        items: items.map((l) => ({ product_id: l.product_id, quantity: Number(l.ship), uom: l.uom })),
      })
      toast.success('Surat Jalan dibuat, stok terpotong')
      navigate(`/app/shipping/orders/${res.data.shipping_id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan surat jalan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Surat Jalan Baru</h1>
        <p className="text-gray-600 dark:text-gray-300">Isian di bawah sama dengan yang tercetak di dokumen Surat Jalan. Stok terpotong otomatis (FIFO) saat disimpan.</p>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Sales Order *</label>
            <SearchableSelect
              options={orders.map((o: any) => ({ id: o.id, code: o.order_number, name: o.customer_name || o.customer?.company_name || '' }))}
              value={soId}
              onChange={(v) => setSoId(v)}
              placeholder="Pilih Sales Order"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Tanggal *</label>
            <input type="date" className="input-field" value={f.shipping_date} onChange={(e) => set('shipping_date', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Kepada (Pelanggan)</label>
            <input className="input-field bg-gray-50 dark:bg-gray-900" value={so?.customer?.company_name || ''} readOnly placeholder="Terisi dari Sales Order" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">No. PO Pelanggan</label>
            <input className="input-field bg-gray-50 dark:bg-gray-900" value={so?.customer_po_number || ''} readOnly />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Alamat Kirim</label>
            <textarea className="input-field" rows={2} value={f.shipping_address} onChange={(e) => set('shipping_address', e.target.value)} placeholder="Kosong = alamat tagihan pelanggan" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Sopir</label>
            <input className="input-field" value={f.driver_name} onChange={(e) => set('driver_name', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">No. Kendaraan</label>
            <input className="input-field" value={f.vehicle_number} onChange={(e) => set('vehicle_number', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Telepon Sopir</label>
            <input className="input-field" value={f.driver_phone} onChange={(e) => set('driver_phone', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Jenis Kendaraan</label>
            <input className="input-field" value={f.vehicle_type} onChange={(e) => set('vehicle_type', e.target.value)} placeholder="Truk, Van, ..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Ekspedisi (opsional)</label>
            <select className="input-field" value={f.logistics_provider_id} onChange={(e) => set('logistics_provider_id', e.target.value)}>
              <option value="">- Kirim sendiri -</option>
              {providers.map((p: any) => <option key={p.id} value={p.id}>{p.company_name || p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">No. Resi (opsional)</label>
            <input className="input-field" value={f.tracking_number} onChange={(e) => set('tracking_number', e.target.value)} />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-3">Barang</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500">Pilih Sales Order untuk memuat barang.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b">
                    <th className="py-2 pr-3">No.</th><th className="pr-3">Kode</th><th className="pr-3">Nama Produk</th>
                    <th className="pr-3 text-right">Dipesan</th><th className="pr-3 text-right">Sudah Dikirim</th>
                    <th className="pr-3 text-right w-40">Qty Kirim</th><th className="pr-3">Satuan</th><th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.so_item_id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{i + 1}</td>
                      <td className="pr-3">{l.code}</td>
                      <td className="pr-3">{l.name}</td>
                      <td className="pr-3 text-right">{fmt(l.ordered)}</td>
                      <td className="pr-3 text-right">{fmt(l.shipped)}</td>
                      <td className="pr-3"><NumberInput className="input-field text-right" value={l.ship} onChange={(e: any) => setShip(i, e.target.value)} /></td>
                      <td className="pr-3">{l.uom}</td>
                      <td>{l.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-right font-semibold">Total Qty: {fmt(totalQty)}</p>
              <p className="text-xs text-gray-500 text-right">Batch dipilih otomatis (FIFO) dan tercetak di kolom Batch.</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-2">Catatan</label>
          <textarea className="input-field" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/shipping/orders')}>Batal</button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving || !so}>{saving ? 'Menyimpan...' : 'Simpan Surat Jalan'}</button>
        </div>
      </form>
    </div>
  )
}
