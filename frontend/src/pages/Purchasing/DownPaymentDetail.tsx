import AttachmentsPanel from '../../components/AttachmentsPanel'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import NumberInput from '../../components/ui/NumberInput'
import SearchableSelect from '../../components/SearchableSelect'
import { PageHeader, Panel, KpiStrip } from '../../components/ui/PageKit'
import { confirmDialog, showError, showSuccess } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

export default function DownPaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canCreate = isSuperAdmin || hasPermission('purchasing.create')
  const canApprove = isSuperAdmin || hasPermission('purchasing.approve')
  const [dp, setDp] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await axiosInstance.get(`/api/purchasing/down-payments/${id}`)
      setDp(r.data)
      if (r.data.status === 'posted' && r.data.remaining > 0) {
        const inv = await axiosInstance.get('/api/purchasing/invoices', { params: { supplier_id: r.data.supplier_id, per_page: 200 } })
        const list = (inv.data.invoices || inv.data.purchase_invoices || []).filter((x: any) => Number(x.balance_due) > 0 && !['draft', 'cancelled'].includes(x.status))
        setInvoices(list)
      } else setInvoices([])
    } catch { showError('Uang muka gagal dimuat') }
  }, [id])
  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { await fn(); showSuccess(ok); await load() } catch (e: any) { showError(e.response?.data?.error || 'Proses gagal') } finally { setBusy(false) }
  }
  const chosen = invoices.find((i) => i.id === invoiceId)
  const maxAmt = chosen ? Math.min(Number(chosen.balance_due), dp?.remaining || 0) : 0

  if (!dp) return <div className="p-6 text-sm text-gray-500">Memuat...</div>
  const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  return (
    <div className="space-y-4 p-6">
      <PageHeader title={dp.dp_number} subtitle={`${dp.supplier_name}${dp.po_number ? ' · PO ' + dp.po_number : ''} · ${fmtDate(dp.dp_date)}`}
        actions={<>
          <Link to="/app/purchasing/down-payments" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Kembali</Link>
          {canApprove && dp.status === 'posted' && (
            <button disabled={busy} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={async () => { if (await confirmDialog('Batalkan uang muka ini? Jurnal pembalik akan dibuat. Tidak bisa dibatalkan bila sudah dialokasikan ke faktur.')) act(() => axiosInstance.post(`/api/purchasing/down-payments/${id}/cancel`), 'Uang muka dibatalkan.') }}>Batalkan</button>
          )}
        </>} />
      <KpiStrip items={[
        { label: 'Jumlah', value: formatRupiah(dp.amount) },
        { label: 'Sudah dialokasikan', value: formatRupiah(dp.allocated_amount) },
        { label: 'Sisa', value: formatRupiah(dp.remaining), tone: dp.remaining > 0 && dp.status === 'posted' ? 'warn' : null },
        { label: 'Status', value: dp.status === 'posted' ? 'Diposting' : dp.status === 'cancelled' ? 'Dibatalkan' : 'Draft' },
      ]} />

      {canCreate && dp.status === 'posted' && dp.remaining > 0 && (
        <Panel title="Alokasikan ke faktur pembelian">
          <div className="grid items-end gap-3 p-4 md:grid-cols-[1fr_14rem_auto]">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Faktur terbuka pemasok ini</label>
              <SearchableSelect options={invoices.map((i) => ({ id: i.id, name: `${i.invoice_number} · sisa ${formatRupiah(Number(i.balance_due))}` }))} value={invoiceId}
                onChange={(v) => { const n = v ? Number(v) : null; setInvoiceId(n); const c = invoices.find((i) => i.id === n); setAmount(c ? String(Math.min(Number(c.balance_due), dp.remaining)) : '') }} placeholder={invoices.length ? 'Pilih faktur' : 'Tidak ada faktur terbuka'} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Jumlah</label>
              <NumberInput currency className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <button disabled={busy || !invoiceId || !(Number(amount) > 0) || Number(amount) > maxAmt + 0.01} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              onClick={() => act(() => axiosInstance.post(`/api/purchasing/down-payments/${id}/allocate`, { invoice_id: invoiceId, amount: Number(amount) }).then(() => { setInvoiceId(null); setAmount('') }), 'Uang muka dialokasikan.')}>Alokasikan</button>
          </div>
          {chosen && <p className="px-4 pb-3 text-xs text-gray-500">Maksimal {formatRupiah(maxAmt)} (yang lebih kecil antara sisa uang muka dan saldo faktur).</p>}
        </Panel>
      )}

      <Panel title="Alokasi ke faktur">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900"><tr><th className={th}>Faktur</th><th className={th}>Tanggal</th><th className={`${th} text-right`}>Jumlah</th><th className={th}>Status</th><th className={`${th} text-right`}>Aksi</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dp.allocations.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Belum dialokasikan.</td></tr>}
              {dp.allocations.map((a: any) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 text-sm"><Link to={`/app/purchasing/invoices/${a.invoice_id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{a.invoice_number}</Link></td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(a.allocated_at)}</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums">{formatRupiah(a.amount)}</td>
                  <td className="px-4 py-2.5 text-sm">{a.status === 'active' ? 'Aktif' : 'Dibatalkan'}</td>
                  <td className="px-4 py-2.5 text-right text-sm">{canApprove && a.status === 'active' && <button disabled={busy} className="text-red-600 hover:underline disabled:opacity-50" onClick={async () => { if (await confirmDialog('Batalkan alokasi ini? Saldo faktur kembali seperti semula.')) act(() => axiosInstance.post(`/api/purchasing/down-payments/allocations/${a.id}/reverse`), 'Alokasi dibatalkan.') }}>Batalkan alokasi</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Jurnal">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900"><tr><th className={th}>No. jurnal</th><th className={th}>Tanggal</th><th className={th}>Akun</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Kredit</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(dp.journal || []).map((j: any, i: number) => (
                <tr key={i}><td className="px-4 py-2 text-sm">{j.entry_number}</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{fmtDate(j.date)}</td><td className="px-4 py-2 text-sm">{j.account}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums">{j.debit ? formatRupiah(j.debit) : ''}</td><td className="px-4 py-2 text-right text-sm tabular-nums">{j.credit ? formatRupiah(j.credit) : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {dp.notes && <p className="text-sm text-gray-600 dark:text-gray-300">Catatan: {dp.notes}</p>}
      <AttachmentsPanel entityType="purchase_down_payment" entityId={id} />
    </div>
  )
}
