import { enterMovesDown } from '../../utils/enterNavigation'
import { PendingAttachments, uploadAttachments } from '../../components/AttachmentsPanel'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { TabContext, clearTabDrafts, useDraftState } from '../../workspace/drafts'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { formatCurrencyAmount } from '../../utils/currencyUtils'
import { showError, showSuccess } from '../../components/ui/Toast'
import { confirmDialog } from '../../components/ui'

const PPN_RATES: Record<string, number> = { Y: 11, A: 1.1, B: 1.2, L: 12 }

interface Line {
  po_item_id: number | null
  extra?: boolean
  fromGrn?: boolean
  material_id?: number | null
  product_id?: number | null
  account_id?: string
  name: string
  code?: string
  uom: string
  ordered: number
  received: number
  invoiced: number
  qty: number | string
  price: number | string
  ppn_code: string
  description: string
}

interface OpenDP { id: number; dp_number: string; po_number: string | null; remaining: number }

const todayISO = () => new Date().toISOString().slice(0, 10)
const addDays = (iso: string, days: number) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function PurchaseInvoiceForm() {
  const navigate = useNavigate()
  const [attFiles, setAttFiles] = useState<File[]>([])
  const [params] = useSearchParams()
  const tab = useContext(TabContext)
  const grnId = params.get('grn_id') ? Number(params.get('grn_id')) : null
  const [grn, setGrn] = useState<any>(null)
  const [invNumber, setInvNumber] = useState('')
  const [nextNumber, setNextNumber] = useState('')
  const numberTouched = useRef(false)
  useEffect(() => {
    if (params.get('edit')) return
    axiosInstance.get('/api/purchasing/purchase-invoices/next-number').then((r) => setNextNumber(r.data.next_number || '')).catch(() => undefined)
  }, [])
  const editId = params.get('edit') ? Number(params.get('edit')) : null
  const [editInv, setEditInv] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierId, setSupplierId] = useDraftState<number | null>('supplierId', null, !editId)
  const [orders, setOrders] = useState<any[]>([])
  const [poId, setPoId] = useDraftState<number | null>('poId', params.get('po_id') ? Number(params.get('po_id')) : null, !editId)
  const [po, setPo] = useState<any>(null)
  const [lines, setLines] = useDraftState<Line[]>('lines', [], !editId)
  const restoredLines = useRef(lines.length > 0)
  const [expenseAccounts, setExpenseAccounts] = useState<{ id: number; code: string; name: string }[]>([])
  useEffect(() => {
    axiosInstance.get('/api/finance/chart-of-accounts').then((r) => setExpenseAccounts((r.data.accounts || []).filter((a: any) => a.type === 'expense' && !a.is_header && a.is_active !== false).map((a: any) => ({ id: a.id, code: a.code, name: a.name })))).catch(() => {})
  }, [])
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useDraftState('supInvNo', '', !editId)
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useDraftState('supInvDate', todayISO(), !editId)
  const [invoiceDate, setInvoiceDate] = useDraftState('invDate', todayISO(), !editId)
  const [dueDate, setDueDate] = useDraftState('dueDate', '', !editId)
  const [termDays, setTermDays] = useDraftState<string>('termDays', '', !editId)
  const dueTouched = useRef(false)
  const termTouched = useRef(false)
  const termLabel = (d: string) => (d === '0' ? 'C.O.D' : `Net ${d}`)
  const termChoices = Array.from(new Set(['0', '7', '14', '21', '30', '45', '60', '90', termDays].filter((x) => x !== '')))
    .sort((a, b) => Number(a) - Number(b))
  const [notes, setNotes] = useDraftState('notes', '', !editId)
  const [saving, setSaving] = useState(false)
  const [openDps, setOpenDps] = useState<OpenDP[]>([])
  const [dpUse, setDpUse] = useDraftState<Record<number, string>>('dpUse', {}, !editId)

  useEffect(() => {
    axiosInstance.get('/api/purchasing/suppliers', { params: { per_page: 1000 } })
      .then((r) => setSuppliers(r.data.suppliers || []))
      .catch(() => showError('Gagal memuat daftar pemasok'))
  }, [])

  useEffect(() => {
    if (!supplierId) { setOrders([]); return }
    axiosInstance.get('/api/purchasing/purchase-orders', { params: { supplier_id: supplierId, status: 'approved,partial,received', per_page: 200 } })
      .then((r) => setOrders(r.data.purchase_orders || []))
      .catch(() => showError('Gagal memuat daftar PO'))
  }, [supplierId])

  // Ubah faktur tanpa PO: baris diambil dari faktur lama.
  useEffect(() => {
    if (!editId || !editInv || editInv.po_id || !editInv.grn_id) return
    axiosInstance.get(`/api/purchasing/grn/${editInv.grn_id}`).then((r) => setGrn(r.data)).catch(() => undefined)
    const rc = (pct: number) => (pct >= 11.5 ? 'L' : pct >= 10 ? 'Y' : pct >= 1.15 ? 'B' : pct > 0 ? 'A' : '')
    setLines((editInv.items || []).map((x: any): Line => ({
      po_item_id: null, fromGrn: true, material_id: x.material_id ?? null, product_id: x.product_id ?? null,
      name: x.description || x.material_name || x.product_name || '(tanpa nama)', uom: x.uom || '', ordered: 0, received: 0, invoiced: 0,
      qty: Number(x.quantity), price: Number(x.unit_price), ppn_code: rc(Number(x.tax_percent || 0)), description: x.description || '',
    })))
  }, [editInv])

  // Syarat pembayaran bawaan = termin pemasok; Jatuh Tempo = tanggal faktur + termin (bisa diubah manual).
  useEffect(() => {
    if (editId || termTouched.current || termDays !== '') return
    const sup = suppliers.find((x: any) => x.id === supplierId)
    if (sup && sup.payment_terms !== undefined && sup.payment_terms !== null && sup.payment_terms !== '') setTermDays(String(Number(sup.payment_terms)))
  }, [supplierId, suppliers])
  useEffect(() => {
    if (editId || dueTouched.current || termDays === '' || !invoiceDate) return
    setDueDate(addDays(invoiceDate, Number(termDays)))
  }, [termDays, invoiceDate])

  // Faktur dari GRN tanpa PO: barang diambil dari GRN, harga diisi di sini.
  useEffect(() => {
    if (!grnId || editId) return
    axiosInstance.get(`/api/purchasing/grn/${grnId}`).then((r) => {
      const g = r.data
      setGrn(g)
      setSupplierId(g.supplier_id)
      if (g.supplier_invoice_number) setSupplierInvoiceNumber((cur) => cur || g.supplier_invoice_number)
      if (g.notes) setNotes((cur) => cur || g.notes)
      setLines((ls) => ls.length ? ls : (g.items || []).map((it: any): Line => ({
        po_item_id: null, fromGrn: true, material_id: it.material_id ?? null, product_id: it.product_id ?? null,
        name: it.item_name || '(tanpa nama)', uom: it.uom, ordered: Number(it.quantity_ordered || 0), received: Number(it.quantity_accepted || it.quantity_received || 0), invoiced: 0,
        qty: Number(it.quantity_accepted || it.quantity_received || 0), price: '', ppn_code: '', description: it.item_name || '',
      })))
    }).catch(() => showError('Gagal memuat GRN'))
  }, [grnId, editId])

  // Nomor faktur pemasok yang sudah diisi di GRN ikut terisi di sini.
  useEffect(() => {
    if (!poId || editId) return
    axiosInstance.get('/api/purchasing/grn', { params: { po_id: poId } }).then((r) => {
      const no = (r.data.grns || []).map((g: any) => g.supplier_invoice_number).find((x: string) => x && x.trim())
      if (no) setSupplierInvoiceNumber((cur) => cur || no)
    }).catch(() => undefined)
  }, [poId, editId])

  useEffect(() => {
    if (!editId) return
    axiosInstance.get(`/api/purchasing/purchase-invoices/${editId}`).then((r) => {
      const inv = r.data
      if (inv.status === 'cancelled') { showError('Faktur ini sudah dibatalkan, tidak bisa diubah.'); return }
      setEditInv(inv)
      setPoId(inv.po_id); setSupplierId(inv.supplier_id)
      setSupplierInvoiceNumber(inv.supplier_invoice_number || ''); setSupplierInvoiceDate(inv.supplier_invoice_date || todayISO())
      setInvoiceDate(inv.invoice_date || todayISO()); setDueDate(inv.due_date || ''); setNotes(inv.notes || '')
    }).catch(() => showError('Gagal memuat faktur yang akan diubah'))
  }, [editId])

  useEffect(() => {
    if (!poId) { setPo(null); if (!restoredLines.current) setLines([]); return }
    if (editId && !editInv) return
    axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`)
      .then((r) => {
        const data = r.data
        setPo(data)
        if (!supplierId) setSupplierId(data.supplier_id)
        if (!editId && data.notes) setNotes((cur) => cur || data.notes)
        const rate = data.is_taxable ? (PPN_RATES[data.ppn_code || 'Y'] ?? 0) : 0
        const inclusive = Boolean(data.is_taxable && data.tax_inclusive && rate)
        const own: Record<number, any> = {}
        ;(editInv?.items || []).forEach((x: any) => { if (x.po_item_id) own[x.po_item_id] = x })
        const rateCode = (pct: number) => (pct >= 11.5 ? 'L' : pct >= 10 ? 'Y' : pct >= 1.15 ? 'B' : pct > 0 ? 'A' : '')
        const baseLines = (data.items || []).map((it: any) => {
          const mine = own[it.id]
          const invoicedOthers = Number(it.quantity_invoiced || 0) - (mine ? Number(mine.quantity) : 0)
          const outstanding = Math.max(0, Number(it.quantity) - invoicedOthers)
          const toInvoice = mine ? Number(mine.quantity) : (it.is_non_inventory ? outstanding : Math.min(outstanding, Math.max(0, Number(it.quantity_received || 0) - invoicedOthers)))
          const price = inclusive ? Math.round((Number(it.unit_price) / (1 + rate / 100)) * 100) / 100 : Number(it.unit_price)
          return {
            po_item_id: it.id,
            name: it.material_name || it.product_name || it.description || '(tanpa nama)',
            code: it.material_code || it.product_code,
            uom: it.uom,
            ordered: Number(it.quantity),
            received: it.is_non_inventory ? Number(it.quantity_invoiced || 0) : Number(it.quantity_received || 0),
            invoiced: invoicedOthers,
            qty: toInvoice,
            price: mine ? Number(mine.unit_price) : price,
            ppn_code: mine ? rateCode(Number(mine.tax_percent || 0)) : (data.is_taxable ? (data.ppn_code || 'Y') : ''),
            description: mine ? (mine.description || '') : ((it.description || '').trim() || it.material_name || it.product_name || ''),
          } as Line
        })
        const extras: Line[] = (editInv?.items || []).filter((x: any) => !x.po_item_id).map((x: any) => ({
          po_item_id: null, extra: true, name: '', uom: x.uom || '', ordered: 0, received: 0, invoiced: 0, qty: Number(x.quantity), price: Number(x.unit_price),
          ppn_code: rateCode(Number(x.tax_percent || 0)), description: x.description || '', account_id: '',
        }))
        if (restoredLines.current) restoredLines.current = false
        else setLines([...baseLines, ...extras])
        const supplier = suppliers.find((s) => s.id === data.supplier_id)
        const days = supplier ? Number(supplier.payment_terms ?? 30) : 30
        setDueDate((d) => d || addDays(invoiceDate, Number.isFinite(days) ? days : 30))
      })
      .catch(() => showError('Gagal memuat PO'))
  }, [poId])

  const dpFirst = useRef(true)
  useEffect(() => {
    if (dpFirst.current) { dpFirst.current = false } else setDpUse({})
    if (!supplierId || editId) { setOpenDps([]); return }
    axiosInstance.get('/api/purchasing/down-payments', { params: { supplier_id: supplierId, open: 1, per_page: 100 } })
      .then((r) => setOpenDps((r.data.down_payments || []).map((d: any) => ({ id: d.id, dp_number: d.dp_number, po_number: d.po_number, remaining: Number(d.remaining || 0) }))))
      .catch(() => setOpenDps([]))
  }, [supplierId])

  const currency = po?.currency || 'IDR'
  const inclusiveNote = Boolean(po?.is_taxable && po?.tax_inclusive)

  const totals = useMemo(() => {
    let dpp = 0
    let tax = 0
    lines.forEach((l) => {
      const base = (Number(l.qty) || 0) * (Number(l.price) || 0)
      dpp += base
      tax += (base * (PPN_RATES[l.ppn_code] ?? 0)) / 100
    })
    return { dpp, tax, total: dpp + tax }
  }, [lines])

  const dpTotal = Object.values(dpUse).reduce((a, v) => a + (Number(v) || 0), 0)

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!poId && !grnId && !editInv?.grn_id) return showError('Pilih PO terlebih dahulu')
    if (!supplierInvoiceNumber.trim()) return showError('No. Faktur Pemasok wajib diisi')
    const items = lines.filter((l) => Number(l.qty) > 0)
    if (items.length === 0) return showError('Isi jumlah tagihan minimal satu baris')
    const badExtra = items.find((l) => l.extra && (!l.account_id || !(l.description || '').trim()))
    if (badExtra) return showError('Baris tambahan wajib memilih akun dan mengisi keterangan')
    for (const d of openDps) {
      const v = Number(dpUse[d.id] || 0)
      if (v < 0 || v > d.remaining + 0.005) return showError(`Uang muka ${d.dp_number}: jumlah melebihi sisa (${d.remaining.toLocaleString('id-ID')})`)
    }
    if (dpTotal > totals.total + 0.005) return showError('Total uang muka yang dipakai melebihi total tagihan')
    if (Math.abs(totals.total) < 0.005) {
      const ok = await confirmDialog('Total faktur ini Rp 0. Faktur akan otomatis berstatus lunas (tidak ada yang perlu dibayar), sedangkan stok barangnya tetap diakui. Lanjut simpan?')
      if (!ok) return
    }
    setSaving(true)
    try {
      const res = await axiosInstance.post('/api/purchasing/purchase-invoices', {
        invoice_number: !editId && numberTouched.current && invNumber.trim() ? invNumber.trim() : undefined,
        po_id: poId || undefined,
        grn_id: !poId ? (grnId || editInv?.grn_id || undefined) : undefined,
        replace_invoice_id: editId || undefined,
        supplier_id: supplierId,
        supplier_invoice_number: supplierInvoiceNumber.trim(),
        supplier_invoice_date: supplierInvoiceDate || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        payment_terms: termDays !== '' ? termLabel(termDays) : undefined,
        notes: notes || null,
        items: items.map((l) => ({ po_item_id: l.extra ? undefined : l.po_item_id, material_id: l.fromGrn ? (l.material_id || undefined) : undefined, product_id: l.fromGrn ? (l.product_id || undefined) : undefined, uom: l.fromGrn ? l.uom : undefined, account_id: l.extra && l.account_id ? Number(l.account_id) : undefined, quantity: Number(l.qty), unit_price: Number(l.price), ppn_code: l.ppn_code || '', description: (l.description || '').trim() || undefined })),
      })
      showSuccess(editId ? 'Faktur diubah. Faktur lama dibatalkan dan diganti dengan nomor yang sama.' : (res.data?.message || 'Faktur pembelian dibuat'))
      const id = res.data?.invoice?.id
      await uploadAttachments('purchase_invoice', id, attFiles)
      if (id) {
        for (const d of openDps) {
          const amt = Number(dpUse[d.id] || 0)
          if (amt <= 0) continue
          try {
            await axiosInstance.post(`/api/purchasing/down-payments/${d.id}/allocate`, { invoice_id: id, amount: amt })
            showSuccess(`Uang muka ${d.dp_number} dialokasikan ${formatCurrencyAmount(amt, 'IDR')}`)
          } catch (e: any) {
            showError(`Faktur tersimpan, tetapi alokasi uang muka ${d.dp_number} gagal: ${e?.response?.data?.error || 'kesalahan tidak dikenal'}. Alokasikan ulang dari halaman Uang Muka Pembelian.`)
          }
        }
      }
      if (tab) clearTabDrafts(tab.tabId)
      navigate(id ? `/app/purchasing/invoices/${id}${poId ? "/match" : ""}` : '/app/purchasing/invoices')
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Gagal menyimpan faktur pembelian')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/purchasing/invoices" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><ArrowLeftIcon className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{editId ? `Ubah Faktur ${editInv?.invoice_number || ""}` : "Buat Faktur Pembelian"}</h1>
          {editId && <p className="mt-1 text-sm text-amber-700">Saat disimpan, faktur lama dibatalkan (jurnal dibalik) dan diganti faktur baru dengan nomor yang sama. Faktur yang sudah dibayar atau dialokasikan uang muka tidak bisa diubah. Baris di luar PO perlu dipilih ulang akunnya.</p>}
          <p className="text-sm text-gray-500">Tagihan pemasok atas PO. Jurnal hutang diposting otomatis dan faktur ikut pencocokan 3 arah.</p>
        </div>
      </div>

      <form onSubmit={submit} onKeyDown={enterMovesDown} className="space-y-6">
<PendingAttachments files={attFiles} onChange={setAttFiles} />
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Pemasok *</label>
            <SearchableSelect
              options={suppliers.map((s: any) => ({ id: s.id, name: `${s.code} - ${s.company_name}${s.supplier_type ? ' [' + s.supplier_type + (s.supplier_subtype ? ' - ' + s.supplier_subtype : '') + ']' : ''}` }))}
              value={supplierId}
              onChange={(v) => { setSupplierId(v ? Number(v) : null); setPoId(null) }}
              placeholder="Pilih pemasok"
              className="w-full"
            />
          </div>
          {grn && !poId ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Penerimaan Barang (tanpa PO)</label>
              <div className="input-field bg-gray-50 dark:bg-gray-900">{grn.grn_number}</div>
              <p className="mt-1 text-xs text-gray-500">Faktur dibuat dari GRN ini. Isi harga satuan tiap barang sesuai faktur pemasok.</p>
            </div>
          ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Purchase Order *</label>
            <SearchableSelect
              options={orders.map((o) => ({ id: o.id, name: `${o.po_number} - ${new Date(o.order_date).toLocaleDateString('id-ID')} (${o.status})` }))}
              value={poId}
              onChange={(v) => setPoId(v ? Number(v) : null)}
              placeholder={supplierId ? 'Pilih PO' : 'Pilih pemasok dulu'}
              disabled={!supplierId}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">Hanya PO yang sudah disetujui, diterima sebagian, atau diterima penuh.</p>
          </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">No. Transaksi (PI)</label>
            {editId ? (
              <div className="input-field bg-gray-50 dark:bg-gray-900">{editInv?.invoice_number || '-'}</div>
            ) : (
              <input className="input-field" value={numberTouched.current ? invNumber : (nextNumber || '')} placeholder="Otomatis"
                onChange={(e) => { numberTouched.current = true; setInvNumber(e.target.value) }} />
            )}
            <p className="mt-1 text-xs text-gray-500">{editId ? 'Nomor lama dipertahankan.' : 'Terisi nomor berikutnya secara otomatis; bisa diganti manual.'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">No. Faktur Pemasok *</label>
            <input className="input-field" value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} placeholder="Terisi otomatis kalau sudah diisi di GRN" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tanggal Faktur Pemasok</label>
            <input type="date" className="input-field" value={supplierInvoiceDate} onChange={(e) => setSupplierInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tanggal Pembukuan *</label>
            <input type="date" className="input-field" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Syarat Pembayaran</label>
            <select className="input-field" value={termDays} onChange={(e) => { termTouched.current = true; dueTouched.current = false; setTermDays(e.target.value) }}>
              <option value="">Pilih syarat pembayaran</option>
              {termChoices.map((d) => <option key={d} value={d}>{termLabel(d)}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Bawaan dari termin pemasok. Jatuh tempo dihitung dari tanggal faktur.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Jatuh Tempo</label>
            <input type="date" className="input-field" value={dueDate} onChange={(e) => { dueTouched.current = true; setDueDate(e.target.value) }} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Catatan</label>
            <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {(po || grn) && (
          <div className="card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Baris Tagihan ({po ? po.po_number : `GRN ${grn?.grn_number}, tanpa PO`}, {currency})</h2>
              {inclusiveNote && (
                <p className="text-xs text-blue-600 dark:text-blue-400">PO ini harga sudah termasuk PPN: harga satuan di bawah sudah dipisahkan dari PPN, total tetap sama dengan PO.</p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-3">Item</th>
                    <th className="pb-2 pr-3 min-w-[12rem]">Keterangan</th>
                    <th className="pb-2 pr-3 text-right">Dipesan</th>
                    <th className="pb-2 pr-3 text-right">Diterima</th>
                    <th className="pb-2 pr-3 text-right">Sudah Ditagih</th>
                    <th className="pb-2 pr-3 text-right w-32">Qty Tagih</th>
                    <th className="pb-2 pr-3 text-right w-40">Harga Satuan</th>
                    <th className="pb-2 pr-3 w-28">PPN</th>
                    <th className="pb-2 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {lines.map((l, i) => {
                    const base = (Number(l.qty) || 0) * (Number(l.price) || 0)
                    return (
                      <tr key={l.extra || l.fromGrn ? `x${i}` : l.po_item_id}>
                        <td className="py-2 pr-3">
                          {l.extra ? (
                            <div className="min-w-[14rem]">
                              <SearchableSelect options={expenseAccounts.map((a) => ({ id: a.id, name: `${a.code} - ${a.name}` }))} value={l.account_id ? Number(l.account_id) : null}
                                onChange={(v: any) => update(i, { account_id: v ? String(v) : '' })} placeholder="Akun beban (mis. ongkos kirim)" />
                              <button type="button" className="mt-1 text-xs text-red-600 hover:underline" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>Hapus baris</button>
                            </div>
                          ) : (<>
                            <div className="font-medium text-gray-900 dark:text-white">{l.name}</div>
                            {l.code && <div className="text-xs text-gray-400">{l.code}</div>}
                          </>)}
                        </td>
                        <td className="py-2 pr-3">
                          <input className="input-field" value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Keterangan baris" />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.extra || l.fromGrn ? '-' : `${l.ordered.toLocaleString('id-ID')} ${l.uom}`}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${!l.extra && l.received < l.ordered ? 'text-amber-600' : ''}`}>{l.extra ? '-' : l.received.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.extra ? '-' : l.invoiced.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3">
                          <NumberInput className="input-field text-right" value={l.qty as any} onChange={(e: any) => update(i, { qty: e.target.value })} />
                          {!l.extra && !l.fromGrn && Number(l.qty) > l.ordered - l.invoiced + 1e-9 && (
                            <div className="mt-1 text-xs text-amber-600">Melebihi sisa PO ({Math.max(0, l.ordered - l.invoiced).toLocaleString('id-ID')}); ditandai selisih saat pencocokan 3 arah.</div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <NumberInput currency className="input-field text-right" value={l.price as any} onChange={(e: any) => update(i, { price: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <select className="input-field" value={l.ppn_code} onChange={(e) => update(i, { ppn_code: e.target.value })}>
                            <option value="">Tanpa PPN</option>
                            <option value="Y">Y - 11%</option>
                            <option value="A">A - 1,1%</option>
                            <option value="B">B - 1,2%</option>
                            <option value="L">L - 12%</option>
                          </select>
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatCurrencyAmount(base, currency)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              onClick={() => setLines((ls) => [...ls, { po_item_id: null, extra: true, name: '', uom: '', ordered: 0, received: 0, invoiced: 0, qty: 1, price: '', ppn_code: po?.is_taxable ? (po.ppn_code || 'Y') : '', description: '', account_id: '' }])}>
              + Tambah baris di luar PO (ongkos kirim, biaya lain)
            </button>
            <p className="text-xs text-gray-500">Qty tagih terisi dari barang yang sudah diterima dan belum ditagih. Menagih lebih dari yang diterima akan ditandai selisih saat pencocokan 3 arah.</p>
            {openDps.length > 0 && currency === 'IDR' && (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pakai uang muka</h3>
                  <Link to="/app/purchasing/down-payments" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Buka daftar uang muka</Link>
                </div>
                <p className="mt-1 text-xs text-gray-500">Pemasok ini punya uang muka yang belum terpakai. Alokasi dijalankan sesudah faktur tersimpan dan mengurangi sisa tagihan.</p>
                <div className="mt-3 space-y-2">
                  {openDps.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{d.dp_number}</span>
                        <span className="ml-2 text-xs text-gray-500">{d.po_number ? `PO ${d.po_number}` : 'tanpa PO'} · sisa {formatCurrencyAmount(d.remaining, 'IDR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <NumberInput currency className="input-field w-40 text-right" value={(dpUse[d.id] ?? '') as any} onChange={(e: any) => setDpUse((m) => ({ ...m, [d.id]: e.target.value }))} placeholder="Jumlah dipakai" />
                        <button type="button" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setDpUse((m) => ({ ...m, [d.id]: String(Math.max(0, Math.min(d.remaining, totals.total - (dpTotal - (Number(m[d.id]) || 0))))) }))}>Pakai maksimal</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <div className="w-80 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>DPP</span><span>{formatCurrencyAmount(totals.dpp, currency)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>PPN</span><span>{formatCurrencyAmount(totals.tax, currency)}</span></div>
                <div className="flex justify-between text-lg font-semibold"><span>Total Tagihan</span><span>{formatCurrencyAmount(totals.total, currency)}</span></div>
                {dpTotal > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Uang muka dipakai</span><span>- {formatCurrencyAmount(dpTotal, 'IDR')}</span></div>
                    <div className="flex justify-between font-medium"><span>Sisa setelah uang muka</span><span>{formatCurrencyAmount(Math.max(0, totals.total - dpTotal), currency)}</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link to="/app/purchasing/invoices" className="btn-secondary">Batal</Link>
          <button type="submit" disabled={saving || (!po && !grn)} className="btn-primary disabled:opacity-50">{saving ? 'Menyimpan...' : (editId ? 'Simpan Perubahan' : 'Simpan Faktur')}</button>
        </div>
      </form>
    </div>
  )
}
