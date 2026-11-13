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

interface ManualLine {
  key: number
  kind: 'product' | 'service'
  product_id: number | string | null
  description: string
  qty: string
  uom: string
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
  const [mode, setMode] = useState<'so' | 'manual'>('so')
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [customerId, setCustomerId] = useState<number | string | null>(null)
  const [manual, setManual] = useState<ManualLine[]>([])
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
    if (mode !== 'manual' || customers.length) return
    axiosInstance.get('/api/sales/customers?per_page=1000').then((r) => setCustomers(r.data?.customers || [])).catch(() => toast.error('Gagal memuat pelanggan'))
    axiosInstance.get('/api/shipping/service-items').then((r) => setServices(r.data?.items || [])).catch(() => toast.error('Gagal memuat master non persediaan'))
    axiosInstance.get('/api/products?status=active&per_page=2000').then((r) => setProducts(r.data?.products || r.data?.items || [])).catch(() => toast.error('Gagal memuat barang'))
  }, [mode, customers.length])

  useEffect(() => {
    if (mode !== 'manual') return
    const c = customers.find((x: any) => x.id === customerId)
    if (c) setF((p) => ({ ...p, shipping_address: c.address || '' }))
  }, [customerId, customers, mode])

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

  const totalQty = useMemo(
    () => (mode === 'so' ? lines.reduce((s, l) => s + (Number(l.ship) || 0), 0) : manual.reduce((s, l) => s + (Number(l.qty) || 0), 0)),
    [lines, manual, mode],
  )
  const addManual = (kind: ManualLine['kind']) => setManual((m) => [...m, { key: Date.now() + m.length, kind, product_id: null, description: '', qty: '', uom: kind === 'service' ? 'LOT' : '' }])
  const patchManual = (key: number, patch: Partial<ManualLine>) => setManual((m) => m.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const pickProduct = (key: number, pid: number | string | null) => {
    const prod = products.find((x: any) => x.id === pid)
    patchManual(key, { product_id: pid, uom: prod?.primary_uom || '', description: prod?.name || '' })
  }
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
    let items: any[] = []
    if (mode === 'so') {
      if (!so) { toast.error('Pilih Sales Order dulu'); return }
      const picked = lines.filter((l) => Number(l.ship) > 0)
      if (picked.length === 0) { toast.error('Isi qty kirim minimal satu barang'); return }
      const over = picked.find((l) => Number(l.ship) > l.ordered - l.shipped + 0.01)
      if (over) { toast.error(`Qty kirim ${over.name} melebihi sisa (${fmt(over.ordered - over.shipped)})`); return }
      items = picked.map((l) => ({ product_id: l.product_id, quantity: Number(l.ship), uom: l.uom }))
    } else {
      if (!customerId) { toast.error('Pilih pelanggan dulu'); return }
      if (manual.length === 0) { toast.error('Tambah minimal satu baris'); return }
      for (const l of manual) {
        if (!(Number(l.qty) > 0)) { toast.error('Qty tiap baris harus lebih dari 0'); return }
        if (l.kind === 'product' && !l.product_id) { toast.error('Pilih barang pada baris barang/waste'); return }
        if (l.kind === 'service' && !l.description.trim()) { toast.error('Isi keterangan pada baris jasa/lainnya'); return }
      }
      items = manual.map((l) => (l.kind === 'product'
        ? { product_id: l.product_id, quantity: Number(l.qty), uom: l.uom }
        : { description: l.description.trim(), quantity: Number(l.qty), uom: l.uom || 'LOT' }))
    }
    setSaving(true)
    try {
      const res = await axiosInstance.post('/api/shipping/orders', {
        sales_order_id: mode === 'so' ? so.id : undefined,
        customer_id: mode === 'so' ? so.customer_id : Number(customerId),
        shipping_date: f.shipping_date,
        shipping_address: f.shipping_address || undefined,
        driver_name: f.driver_name || undefined,
        driver_phone: f.driver_phone || undefined,
        vehicle_number: f.vehicle_number || undefined,
        vehicle_type: f.vehicle_type || undefined,
        logistics_provider_id: f.logistics_provider_id ? Number(f.logistics_provider_id) : undefined,
        tracking_number: f.tracking_number || undefined,
        notes: f.notes || undefined,
        items,
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
          <div className="md:col-span-2 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={mode === 'so'} onChange={() => setMode('so')} /> Berdasarkan Sales Order
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Tanpa Sales Order (waste, jasa, lainnya)
            </label>
          </div>
          {mode === 'so' ? (
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
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Pelanggan *</label>
              <SearchableSelect
                options={customers.map((c: any) => ({ id: c.id, code: c.code, name: c.company_name }))}
                value={customerId}
                onChange={(v) => setCustomerId(v)}
                placeholder="Pilih pelanggan"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Tanggal *</label>
            <input type="date" className="input-field" value={f.shipping_date} onChange={(e) => set('shipping_date', e.target.value)} required />
          </div>
          {mode === 'so' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Kepada (Pelanggan)</label>
                <input className="input-field bg-gray-50 dark:bg-gray-900" value={so?.customer?.company_name || ''} readOnly placeholder="Terisi dari Sales Order" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">No. PO Pelanggan</label>
                <input className="input-field bg-gray-50 dark:bg-gray-900" value={so?.customer_po_number || ''} readOnly />
              </div>
            </>
          )}
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
          {mode === 'manual' ? (
            <div className="space-y-3">
              {manual.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Tambah baris barang/waste (stok terpotong) atau baris jasa/lainnya (tanpa stok).</p>}
              {manual.map((l, i) => (
                <div key={l.key} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 md:grid-cols-12 dark:border-gray-700">
                  <div className="md:col-span-5">
                    {l.kind === 'product' ? (
                      <SearchableSelect
                        options={products.map((p: any) => ({ id: p.id, code: p.code, name: p.name }))}
                        value={l.product_id}
                        onChange={(v) => pickProduct(l.key, v)}
                        placeholder="Pilih barang / waste"
                      />
                    ) : (
                      <div className="space-y-2">
                        <SearchableSelect
                          options={services.map((p: any) => ({ id: p.id, code: p.code, name: p.name }))}
                          value={null}
                          onChange={(v) => { const it = services.find((x: any) => x.id === v); if (it) patchManual(l.key, { description: it.name, uom: it.uom || l.uom }) }}
                          placeholder="Cari jasa dari master non persediaan"
                        />
                        <input className="input-field" value={l.description} onChange={(e) => patchManual(l.key, { description: e.target.value })} placeholder="Keterangan jasa / lainnya (bisa diubah)" />
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3"><NumberInput className="input-field text-right" value={l.qty} onChange={(e: any) => patchManual(l.key, { qty: e.target.value })} placeholder="Qty" /></div>
                  <div className="md:col-span-2"><input className="input-field" value={l.uom} onChange={(e) => patchManual(l.key, { uom: e.target.value })} placeholder="Satuan" /></div>
                  <div className="md:col-span-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{l.kind === 'product' ? 'Barang / waste' : 'Jasa / lainnya'} #{i + 1}</span>
                    <button type="button" className="text-red-600 hover:underline dark:text-red-400" onClick={() => setManual((m) => m.filter((x) => x.key !== l.key))}>Hapus</button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => addManual('product')}>+ Barang / Waste</button>
                <button type="button" className="btn-secondary" onClick={() => addManual('service')}>+ Jasa / Lainnya</button>
              </div>
              <p className="text-right font-semibold">Total Qty: {fmt(totalQty)}</p>
              <p className="text-xs text-gray-500 text-right dark:text-gray-400">Baris barang/waste memotong stok (FIFO); baris jasa/lainnya tidak memengaruhi stok.</p>
            </div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Pilih Sales Order untuk memuat barang.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b dark:text-gray-400">
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
              <p className="text-xs text-gray-500 text-right dark:text-gray-400">Batch dipilih otomatis (FIFO) dan tercetak di kolom Batch.</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-2">Catatan</label>
          <textarea className="input-field" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/shipping/orders')}>Batal</button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving || (mode === 'so' ? !so : !customerId)}>{saving ? 'Menyimpan...' : 'Simpan Surat Jalan'}</button>
        </div>
      </form>
    </div>
  )
}
