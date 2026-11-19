import { PendingAttachments, uploadAttachments } from '../../components/AttachmentsPanel'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'

interface Line {
  product_id: number | null
  code: string
  description: string
  uom: string
  /** Pilihan satuan untuk baris ini, diambil dari master barangnya. */
  uom_options: string[]
  batch_number: string
  quantity: string
  unit_price: string
  tiers: string
}

const TERMS: Record<string, number> = { due_on_receipt: 0, net_7: 7, net_15: 15, net_30: 30, net_60: 60, net_90: 90 }
const TERM_LABEL: Record<string, string> = { due_on_receipt: 'Tunai / Saat diterima', net_7: 'NET 7', net_15: 'NET 15', net_30: 'NET 30', net_60: 'NET 60', net_90: 'NET 90' }
const EXCLUDED = ['draft', 'cancelled']
const today = () => new Date().toISOString().split('T')[0]
const addDays = (d: string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().split('T')[0] }
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const effective = (tiers: string) => {
  const parts = String(tiers || '').replace('%', '').split('+').map((x) => parseFloat(x.trim().replace(',', '.'))).filter((x) => !isNaN(x))
  return parts.length ? (1 - parts.reduce((k, d) => k * (1 - d / 100), 1)) * 100 : 0
}
const blank = (): Line => ({ product_id: null, code: '', description: '', uom: '', uom_options: [], batch_number: '', quantity: '1', unit_price: '', tiers: '' })

/** Satuan yang boleh dipakai untuk satu barang: hanya yang didaftarkan di masternya. */
const uomsOf = (p: any): string[] => [p?.uom, p?.secondary_uom].filter((u: string) => !!u && String(u).trim())

