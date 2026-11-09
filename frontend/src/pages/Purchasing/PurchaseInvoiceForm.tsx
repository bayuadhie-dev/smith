import { enterMovesDown } from '../../utils/enterNavigation'
import { PendingAttachments, uploadAttachments } from '../../components/AttachmentsPanel'
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
  po_item_id: number | null
  extra?: boolean
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
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [poId, setPoId] = useState<number | null>(params.get('po_id') ? Number(params.get('po_id')) : null)
  const [po, setPo] = useState<any>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<{ id: number; code: string; name: string }[]>([])
  useEffect(() => {
    axiosInstance.get('/api/finance/chart-of-accounts').then((r) => setExpenseAccounts((r.data.accounts || []).filter((a: any) => a.type === 'expense' && !a.is_header && a.is_active !== false).map((a: any) => ({ id: a.id, code: a.code, name: a.name })))).catch(() => {})
  }, [])
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(todayISO())
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [openDps, setOpenDps] = useState<OpenDP[]>([])
  const [dpUse, setDpUse] = useState<Record<number, string>>({})

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
          const toInvoice = it.is_non_inventory ? outstanding : Math.min(outstanding, Math.max(0, Number(it.quantity_received || 0) - Number(it.quantity_invoiced || 0)))
          const price = inclusive ? Math.round((Number(it.unit_price) / (1 + rate / 100)) * 100) / 100 : Number(it.unit_price)
          return {
            po_item_id: it.id,
            name: it.material_name || it.product_name || it.description || '(tanpa nama)',
            description: (it.description || '').trim() || it.material_name || it.product_name || '',
            code: it.material_code || it.product_code,
            uom: it.uom,
            ordered: Number(it.quantity),
            received: it.is_non_inventory ? Number(it.quantity_invoiced || 0) : Number(it.quantity_received || 0),
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

  useEffect(() => {
    setDpUse({})
    if (!supplierId) { setOpenDps([]); return }
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
    if (!poId) return showError('Pilih PO terlebih dahulu')
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
        items: items.map((l) => ({ po_item_id: l.extra ? undefined : l.po_item_id, account_id: l.extra && l.account_id ? Number(l.account_id) : undefined, quantity: Number(l.qty), unit_price: Number(l.price), ppn_code: l.ppn_code || '', description: (l.description || '').trim() || undefined })),
      })
      showSuccess(res.data?.message || 'Faktur pembelian dibuat')
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
                      <tr key={l.extra ? `x${i}` : l.po_item_id}>
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
                        <td className="py-2 pr-3 text-right tabular-nums">{l.extra ? '-' : `${l.ordered.toLocaleString('id-ID')} ${l.uom}`}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${!l.extra && l.received < l.ordered ? 'text-amber-600' : ''}`}>{l.extra ? '-' : l.received.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.extra ? '-' : l.invoiced.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3">
                          <NumberInput className="input-field text-right" value={l.qty as any} onChange={(e: any) => update(i, { qty: e.target.value })} />
                          {!l.extra && Number(l.qty) > l.ordered - l.invoiced + 1e-9 && (
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
          <button type="submit" disabled={saving || !po} className="btn-primary disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Faktur'}</button>
        </div>
      </form>
    </div>
  )
}
