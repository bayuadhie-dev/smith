import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon, ArrowLeftIcon, PrinterIcon, ArrowPathIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import axiosInstance from '../../../utils/axiosConfig'
import { showError } from '../../../components/ui'

// ---------------------------------------------------------------- formatting
const nf0 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf = { format: (v: number) => (Math.abs(v - Math.round(v)) < 0.005 ? nf0.format(Math.round(v)) : nf2.format(v)) }
export const num = (v: number | null | undefined) => (v === null || v === undefined || isNaN(v) ? '0' : nf.format(v))
export const idr = (v: number | null | undefined) => `${(v ?? 0) < 0 ? '-' : ''}Rp ${nf.format(Math.abs(v ?? 0))}`
export const fmtDate = (iso?: string | null) => {
  if (!iso) return '-'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'Hari ini', range: () => { const t = new Date(); return [iso(t), iso(t)] } },
  { label: 'Bulan ini', range: () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(new Date(t.getFullYear(), t.getMonth() + 1, 0))] } },
  { label: 'Bulan lalu', range: () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))] } },
  { label: 'Tahun ini', range: () => { const t = new Date(); return [iso(new Date(t.getFullYear(), 0, 1)), iso(new Date(t.getFullYear(), 11, 31))] } },
  { label: 'Semua', range: () => ['2000-01-01', iso(new Date())] },
]

export function usePeriod(defaultPreset = 'Bulan ini') {
  const initial = PRESETS.find((p) => p.label === defaultPreset)!.range()
  const [from, setFrom] = useState(initial[0])
  const [to, setTo] = useState(initial[1])
  return { from, to, setFrom, setTo, setRange: (a: string, b: string) => { setFrom(a); setTo(b) } }
}

