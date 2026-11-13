import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'
import { TRANSFER_STATUS } from './StockTransferList'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

import { Skeleton } from '../../components/ui/Skeleton'
const GRN_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Menunggu QC', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  inspected: { label: 'Sudah diinspeksi', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  approved: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Ditolak', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
}
const ORIGIN: Record<string, { label: string; cls: string }> = {
  grn: { label: 'GRN', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  transfer: { label: 'Pemindahan', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
}

const statusLabel = (r: any) => ((r.origin === 'grn' ? GRN_STATUS : TRANSFER_STATUS)[r.status] || { label: r.status }).label
const COLUMNS: ListColumn<any>[] = [
  { key: 'origin', label: 'Asal', value: (r) => r.origin, exportValue: (r) => ORIGIN[r.origin]?.label || r.origin },
  { key: 'number', label: 'Nomor', value: (r) => r.number },
  { key: 'date', label: 'Tanggal', value: (r) => r.date, type: 'date' },
  { key: 'from_label', label: 'Dari', value: (r) => r.from_label },
  { key: 'to_label', label: 'Ke Gudang', value: (r) => r.to_label },
  { key: 'source_number', label: 'Referensi', value: (r) => r.source_number },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: statusLabel },
]

export default function ReceiptsList() {
  const [rows, setRows] = useState<any[]>([])
  const [origin, setOrigin] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      axiosInstance.get('/api/stock-transfers/receipts', { params: { origin: origin || undefined } })
        .then((r) => alive && setRows(r.data.receipts || []))
        .catch(() => showError('Daftar penerimaan gagal dimuat'))
        .finally(() => alive && setLoading(false))
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [origin])

  const tools = useListTools<any>(rows, COLUMNS, { filename: 'Penerimaan_Barang', initialSort: { key: 'date', dir: 'desc' } })
  const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')
  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Penerimaan Barang" subtitle="Barang masuk gudang, dari GRN pemasok atau dari pemindahan antar gudang"
        actions={<Link to="/app/purchasing/grn/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">GRN baru</Link>} />
      <ListToolbar tools={tools} placeholder="Cari nomor, PO, atau pemasok" extra={
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
          <option value="">Semua asal</option><option value="grn">Asal GRN</option><option value="transfer">Asal Pemindahan</option>
        </select>} />
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900"><tr>
            <SortTh tools={tools} col="origin" className={th}>Asal</SortTh><SortTh tools={tools} col="number" className={th}>Nomor</SortTh><SortTh tools={tools} col="date" className={th}>Tanggal</SortTh><SortTh tools={tools} col="from_label" className={th}>Dari</SortTh><SortTh tools={tools} col="to_label" className={th}>Ke gudang</SortTh><SortTh tools={tools} col="source_number" className={th}>Referensi</SortTh><SortTh tools={tools} col="status" className={th}>Status</SortTh><th className={th}>Aksi</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && Array.from({ length: 6 }).map((_, i) => <tr key={`sk${i}`}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>)}
            {!loading && tools.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{tools.total === 0 ? 'Belum ada penerimaan.' : 'Tidak ada penerimaan yang cocok.'}</td></tr>}
            {tools.rows.map((r) => {
              const og = ORIGIN[r.origin]
              const st = (r.origin === 'grn' ? GRN_STATUS : TRANSFER_STATUS)[r.status] || { label: r.status, cls: '' }
              const pending = r.origin === 'transfer' && (r.status === 'shipped' || r.status === 'partial')
              return (
                <tr key={`${r.origin}${r.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${og.cls}`}>{og.label}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium"><Link to={r.href} className="text-emerald-700 hover:underline dark:text-emerald-400">{r.number}</Link></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{r.from_label || '-'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{r.to_label || '-'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{r.source_number || '-'}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5">{pending && <Link to={r.href} className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800">Ambil</Link>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
