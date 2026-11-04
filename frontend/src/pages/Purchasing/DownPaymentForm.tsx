import { PendingAttachments, uploadAttachments } from '../../components/AttachmentsPanel'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import NumberInput from '../../components/ui/NumberInput'
import SearchableSelect from '../../components/SearchableSelect'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError, showSuccess } from '../../components/ui'

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'

export default function DownPaymentForm() {
  const navigate = useNavigate()
  const [attFiles, setAttFiles] = useState<File[]>([])
  const [params] = useSearchParams()
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [poId, setPoId] = useState<number | null>(params.get('po_id') ? Number(params.get('po_id')) : null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [bankId, setBankId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [poInfo, setPoInfo] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axiosInstance.get('/api/purchasing/suppliers', { params: { per_page: 1000 } }).then((r) => setSuppliers(r.data.suppliers || [])).catch(() => showError('Daftar pemasok gagal dimuat'))
    axiosInstance.get('/api/finance/chart-of-accounts').then((r) => setBanks((r.data.accounts || []).filter((a: any) => a.is_cash_bank && !a.is_header))).catch(() => showError('Daftar akun kas/bank gagal dimuat'))
  }, [])

  useEffect(() => {
    if (!poId) { setPoInfo(null); return }
    axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`).then((r) => { setPoInfo(r.data); setSupplierId(r.data.supplier_id ?? r.data.supplier?.id ?? null) }).catch(() => showError('PO gagal dimuat'))
  }, [poId])

  useEffect(() => {
    if (!supplierId) { setOrders([]); return }
    axiosInstance.get('/api/purchasing/purchase-orders', { params: { supplier_id: supplierId, status: 'approved,partial,sent,confirmed', per_page: 200 } })
      .then((r) => setOrders(r.data.purchase_orders || [])).catch(() => setOrders([]))
  }, [supplierId])

  const canSave = !!supplierId && !!bankId && Number(amount) > 0 && !!date
  const reason = !supplierId ? 'Pilih pemasok atau PO dulu.' : !bankId ? 'Pilih akun kas/bank sumber pembayaran.' : !(Number(amount) > 0) ? 'Isi jumlah uang muka.' : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const r = await axiosInstance.post('/api/purchasing/down-payments', { po_id: poId || undefined, supplier_id: supplierId, bank_account_id: bankId, amount: Number(amount), dp_date: date, payment_method: method, reference_number: reference || undefined, notes: notes || undefined })
      showSuccess(`Uang muka ${r.data.dp_number} dicatat.`)
      await uploadAttachments('purchase_down_payment', r.data.id, attFiles)
      navigate(`/app/purchasing/down-payments/${r.data.id}`)
    } catch (err: any) {
      const m = err.response?.data?.error || 'Uang muka gagal disimpan'
      setError(m); showError(m)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Uang Muka Pembelian Baru" subtitle="Bayar di muka ke pemasok. Setelah faktur terbit, uang muka dialokasikan ke faktur."
        actions={<Link to="/app/purchasing/down-payments" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Batal</Link>} />
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <form onSubmit={submit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
<div className="lg:col-span-full"><PendingAttachments files={attFiles} onChange={setAttFiles} /></div>
        <div className="space-y-4">
          <Panel title="Pemasok dan PO">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Pemasok</label>
                <SearchableSelect options={suppliers.map((s) => ({ id: s.id, name: s.company_name || s.name }))} value={supplierId} onChange={(v) => { setSupplierId(v ? Number(v) : null); setPoId(null) }} placeholder="Pilih pemasok" />
              </div>
              <div>
                <label className={labelCls}>PO (opsional)</label>
                <SearchableSelect options={orders.map((o) => ({ id: o.id, name: `${o.po_number}${o.total_amount ? ' · ' + formatRupiah(Number(o.total_amount)) : ''}` }))} value={poId} onChange={(v) => setPoId(v ? Number(v) : null)} placeholder={supplierId ? 'Pilih PO pemasok ini' : 'Pilih pemasok dulu'} />
              </div>
              {poInfo && <p className="text-xs text-gray-500 md:col-span-2">Total PO {formatRupiah(Number(poInfo.total_amount || 0))}. Mata uang {poInfo.currency || 'IDR'}.</p>}
            </div>
          </Panel>
          <Panel title="Pembayaran">
            <div className="grid gap-4 p-4 md:grid-cols-3">
              <div><label className={labelCls}>Tanggal</label><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div><label className={labelCls}>Jumlah (Rp)</label><NumberInput currency className={`${inputCls} text-right`} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><label className={labelCls}>Metode</label>
                <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}><option value="bank_transfer">Transfer bank</option><option value="cash">Tunai</option><option value="check">Cek / giro</option></select></div>
              <div className="md:col-span-2"><label className={labelCls}>Akun kas/bank sumber</label>
                <SearchableSelect options={banks.map((b) => ({ id: b.id, code: b.code ?? b.account_code, name: b.name ?? b.account_name }))} value={bankId} onChange={(v) => setBankId(v ? Number(v) : null)} placeholder="Pilih akun" /></div>
              <div><label className={labelCls}>No. referensi</label><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. transfer atau cek" /></div>
            </div>
          </Panel>
          <Panel title="Keterangan"><div className="p-4"><textarea rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" /></div></Panel>
        </div>
        <aside className="lg:sticky lg:top-4">
          <Panel title="Ringkasan">
            <dl className="space-y-3 p-4 text-sm">
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Uang muka dibayar</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatRupiah(Number(amount) || 0)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Jurnal</dt><dd className="text-right text-xs">Debit Uang Muka Pembelian, Kredit Kas/Bank</dd></div>
            </dl>
            <div className="space-y-2 border-t border-gray-200 p-4 dark:border-gray-700">
              {reason && <p className="text-sm text-amber-700 dark:text-amber-400">{reason}</p>}
              <button type="submit" disabled={saving || !canSave} className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan dan posting'}</button>
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  )
}
