import SortableTh, { useSort } from '../../components/SortableTh'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'

interface Row { id: number; dp_number: string; po_number: string | null; supplier_name: string | null; dp_date: string; amount: number; allocated_amount: number; remaining: number; status: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  posted: { label: 'Diposting', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

export default function DownPaymentList() {
  const [params] = useSearchParams()
  const poId = params.get('po_id')
  const [rows, setRows] = useState<Row[]>([])
  const acc = useMemo(() => ({ dp_number: (r: any) => r.dp_number, dp_date: (r: any) => r.dp_date, supplier_name: (r: any) => r.supplier_name, po_number: (r: any) => r.po_number, amount: (r: any) => Number(r.amount), allocated_amount: (r: any) => Number(r.allocated_amount), remaining: (r: any) => Number(r.remaining), status: (r: any) => r.status }), [])
  const { sorted: sortedRows, sort, toggle } = useSort(rows, acc)
  const [summary, setSummary] = useState({ count: 0, paid: 0, allocated: 0, remaining: 0 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      axiosInstance.get('/api/purchasing/down-payments', { params: { page, per_page: 25, search: search || undefined, status: status || undefined, po_id: poId || undefined, open: onlyOpen ? 1 : undefined } })
        .then((r) => { if (!alive) return; setRows(r.data.down_payments || []); setPages(r.data.pages || 1); setSummary(r.data.summary || summary) })
        .catch(() => showError('Daftar uang muka gagal dimuat'))
        .finally(() => alive && setLoading(false))
    }, 250)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, onlyOpen, poId])

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Uang Muka Pembelian" subtitle="Pembayaran di muka ke pemasok, dialokasikan ke faktur pembelian"
        actions={<Link to="/app/purchasing/down-payments/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Uang muka baru</Link>} />
      <KpiStrip items={[
        { label: 'Jumlah dokumen aktif', value: summary.count.toLocaleString('id-ID') },
        { label: 'Total dibayar', value: formatRupiah(summary.paid) },
        { label: 'Sudah dialokasikan', value: formatRupiah(summary.allocated) },
        { label: 'Sisa belum dialokasikan', value: formatRupiah(summary.remaining), tone: summary.remaining > 0 ? 'warn' : null },
      ]} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Cari nomor atau pemasok" className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
          <option value="">Semua status</option><option value="posted">Diposting</option><option value="cancelled">Dibatalkan</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={onlyOpen} onChange={(e) => { setOnlyOpen(e.target.checked); setPage(1) }} /> Hanya yang masih bersisa</label>
      </div>
      {poId && <p className="text-sm text-gray-500 dark:text-gray-400">Disaring untuk satu PO. <Link to="/app/purchasing/down-payments" className="text-emerald-700 hover:underline dark:text-emerald-300">Tampilkan semua</Link></p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900"><tr>
            <SortableTh label="Nomor" k="dp_number" sort={sort} toggle={toggle} className={th} /><SortableTh label="Tanggal" k="dp_date" sort={sort} toggle={toggle} className={th} /><SortableTh label="Pemasok" k="supplier_name" sort={sort} toggle={toggle} className={th} /><SortableTh label="PO" k="po_number" sort={sort} toggle={toggle} className={th} />
            <SortableTh label="Jumlah" k="amount" sort={sort} toggle={toggle} className={`${th} text-right`} /><SortableTh label="Terpakai" k="allocated_amount" sort={sort} toggle={toggle} className={`${th} text-right`} /><SortableTh label="Sisa" k="remaining" sort={sort} toggle={toggle} className={`${th} text-right`} /><SortableTh label="Status" k="status" sort={sort} toggle={toggle} className={th} />
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada uang muka.</td></tr>}
            {sortedRows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium"><Link to={`/app/purchasing/down-payments/${r.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{r.dp_number}</Link></td>
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
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>Halaman {page} dari {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Sebelumnya</button>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Berikutnya</button>
          </div>
        </div>
      )}
    </div>
  )
}
