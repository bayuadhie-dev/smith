import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

import { Skeleton } from '../../components/ui/Skeleton'
interface Row { id: number; dp_number: string; po_number: string | null; supplier_name: string | null; dp_date: string; amount: number; allocated_amount: number; remaining: number; status: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  posted: { label: 'Diposting', cls: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

const COLUMNS: ListColumn<Row>[] = [
  { key: 'dp_number', label: 'Nomor', value: (r) => r.dp_number },
  { key: 'dp_date', label: 'Tanggal', value: (r) => r.dp_date, type: 'date' },
  { key: 'supplier_name', label: 'Pemasok', value: (r) => r.supplier_name },
  { key: 'po_number', label: 'No. PO', value: (r) => r.po_number },
  { key: 'amount', label: 'Jumlah (Rp)', value: (r) => r.amount, type: 'number' },
  { key: 'allocated_amount', label: 'Terpakai (Rp)', value: (r) => r.allocated_amount, type: 'number' },
  { key: 'remaining', label: 'Sisa (Rp)', value: (r) => r.remaining, type: 'number' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS[r.status]?.label || r.status },
]

export default function DownPaymentList() {
  const [params] = useSearchParams()
  const poId = params.get('po_id')
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState({ count: 0, paid: 0, allocated: 0, remaining: 0 })
  const [status, setStatus] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const tools = useListTools<Row>(rows, COLUMNS, { filename: 'Uang_Muka_Pembelian', initialSort: { key: 'dp_date', dir: 'desc' } })

  useEffect(() => {
    let alive = true
    setLoading(true)
    axiosInstance.get('/api/purchasing/down-payments', { params: { page: 1, per_page: 1000, status: status || undefined, po_id: poId || undefined, open: onlyOpen ? 1 : undefined } })
      .then((r) => { if (!alive) return; setRows(r.data.down_payments || []); setSummary(r.data.summary || { count: 0, paid: 0, allocated: 0, remaining: 0 }) })
      .catch(() => showError('Daftar uang muka gagal dimuat'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [status, onlyOpen, poId])

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Uang Muka Pembelian" subtitle="Pembayaran di muka ke pemasok, dialokasikan ke faktur pembelian"
        actions={<Link to="/app/purchasing/down-payments/new" className="rounded-md bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800">Uang muka baru</Link>} />
      <KpiStrip items={[
        { label: 'Jumlah dokumen aktif', value: summary.count.toLocaleString('id-ID') },
        { label: 'Total dibayar', value: formatRupiah(summary.paid) },
        { label: 'Sudah dialokasikan', value: formatRupiah(summary.allocated) },
        { label: 'Sisa belum dialokasikan', value: formatRupiah(summary.remaining), tone: summary.remaining > 0 ? 'warn' : null },
      ]} />
      <ListToolbar tools={tools} placeholder="Cari nomor, pemasok, atau PO" extra={(
        <>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" aria-label="Status">
            <option value="">Semua status</option><option value="posted">Diposting</option><option value="cancelled">Dibatalkan</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />Hanya yang masih ada sisa</label>
        </>
      )} />
      {poId && <p className="text-sm text-gray-500 dark:text-gray-400">Disaring untuk satu PO. <Link to="/app/purchasing/down-payments" className="text-primary-700 hover:underline dark:text-primary-300">Tampilkan semua</Link></p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900"><tr>
            <SortTh tools={tools} col="dp_number" className={th}>Nomor</SortTh>
            <SortTh tools={tools} col="dp_date" className={th}>Tanggal</SortTh>
            <SortTh tools={tools} col="supplier_name" className={th}>Pemasok</SortTh>
            <SortTh tools={tools} col="po_number" className={th}>No. PO</SortTh>
            <SortTh tools={tools} col="amount" align="right" className={`${th} text-right`}>Jumlah</SortTh>
            <SortTh tools={tools} col="allocated_amount" align="right" className={`${th} text-right`}>Terpakai</SortTh>
            <SortTh tools={tools} col="remaining" align="right" className={`${th} text-right`}>Sisa</SortTh>
            <SortTh tools={tools} col="status" className={th}>Status</SortTh>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && Array.from({ length: 6 }).map((_, i) => <tr key={`sk${i}`}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>)}
            {!loading && tools.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{tools.total === 0 ? 'Belum ada uang muka.' : 'Tidak ada uang muka yang cocok.'}</td></tr>}
            {tools.rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium"><Link to={`/app/purchasing/down-payments/${r.id}`} className="text-primary-700 hover:underline dark:text-primary-300">{r.dp_number}</Link></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.dp_date)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{r.supplier_name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{r.po_number || '-'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{formatRupiah(r.amount)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{formatRupiah(r.allocated_amount)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums">{formatRupiah(r.remaining)}</td>
                <td className="whitespace-nowrap px-4 py-2.5"><span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${(STATUS[r.status] || STATUS.draft).cls}`}>{(STATUS[r.status] || { label: r.status }).label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
