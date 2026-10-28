import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { formatCurrencyAmount } from '../../utils/currencyUtils'
import { showError, showSuccess } from '../../components/ui/Toast'

const PPN_RATES: Record<string, number> = { Y: 11, A: 1.1, B: 1.2, L: 12 }

interface Line {
  po_item_id: number
  name: string
  code?: string
  uom: string
  ordered: number
  received: number
  invoiced: number
  qty: number | string
  price: number | string
  ppn_code: string
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const addDays = (iso: string, days: number) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function PurchaseInvoiceForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [poId, setPoId] = useState<number | null>(params.get('po_id') ? Number(params.get('po_id')) : null)
  const [po, setPo] = useState<any>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(todayISO())
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (!poId) { setPo(null); setLines([]); return }
    axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`)
      .then((r) => {
        const data = r.data
        setPo(data)
        if (!supplierId) setSupplierId(data.supplier_id)
        const rate = data.is_taxable ? (PPN_RATES[data.ppn_code || 'Y'] ?? 0) : 0
        const inclusive = Boolean(data.is_taxable && data.tax_inclusive && rate)
        setLines((data.items || []).map((it: any) => {
          const outstanding = Math.max(0, Number(it.quantity) - Number(it.quantity_invoiced || 0))
          const toInvoice = Math.min(outstanding, Math.max(0, Number(it.quantity_received || 0) - Number(it.quantity_invoiced || 0)))
          const price = inclusive ? Math.round((Number(it.unit_price) / (1 + rate / 100)) * 100) / 100 : Number(it.unit_price)
          return {
            po_item_id: it.id,
            name: it.material_name || it.product_name || it.description || '(tanpa nama)',
            code: it.material_code || it.product_code,
            uom: it.uom,
            ordered: Number(it.quantity),
            received: Number(it.quantity_received || 0),
            invoiced: Number(it.quantity_invoiced || 0),
            qty: toInvoice,
            price,
            ppn_code: data.is_taxable ? (data.ppn_code || 'Y') : '',
          } as Line
        }))
        const supplier = suppliers.find((s) => s.id === data.supplier_id)
        const days = supplier ? Number(supplier.payment_terms ?? 30) : 30
        setDueDate((d) => d || addDays(invoiceDate, Number.isFinite(days) ? days : 30))
      })
      .catch(() => showError('Gagal memuat PO'))
  }, [poId])

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

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!poId) return showError('Pilih PO terlebih dahulu')
    if (!supplierInvoiceNumber.trim()) return showError('No. Faktur Pemasok wajib diisi')
    const items = lines.filter((l) => Number(l.qty) > 0)
    if (items.length === 0) return showError('Isi jumlah tagihan minimal satu baris')
    const over = items.find((l) => Number(l.qty) > l.ordered - l.invoiced + 1e-9)
    if (over) return showError(`${over.name}: jumlah melebihi sisa yang belum ditagih (${over.ordered - over.invoiced})`)
    setSaving(true)
    try {
      const res = await axiosInstance.post('/api/purchasing/purchase-invoices', {
        po_id: poId,
        supplier_id: supplierId,
        supplier_invoice_number: supplierInvoiceNumber.trim(),
        supplier_invoice_date: supplierInvoiceDate || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes || null,
        items: items.map((l) => ({ po_item_id: l.po_item_id, quantity: Number(l.qty), unit_price: Number(l.price), ppn_code: l.ppn_code || '' })),
      })
      showSuccess(res.data?.message || 'Faktur pembelian dibuat')
      const id = res.data?.invoice?.id
      navigate(id ? `/app/purchasing/invoices/${id}/match` : '/app/purchasing/invoices')
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat Faktur Pembelian</h1>
          <p className="text-sm text-gray-500">Tagihan pemasok atas PO. Jurnal hutang diposting otomatis dan faktur ikut pencocokan 3 arah.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Pemasok *</label>
            <SearchableSelect
              options={suppliers.map((s) => ({ id: s.id, name: `${s.code} - ${s.company_name}` }))}
              value={supplierId}
              onChange={(v) => { setSupplierId(v ? Number(v) : null); setPoId(null) }}
              placeholder="Pilih pemasok"
              className="w-full"
            />
          </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">No. Faktur Pemasok *</label>
            <input className="input-field" value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} placeholder="Nomor di faktur dari pemasok" />
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Jatuh Tempo</label>
            <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Catatan</label>
            <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {po && (
          <div className="card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Baris Tagihan ({po.po_number}, {currency})</h2>
              {inclusiveNote && (
                <p className="text-xs text-blue-600 dark:text-blue-400">PO ini harga sudah termasuk PPN: harga satuan di bawah sudah dipisahkan dari PPN, total tetap sama dengan PO.</p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-3">Item</th>
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
                      <tr key={l.po_item_id}>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-900 dark:text-white">{l.name}</div>
                          {l.code && <div className="text-xs text-gray-400">{l.code}</div>}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.ordered.toLocaleString('id-ID')} {l.uom}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${l.received < l.ordered ? 'text-amber-600' : ''}`}>{l.received.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.invoiced.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3">
                          <NumberInput className="input-field text-right" value={l.qty as any} onChange={(e: any) => update(i, { qty: e.target.value })} />
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
            <p className="text-xs text-gray-500">Qty tagih terisi dari barang yang sudah diterima dan belum ditagih. Menagih lebih dari yang diterima akan ditandai selisih saat pencocokan 3 arah.</p>
            <div className="flex justify-end">
              <div className="w-80 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>DPP</span><span>{formatCurrencyAmount(totals.dpp, currency)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>PPN</span><span>{formatCurrencyAmount(totals.tax, currency)}</span></div>
                <div className="flex justify-between text-lg font-semibold"><span>Total Tagihan</span><span>{formatCurrencyAmount(totals.total, currency)}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link to="/app/purchasing/invoices" className="btn-secondary">Batal</Link>
          <button type="submit" disabled={saving || !po} className="btn-primary disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Faktur'}</button>
        </div>
      </form>
    </div>
  )
}
