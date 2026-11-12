import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'

interface Row { id: number; transfer_number: string; source_type: string; source_number: string | null; from_label: string | null; to_label: string | null; status: string; created_at: string; line_count: number; receipt_count: number }

export const TRANSFER_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  shipped: { label: 'Dikirim, menunggu diterima', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  partial: { label: 'Diterima sebagian', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  received: { label: 'Diterima', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
}
const SOURCE: Record<string, string> = { material_issue: 'Permintaan Barang', grn: 'Penerimaan Barang', packing_list: 'Packing List', manual: 'Manual' }

export default function StockTransferList({ receiveMode = false }: { receiveMode?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      axiosInstance.get('/api/stock-transfers', { params: { per_page: 100, search: search || undefined, status: receiveMode ? undefined : (status || undefined), pending_receipt: receiveMode ? 1 : undefined } })
        .then((r) => alive && setRows(r.data.transfers || []))
        .catch(() => showError('Daftar pemindahan gagal dimuat'))
        .finally(() => alive && setLoading(false))
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [search, status, receiveMode])

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={receiveMode ? 'Penerimaan Barang' : 'Pemindahan Barang'}
        subtitle={receiveMode ? 'Pemindahan yang sudah dikirim dan menunggu diterima di gudang tujuan' : 'Pindah barang antar gudang, dari Permintaan Barang atau Penerimaan Barang'}
        actions={!receiveMode ? <Link to="/app/warehouse/transfers/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Pemindahan baru</Link> : undefined}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor pemindahan atau sumber" className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {!receiveMode && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">Semua status</option>
            {Object.entries(TRANSFER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900"><tr>
            <th className={th}>Nomor</th><th className={th}>Tanggal</th><th className={th}>Sumber</th><th className={th}>Dari</th><th className={th}>Ke</th><th className={`${th} text-right`}>Barang</th><th className={th}>Status</th>{receiveMode && <th className={th}></th>}
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">{receiveMode ? 'Tidak ada pemindahan yang menunggu diterima.' : 'Belum ada pemindahan barang.'}</td></tr>}
            {rows.map((r) => {
              const st = TRANSFER_STATUS[r.status] || { label: r.status, cls: '' }
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium"><Link to={`/app/warehouse/transfers/${r.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{r.transfer_number}</Link></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{SOURCE[r.source_type] || r.source_type}{r.source_number ? ` ${r.source_number}` : ''}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{r.from_label}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{r.to_label}</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums">{r.line_count}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  {receiveMode && <td className="px-4 py-2.5"><Link to={`/app/warehouse/transfers/${r.id}`} className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800">Ambil</Link></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