export default function SalesInvoiceFormNew() {
  const navigate = useNavigate()
  const [attFiles, setAttFiles] = useState<File[]>([])
  const [params] = useSearchParams()
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [shipments, setShipments] = useState<any[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [customerId, setCustomerId] = useState<number | string | null>(null)
  const [soId, setSoId] = useState<number | string | null>(params.get('sales_order_id') ? Number(params.get('sales_order_id')) : null)
  const [so, setSo] = useState<any>(null)
  const [date, setDate] = useState(today())
  const [terms, setTerms] = useState('net_30')
  const [due, setDue] = useState(addDays(today(), 30))
  const [taxRate, setTaxRate] = useState('11')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([blank()])
  type BatchOption = { no: string; qty: number; expiry: string | null }
  const [batchOptions, setBatchOptions] = useState<Record<number, BatchOption[]>>({})
  // Baris yang sengaja diketik manual: batch lama yang stoknya sudah habis tidak
  // muncul di daftar, dan faktur susulan untuk barang yang sudah terkirim masih
  // perlu nomornya.
  const [manualBatch, setManualBatch] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)

  /** Tanpa Sales Order dan tanpa Surat Jalan, nomor batch jadi satu-satunya jejak ketelusuran. */
  const butuhBatch = !soId && picked.length === 0

  useEffect(() => {
    axiosInstance.get('/api/sales/customers?per_page=1000').then((r) => setCustomers(r.data?.customers || [])).catch(() => {})
    axiosInstance.get('/api/products-new/?per_page=1000').then((r) => setProducts((r.data?.products || []).map((p: any) => ({
      id: p.id, code: p.kode_produk || p.code, name: p.nama_produk || p.name,
      uom: p.satuan || p.primary_uom || '', secondary_uom: p.secondary_uom || '', price: Number(p.harga_jual || p.price || 0),
    })))).catch(() => {})
  }, [])

  useEffect(() => {
    const q = customerId ? `&customer_id=${customerId}` : ''
    axiosInstance.get(`/api/sales/orders?per_page=300${q}`)
      .then((r) => setOrders((r.data?.orders || []).filter((o: any) => !EXCLUDED.includes(String(o.status || '').toLowerCase()))))
      .catch(() => setOrders([]))
  }, [customerId])

  useEffect(() => { setDue(addDays(date, TERMS[terms] ?? 30)) }, [date, terms])

  useEffect(() => {
    setPicked([]); setShipments([])
    if (!soId) { setSo(null); return }
    axiosInstance.get(`/api/sales/orders/${soId}`).then((r) => {
      const o = r.data
      setSo(o)
      setCustomerId(o.customer_id)
      if (o.payment_terms && TERMS[o.payment_terms] !== undefined) setTerms(o.payment_terms)
      setLines((o.items || []).map((i: any) => {
        const p = products.find((x) => x.id === i.product_id)
        const opts = uomsOf(p)
        return {
          product_id: i.product_id, code: i.product_code, description: i.description || i.product_name || '',
          uom: i.uom || opts[0] || '', uom_options: opts, batch_number: '',
          quantity: String(i.quantity), unit_price: String(i.unit_price),
          tiers: i.discount_tiers || (i.discount_percent ? String(i.discount_percent) : ''),
        }
      }))
    }).catch(() => toast.error('Gagal memuat Sales Order'))
    axiosInstance.get(`/api/shipping/orders/uninvoiced?sales_order_id=${soId}`).then((r) => setShipments(r.data?.orders || [])).catch(() => setShipments([]))
  }, [soId])

  useEffect(() => {
    if (soId) return
    setPicked([])
    if (!customerId) { setShipments([]); return }
    axiosInstance.get(`/api/shipping/orders/uninvoiced?customer_id=${customerId}`).then((r) => setShipments(r.data?.orders || [])).catch(() => setShipments([]))
  }, [customerId, soId])

  const togglePick = (sid: number) => {
    const next = picked.includes(sid) ? picked.filter((x) => x !== sid) : [...picked, sid]
    setPicked(next)
    if (!soId) {
      const agg = new Map<string, Line>()
      shipments.filter((s) => next.includes(s.id)).forEach((s) => s.items.forEach((it: any) => {
        const key = it.product_id ? `p${it.product_id}` : `d${String(it.description || '').trim().toLowerCase()}|${String(it.uom || '').toLowerCase()}`
        const cur = agg.get(key)
        if (cur) cur.quantity = String(Number(cur.quantity) + Number(it.quantity))
        else {
          const p = products.find((x) => x.id === it.product_id)
          const opts = uomsOf(p)
          agg.set(key, { product_id: it.product_id || null, code: it.product_code || '', description: it.description || '',
                         uom: it.uom || opts[0] || '', uom_options: opts, batch_number: '',
                         quantity: String(it.quantity), unit_price: '', tiers: '' })
        }
      }))
      setLines(agg.size ? Array.from(agg.values()) : [blank()])
      return
    }
    if (next.length === 0) return
    const qty: Record<number, number> = {}
    shipments.filter((s) => next.includes(s.id)).forEach((s) => s.items.forEach((it: any) => { qty[it.product_id] = (qty[it.product_id] || 0) + Number(it.quantity) }))
    setLines((ls) => ls.filter((l) => l.product_id && qty[l.product_id]).map((l) => ({ ...l, quantity: String(qty[l.product_id as number]) })))
  }

  useEffect(() => {
    const ids = Array.from(new Set(lines.map((l) => l.product_id).filter((x): x is number => !!x)))
    ids.filter((id) => !(id in batchOptions)).forEach((id) => {
      axiosInstance.get('/api/shipping/stock-options', { params: { product_id: id } })
        .then((r) => {
          // Remaining stock per batch is summed across zones: Finance picks a
          // number, not a location. The earliest expiry of that batch rides
          // along so the oldest stock is the obvious choice.
          const perBatch = new Map<string, { qty: number; expiry: string | null }>()
          ;(r.data?.zones || []).forEach((z: any) => (z.batches || []).forEach((b: any) => {
            const no = (b.batch_number || '').trim()
            if (!no) return
            const prev = perBatch.get(no)
            const expiry = b.expiry_date || null
            perBatch.set(no, {
              qty: (prev?.qty || 0) + Number(b.qty || 0),
              expiry: !prev?.expiry ? expiry : (expiry && expiry < prev.expiry ? expiry : prev.expiry),
            })
          }))
          const batches = Array.from(perBatch.entries()).map(([no, v]) => ({ no, qty: v.qty, expiry: v.expiry }))
          // Nearest expiry first (batches without one go last), then by number:
          // the list itself nudges towards selling the oldest stock. Nothing is
          // picked automatically - that stays the team's call, same as Accurate.
          batches.sort((a, b) => {
            if (a.expiry && b.expiry && a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1
            if (a.expiry && !b.expiry) return -1
            if (!a.expiry && b.expiry) return 1
            return a.no.localeCompare(b.no, 'id', { numeric: true })
          })
          setBatchOptions((p) => ({ ...p, [id]: batches }))
        })
        .catch(() => setBatchOptions((p) => ({ ...p, [id]: [] })))
    })
  }, [lines, batchOptions])

  const bulanTahun = (iso: string) => {
    const [y, m] = iso.split('-')
    return `${m}/${y}`
  }
  const sisaBatch = (productId: number | null, batch: string) =>
    (productId && batchOptions[productId] ? batchOptions[productId].find((b) => b.no === batch)?.qty : undefined)

  /** Pecah satu baris jadi beberapa baris, satu batch per baris, diisi dari batch
   *  yang kedaluwarsanya paling dekat (daftar sudah terurut begitu). Accurate
   *  menyelesaikan ini dengan memilih beberapa nomor dalam satu baris; di sini
   *  satu baris tetap satu batch supaya nomornya ikut tercetak per baris faktur. */
  const bagiPerBatch = (i: number) => {
    const line = lines[i]
    if (!line.product_id) return
    const opsi = batchOptions[line.product_id] || []
    let sisaButuh = Number(line.quantity || 0)
    if (!sisaButuh || opsi.length === 0) return
    const pecahan: Line[] = []
    for (const b of opsi) {
      if (sisaButuh <= 0) break
      const ambil = Math.min(sisaButuh, b.qty)
      if (ambil <= 0) continue
      pecahan.push({ ...line, batch_number: b.no, quantity: String(ambil) })
      sisaButuh -= ambil
    }
    if (sisaButuh > 0) pecahan.push({ ...line, batch_number: '', quantity: String(sisaButuh) })
    if (pecahan.length <= 1) return
    setLines((ls) => [...ls.slice(0, i), ...pecahan, ...ls.slice(i + 1)])
    setManualBatch({})
  }

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const pickProduct = (i: number, pid: number | string | null) => {
    const p = products.find((x) => x.id === pid)
    if (p) {
      const prev = products.find((x) => x.id === lines[i]?.product_id)
      const cur = (lines[i]?.description || '').trim()
      const keep = cur && cur !== (prev?.name || '').trim()
      const opts = uomsOf(p)
      setLine(i, {
        product_id: p.id, code: p.code, description: keep ? lines[i].description : p.name,
        uom_options: opts, uom: opts[0] || '', batch_number: '', unit_price: String(p.price || ''),
      })
    }
  }

  const totals = useMemo(() => {
    let gross = 0, disc = 0
    lines.forEach((l) => {
      const g = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0)
      gross += g
      disc += g * (effective(l.tiers) / 100)
    })
    const net = gross - disc
    const tax = net * ((Number(taxRate) || 0) / 100)
    return { gross, disc, net, tax, total: net + tax }
  }, [lines, taxRate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId) { toast.error('Pilih pelanggan'); return }
    const items = lines.filter((l) => l.description.trim() && Number(l.quantity) > 0 && Number(l.unit_price) >= 0)
    if (items.length === 0) { toast.error('Isi minimal satu barang'); return }
    if (picked.length > 0 && !soId && lines.some((l) => l.description.trim() && String(l.unit_price).trim() === '')) { toast.error('Harga tiap barang dari surat jalan harus diisi'); return }
    if (butuhBatch && items.some((l) => l.product_id && !l.batch_number.trim())) {
      toast.error('Faktur tanpa Sales Order dan Surat Jalan wajib mencantumkan nomor batch di tiap baris barang'); return
    }
    setSaving(true)
    try {
      const created = await axiosInstance.post('/api/finance/invoices', {
        invoice_type: 'sales',
        customer_id: Number(customerId),
        sales_order_id: soId ? Number(soId) : undefined,
        shipping_order_ids: picked.length ? picked : undefined,
        invoice_date: date,
        due_date: due,
        payment_terms: terms,
        tax_rate: Number(taxRate) || 0,
        notes: notes || undefined,
        items: items.map((l) => ({
          product_id: l.product_id || undefined, description: l.description, uom: l.uom,
          batch_number: l.batch_number.trim() || undefined,
          quantity: Number(l.quantity), unit_price: Number(l.unit_price),
          discount_tiers: l.tiers.trim() || undefined,
        })),
      })
      await uploadAttachments('sales_invoice', created.data?.invoice_id, attFiles)
      toast.success('Faktur penjualan dibuat')
      navigate('/app/finance/invoices')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan faktur')
    } finally {
      setSaving(false)
    }
  }

  const customer = customers.find((c) => c.id === Number(customerId))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faktur Penjualan Baru</h1>
        <p className="text-gray-600 dark:text-gray-300">Isian di bawah sama dengan yang tercetak di dokumen Invoice. Faktur pembelian ada di menu Purchasing.</p>
      </div>
      <form onSubmit={submit} className="space-y-6">
<PendingAttachments files={attFiles} onChange={setAttFiles} />
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ditagihkan Kepada (Pelanggan) *</label>
            <SearchableSelect options={customers.map((c) => ({ id: c.id, code: c.code, name: c.company_name }))} value={customerId} onChange={(v) => { setCustomerId(v); setSoId(null) }} placeholder="Pilih pelanggan" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Sales Order (opsional)</label>
            <SearchableSelect options={orders.map((o: any) => ({ id: o.id, code: o.order_number, name: o.customer_name || '' }))} value={soId} onChange={(v) => setSoId(v as any)} placeholder="Tanpa Sales Order" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Alamat Penagihan</label>
            <input className="input-field bg-gray-50 dark:bg-gray-900" readOnly value={customer?.billing_address || customer?.address || ''} placeholder="Terisi dari data pelanggan" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">No. PO Pelanggan</label>
            <input className="input-field bg-gray-50 dark:bg-gray-900" readOnly value={so?.customer_po_number || ''} placeholder="Terisi dari Sales Order" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Syarat Pembayaran</label>
            <select className="input-field" value={terms} onChange={(e) => setTerms(e.target.value)}>
              {Object.keys(TERMS).map((k) => <option key={k} value={k}>{TERM_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Tanggal Invoice *</label>
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Jatuh Tempo</label>
            <input type="date" className="input-field" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          {shipments.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Surat Jalan yang ditagih (opsional)</label>
              <div className="flex flex-wrap gap-3">
                {shipments.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-2 border rounded px-3 py-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={picked.includes(s.id)} onChange={() => togglePick(s.id)} />
                    {s.shipping_number}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Memilih surat jalan memuat barang, jumlah, dan satuannya ke faktur ini. Untuk surat jalan tanpa Sales Order, harga diisi di faktur.</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Barang</h2>
            <button type="button" className="btn-secondary" onClick={() => setLines((ls) => [...ls, blank()])}>+ Tambah Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b dark:text-gray-400">
                  <th className="py-2 pr-2">No.</th><th className="pr-2 w-64">Kode / Barang</th><th className="pr-2">Keterangan</th>
                  <th className="pr-2 w-28 text-right">Qty</th><th className="pr-2 w-24">Satuan</th>
                  <th className="pr-2 w-32">No. Batch{butuhBatch ? ' *' : ''}</th><th className="pr-2 w-36 text-right">Harga</th>
                  <th className="pr-2 w-28">Diskon % (10+5)</th><th className="pr-2 w-36 text-right">Jumlah</th><th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const gross = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0)
                  const net = gross * (1 - effective(l.tiers) / 100)
                  return (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-2">{i + 1}</td>
                      <td className="pr-2">
                        <SearchableSelect options={products.map((p) => ({ id: p.id, code: p.code, name: p.name }))} value={l.product_id} onChange={(v) => pickProduct(i, v)} placeholder="Pilih barang" />
                      </td>
                      <td className="pr-2"><input className="input-field" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                      <td className="pr-2"><NumberInput className="input-field text-right" value={l.quantity} onChange={(e: any) => setLine(i, { quantity: e.target.value })} /></td>
                      <td className="pr-2">
                        {l.uom_options.length > 0 ? (
                          <select className="input-field" value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })}>
                            {l.uom_options.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        ) : (
                          <input className="input-field" value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })} placeholder="Satuan" />
                        )}
                      </td>
                      <td className="pr-2">
                        {/* Finance meminta batch dipilih dari daftar, bukan diketik
                            (masukan 2026-11-19). Daftarnya nomor batch yang masih
                            punya stok, lengkap dengan sisanya supaya tidak salah
                            pilih batch yang tinggal sedikit. */}
                        {l.product_id && (batchOptions[l.product_id] || []).length > 0 && !manualBatch[i] ? (
                          <select
                            className="input-field min-w-[150px]"
                            value={l.batch_number}
                            onChange={(e) => {
                              if (e.target.value === '__manual__') {
                                setManualBatch((m) => ({ ...m, [i]: true }))
                                setLine(i, { batch_number: '' })
                                return
                              }
                              setLine(i, { batch_number: e.target.value })
                            }}
                          >
                            <option value="">{butuhBatch ? '- Pilih batch -' : '- Tanpa batch -'}</option>
                            {(batchOptions[l.product_id] || []).map((b) => (
                              <option key={b.no} value={b.no}>
                                {b.no} (sisa {b.qty.toLocaleString('id-ID')}{b.expiry ? `, exp ${bulanTahun(b.expiry)}` : ''})
                              </option>
                            ))}
                            <option value="__manual__">Ketik manual...</option>
                          </select>
                        ) : (
                          <input
                            className="input-field"
                            value={l.batch_number}
                            onChange={(e) => setLine(i, { batch_number: e.target.value })}
                            placeholder={butuhBatch ? 'Wajib' : 'Opsional'}
                          />
                        )}
                        {l.product_id && (batchOptions[l.product_id] || []).length === 0 && (
                          <p className="mt-1 text-[11px] text-gray-400">Belum ada batch dengan stok</p>
                        )}
                        {/* Qty melebihi sisa batch yang dipilih: ditegur di sini, bukan
                            saat disimpan, dan ditawarkan memecahnya seperti memilih
                            beberapa nomor pada satu barang di Accurate. */}
                        {(() => {
                          const sisa = sisaBatch(l.product_id, l.batch_number)
                          const butuh = Number(l.quantity || 0)
                          if (sisa === undefined || !butuh || butuh <= sisa) return null
                          const totalSisa = (batchOptions[l.product_id as number] || []).reduce((t, b) => t + b.qty, 0)
                          return (
                            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                              Qty {butuh.toLocaleString('id-ID')} melebihi sisa batch ini ({sisa.toLocaleString('id-ID')}).
                              {totalSisa >= butuh ? (
                                <button type="button" className="ml-1 underline" onClick={() => bagiPerBatch(i)}>
                                  Bagi ke beberapa batch
                                </button>
                              ) : (
                                <span className="ml-1">Total semua batch cuma {totalSisa.toLocaleString('id-ID')}.</span>
                              )}
                            </div>
                          )
                        })()}
                        {/* Jalan kembali ke daftar, supaya "Ketik manual" tidak jadi jalan buntu. */}
                        {l.product_id && manualBatch[i] && (batchOptions[l.product_id] || []).length > 0 && (
                          <button
                            type="button"
                            className="mt-1 text-[11px] text-primary-700 hover:underline dark:text-primary-300"
                            onClick={() => { setManualBatch((m) => ({ ...m, [i]: false })); setLine(i, { batch_number: '' }) }}
                          >
                            Pilih dari daftar
                          </button>
                        )}
                      </td>
                      <td className="pr-2"><NumberInput currency className="input-field text-right" value={l.unit_price} onChange={(e: any) => setLine(i, { unit_price: e.target.value })} /></td>
                      <td className="pr-2"><input className="input-field" inputMode="decimal" value={l.tiers} onChange={(e) => setLine(i, { tiers: e.target.value })} placeholder="0" /></td>
                      <td className="pr-2 text-right pt-3">{rp(net)}</td>
                      <td>{lines.length > 1 && <button type="button" className="text-red-600 px-2 pt-2 dark:text-red-400" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>Hapus</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <label className="block text-sm font-medium mb-2">Catatan</label>
            <textarea className="input-field" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="card p-6 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{rp(totals.gross)}</span></div>
            <div className="flex justify-between"><span>Diskon</span><span>{rp(totals.disc)}</span></div>
            <div className="flex justify-between items-center">
              <span>PPN (%)</span>
              <span className="flex items-center gap-2"><NumberInput className="input-field w-20 text-right" value={taxRate} onChange={(e: any) => setTaxRate(e.target.value)} /> {rp(totals.tax)}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Barang dengan kode PPN di master produk memakai tarifnya sendiri; angka ini untuk baris tanpa kode.</p>
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>TOTAL</span><span>{rp(totals.total)}</span></div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sudah Dibayar dan Sisa Tagihan terisi otomatis saat pembayaran dicatat.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 flex-wrap">
          <Link to="/app/finance/invoices" className="btn-secondary">Batal</Link>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Faktur'}</button>
        </div>
      </form>
    </div>
  )
}