// ---------------------------------------------------------------- data + export
export function useReport<T = any>(path: string, params: Record<string, any>, enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(params)
  const seq = React.useRef(0)
  const load = React.useCallback(async () => {
    if (!enabled) return
    const mine = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await axiosInstance.get(`/api/finance/reports/${path}`, { params })
      if (mine === seq.current) setData(res.data)
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.response?.data?.error || 'Gagal memuat laporan')
      setData(null)
    } finally {
      if (mine === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

async function fetchReportFile(path: string, params: Record<string, any>, format: 'xlsx' | 'pdf') {
  try {
    const res = await axiosInstance.get(`/api/finance/reports/${path}`, { params: { ...params, format }, responseType: 'blob' })
    const disposition = res.headers['content-disposition'] || ''
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
    return { blob: new Blob([res.data], { type: format === 'pdf' ? 'application/pdf' : undefined }), name: match ? decodeURIComponent(match[1]) : `${path.replace(/\//g, '_')}.${format}` }
  } catch (e: any) {
    let msg = format === 'pdf' ? 'Gagal membuat PDF' : 'Gagal mengunduh Excel'
    const data = e?.response?.data
    if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg } catch { /* keep default */ } }
    showError(msg)
    return null
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadExcel(path: string, params: Record<string, any>) {
  const f = await fetchReportFile(path, params, 'xlsx')
  if (f) saveBlob(f.blob, f.name)
}

export async function downloadPdf(path: string, params: Record<string, any>) {
  const f = await fetchReportFile(path, params, 'pdf')
  if (f) saveBlob(f.blob, f.name)
}

export async function printPdf(path: string, params: Record<string, any>) {
  const f = await fetchReportFile(path, params, 'pdf')
  if (!f) return
  const url = window.URL.createObjectURL(f.blob)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.src = url
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print() } catch { window.open(url, '_blank') }
    setTimeout(() => { frame.remove(); window.URL.revokeObjectURL(url) }, 60000)
  }
  document.body.appendChild(frame)
}

// ---------------------------------------------------------------- layout pieces
export function ReportShell({ title, subtitle, icon, backTo, backLabel, actions, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; backTo?: string; backLabel?: string; actions?: React.ReactNode; children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="report-print space-y-5 p-1">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .report-print, .report-print * { visibility: visible !important; }
        .report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
        .print-hide { display: none !important; }
        .report-print table { font-size: 11px; }
      }`}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {backTo && (
            <button type="button" onClick={() => navigate(backTo)} className="print-hide mb-1 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700">
              <ArrowLeftIcon className="h-4 w-4" /> {backLabel || 'Pusat Laporan'}
            </button>
          )}
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">{icon}{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <div className="print-hide flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {children}
    </div>
  )
}

export function ExportButtons({ report }: { report?: [string, Record<string, any>] }) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn() } finally { setBusy(null) } }
  if (!report) return null
  const [path, params] = report
  const base = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60'
  return (
    <>
      <button type="button" disabled={!!busy} onClick={() => run('xlsx', () => downloadExcel(path, params))} className={`${base} border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20`}>
        <ArrowDownTrayIcon className="h-4 w-4" /> {busy === 'xlsx' ? 'Menyiapkan…' : 'Excel'}
      </button>
      <button type="button" disabled={!!busy} onClick={() => run('pdf', () => downloadPdf(path, params))} className={`${base} border-rose-500 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20`}>
        <ArrowDownTrayIcon className="h-4 w-4" /> {busy === 'pdf' ? 'Menyiapkan…' : 'PDF'}
      </button>
      <button type="button" disabled={!!busy} onClick={() => run('print', () => printPdf(path, params))} className={`${base} border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700`}>
        <PrinterIcon className="h-4 w-4" /> {busy === 'print' ? 'Menyiapkan…' : 'Cetak'}
      </button>
    </>
  )
}

export function PeriodFilter({ from, to, onChange, onReload, loading, extra, single }: {
  from: string; to: string; onChange: (from: string, to: string) => void; onReload?: () => void; loading?: boolean; extra?: React.ReactNode; single?: boolean
}) {
  return (
    <div className="print-hide flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">{single ? 'Per tanggal' : 'Dari'}</label>
        <input type="date" className="input" value={single ? to : from} onChange={(e) => (single ? onChange(e.target.value, e.target.value) : onChange(e.target.value, to))} />
      </div>
      {!single && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Sampai</label>
          <input type="date" className="input" value={to} onChange={(e) => onChange(from, e.target.value)} />
        </div>
      )}
      {!single && (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => { const [a, b] = p.range(); onChange(a, b) }}
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:border-emerald-500 hover:text-emerald-700 dark:border-gray-600 dark:text-gray-300">
              {p.label}
            </button>
          ))}
        </div>
      )}
      {extra}
      {onReload && (
        <button type="button" onClick={onReload} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Tampilkan
        </button>
      )}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
      <input className="input pl-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Cari...'} />
    </div>
  )
}

type Tone = 'default' | 'green' | 'red' | 'blue' | 'amber'
const TONES: Record<Tone, string> = {
  default: 'text-gray-900 dark:text-white', green: 'text-emerald-700 dark:text-emerald-400', red: 'text-red-600 dark:text-red-400',
  blue: 'text-blue-700 dark:text-blue-400', amber: 'text-amber-600 dark:text-amber-400',
}
export function StatCards({ items }: { items: { label: string; value: string; hint?: string; tone?: Tone }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{it.label}</p>
          <p className={`mt-1 break-words text-lg font-bold tabular-nums ${TONES[it.tone || 'default']}`}>{it.value}</p>
          {it.hint && <p className="mt-0.5 text-xs text-gray-400">{it.hint}</p>}
        </div>
      ))}
    </div>
  )
}

export function DataTable({ children, maxHeight }: { children: React.ReactNode; maxHeight?: string }) {
  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" style={maxHeight ? { maxHeight } : undefined}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  )
}
export const Th = ({ children, right, className = '' }: { children?: React.ReactNode; right?: boolean; className?: string }) => (
  <th className={`sticky top-0 z-10 whitespace-nowrap bg-gray-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-200 ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</th>
)
export const Td = ({ children, right, className = '', colSpan }: { children?: React.ReactNode; right?: boolean; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`px-3 py-2 align-top ${right ? 'text-right tabular-nums' : 'text-left'} text-gray-800 dark:text-gray-100 ${className}`}>{children}</td>
)
export const Money = ({ v, zeroDash = true, colored }: { v: number | null | undefined; zeroDash?: boolean; colored?: boolean }) => (
  <span className={colored && (v || 0) < 0 ? 'text-red-600' : ''}>{zeroDash && !v ? '-' : num(v)}</span>
)

export function DocLink({ url, children }: { url?: string | null; children: React.ReactNode }) {
  if (!url) return <>{children}</>
  return <Link to={url} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">{children}</Link>
}

export function LoadState({ loading, error, empty, emptyText, children }: { loading: boolean; error: string | null; empty?: boolean; emptyText?: string; children: React.ReactNode }) {
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />)}
      </div>
    )
  }
  if (empty) return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800">{emptyText || 'Tidak ada data untuk periode ini.'}</div>
  return <>{children}</>
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export const periodLabel = (from: string, to: string) => (from <= '2000-01-01' ? `s/d ${fmtDate(to)}` : `${fmtDate(from)} - ${fmtDate(to)}`)
export const usePeriodParams = (from: string, to: string) => useMemo(() => ({ date_from: from, date_to: to }), [from, to])
