import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { PageHeader, KpiStrip } from '../ui/PageKit'
import { showError } from '../ui'

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
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let alive = true
    setLoading(true)
    axiosInstance
      .get(cfg.endpoint, { params: { page, per_page: 20, search: debounced || undefined, status: status || undefined } })
      .then((r) => {
        if (!alive) return
        setRows(r.data[cfg.listKey] || [])
        setPages(r.data.pages || 1)
        setSummary(r.data.summary || null)
      })
      .catch(() => { if (alive) { setRows([]); showError('Data gagal dimuat.') } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [cfg.endpoint, cfg.listKey, page, debounced, status])

  const exportCsv = () => {
    if (!rows.length) return
    const head = ['Nomor faktur', cfg.partyLabel, 'Tanggal faktur', 'Jatuh tempo', 'Total', 'Terbayar', 'Sisa', 'Lewat (hari)']
    const lines = rows.map((r) => [r.invoice_number, r[cfg.partyKey], r.invoice_date, r.due_date || '', r.total_amount, r.paid_amount, r.balance_due, r.days_overdue])
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `${cfg.kind === 'receivable' ? 'piutang' : 'utang'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
              <Download className="h-4 w-4" /> Ekspor CSV
            </button>
            <Link to={cfg.newInvoicePath} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">{cfg.newInvoiceLabel}</Link>
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari nomor faktur atau ${cfg.partyLabel.toLowerCase()}`}
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua status</option>
          <option value="outstanding">Belum dibayar</option>
          <option value="partial">Dibayar sebagian</option>
          <option value="overdue">Lewat jatuh tempo</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className={th}>Nomor faktur</th>
              <th className={th}>{cfg.partyLabel}</th>
              <th className={th}>Tanggal</th>
              <th className={th}>Jatuh tempo</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>Sisa</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">{search || status ? 'Tidak ada faktur yang cocok.' : 'Tidak ada faktur yang belum lunas.'}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                  <Link to={cfg.invoicePath(r.id)} className="text-emerald-700 hover:underline dark:text-emerald-400">{r.invoice_number}</Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{r[cfg.partyKey]}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.invoice_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.due_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">{formatRupiah(r.total_amount)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-white">{formatRupiah(r.balance_due)}</td>
                <td className="whitespace-nowrap px-4 py-2.5"><Badge row={r} /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                  <Link to={`${cfg.payPath}?invoice_id=${r.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">{cfg.payLabel}</Link>
                </td>
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

export default OpenInvoicesPage
