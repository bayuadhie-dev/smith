import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { PageHeader, KpiStrip } from '../ui/PageKit'
import { showError } from '../ui'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../ui/ListTools'

export interface OpenInvoicesConfig {
  kind: 'receivable' | 'payable'
  title: string
  subtitle: string
  endpoint: string
  listKey: 'receivables' | 'payables'
  partyKey: 'customer_name' | 'supplier_name'
  partyLabel: string
  totalLabel: string
  payLabel: string
  payPath: string
  newInvoicePath: string
  newInvoiceLabel: string
  invoicePath: (id: number) => string
}

interface Row {
  id: number
  invoice_number: string
  invoice_date: string
  due_date: string | null
  total_amount: number
  paid_amount: number
  balance_due: number
  days_overdue: number
  status: string
  [k: string]: any
}

interface Summary {
  open_count: number; open_amount: number
  overdue_count: number; overdue_amount: number
  due_week_count: number; due_week_amount: number
  paid_percent: number | null
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

const Badge = ({ row }: { row: Row }) => {
  if (row.days_overdue > 0)
    return <span className="inline-flex rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Lewat {row.days_overdue} hari</span>
  if (row.paid_amount > 0)
    return <span className="inline-flex rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Dibayar sebagian</span>
  return <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">Belum dibayar</span>
}

const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'

const OpenInvoicesPage = ({ cfg }: { cfg: OpenInvoicesConfig }) => {
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    axiosInstance
      .get(cfg.endpoint, { params: { page: 1, per_page: 1000, status: status || undefined } })
      .then((r) => {
        if (!alive) return
        setRows(r.data[cfg.listKey] || [])
        setSummary(r.data.summary || null)
      })
      .catch(() => { if (alive) { setRows([]); showError('Data gagal dimuat.') } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [cfg.endpoint, cfg.listKey, status])

  const columns = useMemo<ListColumn<Row>[]>(() => [
    { key: 'invoice_number', label: 'Nomor faktur', value: (r) => r.invoice_number },
    { key: 'party', label: cfg.partyLabel, value: (r) => r[cfg.partyKey] },
    { key: 'invoice_date', label: 'Tanggal faktur', value: (r) => r.invoice_date, type: 'date' },
    { key: 'due_date', label: 'Jatuh tempo', value: (r) => r.due_date, type: 'date' },
    { key: 'total_amount', label: 'Total (Rp)', value: (r) => r.total_amount, type: 'number' },
    { key: 'paid_amount', label: 'Terbayar (Rp)', value: (r) => r.paid_amount, type: 'number' },
    { key: 'balance_due', label: 'Sisa (Rp)', value: (r) => r.balance_due, type: 'number' },
    { key: 'days_overdue', label: 'Lewat (hari)', value: (r) => r.days_overdue, type: 'number' },
  ], [cfg.partyLabel, cfg.partyKey])
  const tools = useListTools<Row>(rows, columns, { filename: cfg.kind === 'receivable' ? 'Piutang_Usaha' : 'Utang_Usaha', initialSort: { key: 'due_date', dir: 'asc' } })

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <>
            <Link to={cfg.newInvoicePath} className="btn-primary">{cfg.newInvoiceLabel}</Link>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: cfg.totalLabel, value: formatRupiah(summary?.open_amount || 0), hint: `${summary?.open_count || 0} faktur belum lunas` },
          { label: 'Lewat jatuh tempo', value: formatRupiah(summary?.overdue_amount || 0), tone: summary?.overdue_count ? 'bad' : null, hint: `${summary?.overdue_count || 0} faktur` },
          { label: 'Jatuh tempo 7 hari ke depan', value: formatRupiah(summary?.due_week_amount || 0), tone: summary?.due_week_count ? 'warn' : null, hint: `${summary?.due_week_count || 0} faktur` },
          { label: 'Persentase terbayar', value: summary?.paid_percent == null ? '-' : `${summary.paid_percent.toLocaleString('id-ID')}%`, hint: 'dari seluruh faktur sah' },
        ]}
      />

      <ListToolbar
        tools={tools}
        placeholder={`Cari nomor faktur atau ${cfg.partyLabel.toLowerCase()}`}
        extra={(
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua status</option>
          <option value="outstanding">Belum dibayar</option>
          <option value="partial">Dibayar sebagian</option>
          <option value="overdue">Lewat jatuh tempo</option>
        </select>
        )}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortTh tools={tools} col="invoice_number" className={th}>Nomor faktur</SortTh>
              <SortTh tools={tools} col="party" className={th}>{cfg.partyLabel}</SortTh>
              <SortTh tools={tools} col="invoice_date" className={th}>Tanggal</SortTh>
              <SortTh tools={tools} col="due_date" className={th}>Jatuh tempo</SortTh>
              <SortTh tools={tools} col="total_amount" align="right" className={`${th} text-right`}>Total</SortTh>
              <SortTh tools={tools} col="balance_due" align="right" className={`${th} text-right`}>Sisa</SortTh>
              <SortTh tools={tools} col="days_overdue" className={th}>Status</SortTh>
              <th className={`${th} text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td></tr>
            )}
            {!loading && tools.rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{tools.query || status ? 'Tidak ada faktur yang cocok.' : 'Tidak ada faktur yang belum lunas.'}</td></tr>
            )}
            {tools.rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                  <Link to={cfg.invoicePath(r.id)} className="text-primary-700 hover:underline dark:text-primary-300">{r.invoice_number}</Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{r[cfg.partyKey]}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.invoice_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.due_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">{formatRupiah(r.total_amount)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-white">{formatRupiah(r.balance_due)}</td>
                <td className="whitespace-nowrap px-4 py-2.5"><Badge row={r} /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                  <Link to={`${cfg.payPath}?invoice_id=${r.id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">{cfg.payLabel}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

export default OpenInvoicesPage
