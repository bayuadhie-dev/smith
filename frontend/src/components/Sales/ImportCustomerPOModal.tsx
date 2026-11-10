import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { showError, showSuccess } from '../ui/Toast'

interface Cand { id: number; code: string; name: string; uom: string; via?: string }
interface Row {
  plu: string; name: string; uom: string; pack: number; quantity: number; unit_price: number; discount_percent: number; total: number
  candidates: Cand[]; product_id: number | null; chosen?: Cand | null; factor: string; q?: string; found?: Cand[]
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

export default function ImportCustomerPOModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [po, setPo] = useState<any>(null)
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([])
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [dup, setDup] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axiosInstance.post('/api/sales/orders/import-po/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPo(r.data.po); setCustomers(r.data.customers || []); setCustomerId(r.data.customer_id || ''); setDup(r.data.duplicate_of || null)
      setRows((r.data.po.items || []).map((it: any): Row => {
        const chosen = (it.candidates || []).find((c: Cand) => c.id === it.product_id) || null
        const same = chosen && chosen.uom?.toUpperCase() === String(it.uom).toUpperCase()
        return { ...it, chosen, factor: same ? '1' : String(it.pack || 1) }
      }))
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal membaca PDF')
    } finally { setBusy(false) }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const search = async (i: number, q: string) => {
    update(i, { q })
    if (q.trim().length < 2) return update(i, { found: [] })
    try { const r = await axiosInstance.get('/api/sales/orders/import-po/products', { params: { q } }); update(i, { q, found: r.data.products || [] }) } catch { /* abaikan */ }
  }
  const pick = (i: number, c: Cand) => {
    const r = rows[i]
    update(i, { chosen: c, product_id: c.id, found: [], factor: c.uom?.toUpperCase() === String(r.uom).toUpperCase() ? '1' : String(r.pack || 1) })
  }

  const lines = rows.map((r) => {
    const f = Number(r.factor) || 1
    return { ...r, qty: r.quantity * f, price: r.unit_price / f }
  })
  const ready = !!po && !!customerId && !dup && rows.length > 0 && rows.every((r) => r.chosen)

  const create = async () => {
    setBusy(true)
    try {
      const res = await axiosInstance.post('/api/sales/orders/import-po/create', {
        customer_id: customerId, po_number: po.po_number, po_date: po.po_date, terms_days: po.terms_days,
        items: lines.map((l) => ({ plu: l.plu, product_id: l.chosen!.id, quantity: l.qty, unit_price: l.price, discount_percent: l.discount_percent, uom: l.chosen!.uom, description: l.name })),
      })
      showSuccess(`Sales Order draf ${res.data.order_number} dibuat`)
      onClose()
      navigate(`/app/sales/orders/${res.data.order_id}`)
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal membuat Sales Order')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Impor PO Pelanggan (PDF)</h3>
            <p className="text-xs text-gray-500">Unggah PO dari pelanggan. Sistem membaca isinya, Anda cek dan petakan barangnya, lalu dibuat menjadi Sales Order draf.</p>
          </div>
          <button type="button" className="text-gray-400 hover:text-gray-700" onClick={onClose}>✕</button>
        </div>

        {!po && (
          <div className="mt-4 rounded-md border border-dashed border-gray-300 p-8 text-center">
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button type="button" disabled={busy} className="btn-primary" onClick={() => fileRef.current?.click()}>{busy ? 'Membaca...' : 'Pilih file PDF'}</button>
            <p className="mt-2 text-xs text-gray-500">PDF hasil cetak (bukan foto/scan). Maksimal 10 MB.</p>
          </div>
        )}

        {po && (
          <div className="mt-4 space-y-4">
            {dup && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">PO {po.po_number} sudah pernah dibuat sebagai {dup}. Tidak bisa diimpor ulang.</p>}
            {(po.warnings || []).map((w: string, i: number) => <p key={i} className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">{w}</p>)}
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><div className="text-xs text-gray-500">No. PO</div><b>{po.po_number || '-'}</b></div>
              <div><div className="text-xs text-gray-500">Tanggal PO</div>{po.po_date || '-'}</div>
              <div><div className="text-xs text-gray-500">Termin</div>{po.terms_days ? `Net ${po.terms_days}` : '-'}</div>
              <div><div className="text-xs text-gray-500">Kirim ke</div>{po.ship_to || '-'}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pelanggan *</label>
              <select className="input-field" value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Pilih pelanggan</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!customerId && <p className="mt-1 text-xs text-amber-700">Cabang pelanggan tidak terdeteksi otomatis, pilih dari daftar.</p>}
            </div>

            <div className="space-y-3">
              {rows.map((r, i) => {
                const l = lines[i]
                return (
                  <div key={i} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                    <div className="text-sm"><b>PLU {r.plu}</b> · {r.name}</div>
                    <div className="mt-1 text-xs text-gray-500">PO: {r.quantity.toLocaleString('id-ID')} {r.uom} (isi {r.pack}) × {rp(r.unit_price)}, diskon {r.discount_percent}%</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <label className="text-xs text-gray-500">Produk kita *</label>
                        <select className="input-field" value={r.chosen?.id || ''} onChange={(e) => { const c = [...r.candidates, ...(r.found || []), ...(r.chosen ? [r.chosen] : [])].find((x) => x.id === Number(e.target.value)); if (c) pick(i, c) }}>
                          <option value="">Pilih produk</option>
                          {[...(r.chosen ? [r.chosen] : []), ...r.candidates, ...(r.found || [])].filter((c, k, a) => a.findIndex((x) => x.id === c.id) === k).map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name} ({c.uom}){c.via ? ` · ${c.via}` : ''}</option>)}
                        </select>
                        <input className="input-field mt-1" placeholder="Cari produk lain (kode atau nama)" value={r.q || ''} onChange={(e) => search(i, e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">1 {r.uom} = berapa {r.chosen?.uom || 'satuan produk'}</label>
                        <input className="input-field" type="number" min="0" step="any" value={r.factor} onChange={(e) => update(i, { factor: e.target.value })} />
                        {r.chosen && <p className="mt-1 text-xs text-emerald-700">SO: {l.qty.toLocaleString('id-ID')} {r.chosen.uom} × {rp(l.price)}, diskon {r.discount_percent}%</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-500">Total PO (dengan PPN): {rp(rows.reduce((a, r) => a + r.total, 0))}. PPN di SO mengikuti pengaturan produk. Kode PLU disimpan sebagai kode barang pelanggan supaya PO berikutnya cocok otomatis.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => { setPo(null); setRows([]) }}>Ganti file</button>
              <button type="button" className="btn-primary disabled:opacity-50" disabled={!ready || busy} onClick={create}>{busy ? 'Membuat...' : 'Buat SO draf'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
