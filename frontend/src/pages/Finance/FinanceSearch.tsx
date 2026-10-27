import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import { useDraftState } from '../../workspace/drafts'
import { DataTable, LoadState, Money, Td, Th, fmtDate, iso } from './Reports/reportKit'

const TYPES: [string, string][] = [
  ['sales_invoice', 'Faktur Penjualan'], ['purchase_invoice', 'Faktur Pembelian'], ['receipt', 'Penerimaan'],
  ['disbursement', 'Pembayaran'], ['credit_memo', 'Nota Kredit'], ['journal', 'Jurnal'], ['account', 'Akun Perkiraan'],
]
const STATUSES = ['', 'draft', 'sent', 'paid', 'partial', 'overdue', 'pending', 'cleared', 'cancelled']

interface Row {
  type: string; type_label: string; id: number; number: string; date: string | null; party: string | null
  description: string; amount: number | null; status: string | null; url: string; side?: string
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!text || !terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>
}

const FinanceSearch: React.FC = () => {
  const navigate = useNavigate()
  const [q, setQ] = useDraftState('q', '')
  const [types, setTypes] = useDraftState<string[]>('types', [])
  const [dateFrom, setDateFrom] = useDraftState('dateFrom', '')
  const [dateTo, setDateTo] = useDraftState('dateTo', '')
  const [status, setStatus] = useDraftState('status', '')
  const [amountMin, setAmountMin] = useDraftState('amountMin', '')
  const [amountMax, setAmountMax] = useDraftState('amountMax', '')
  const [showFilter, setShowFilter] = useState(false)
  const [data, setData] = useState<{ results: Row[]; counts: Record<string, number>; total: number; terms: string[]; limit: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeType, setActiveType] = useState('')

  const hasInput = !!(q.trim() || dateFrom || dateTo || status || amountMin || amountMax)

  const run = useCallback(async () => {
    if (!hasInput) { setData(null); setError(null); return }
    setLoading(true); setError(null)
    try {
      const res = await axiosInstance.get('/api/finance/search', {
        params: { q: q.trim() || undefined, types: types.join(',') || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined,
          status: status || undefined, amount_min: amountMin || undefined, amount_max: amountMax || undefined, limit: 50 },
      })
      setData(res.data); setActiveType('')
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Pencarian gagal'); setData(null)
    } finally { setLoading(false) }
  }, [q, types, dateFrom, dateTo, status, amountMin, amountMax, hasInput])

  useEffect(() => { const h = setTimeout(run, 400); return () => clearTimeout(h) }, [run])

  const rows = useMemo(() => (data?.results || []).filter((r) => !activeType || r.type === activeType), [data, activeType])
  const clearFilters = () => { setTypes([]); setDateFrom(''); setDateTo(''); setStatus(''); setAmountMin(''); setAmountMax('') }
  const preset = (days: number | 'month') => {
    const t = new Date(); const f = new Date()
    if (days === 'month') f.setDate(1); else f.setDate(f.getDate() - days)
    setDateFrom(iso(f)); setDateTo(iso(t))
  }
  const activeFilters = [types.length ? 1 : 0, dateFrom || dateTo ? 1 : 0, status ? 1 : 0, amountMin || amountMax ? 1 : 0].reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pencarian Transaksi</h1>
        <p className="text-sm text-gray-500">Cari faktur, penerimaan, pembayaran, nota kredit, jurnal, dan akun dalam satu tempat.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input autoFocus className="input w-full pl-10" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Nomor, nama pelanggan/supplier, keterangan, akun... pisahkan kata dengan %  (contoh: maju%INV-2026)" />
          </div>
          <button type="button" onClick={() => setShowFilter((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${activeFilters ? 'border-emerald-600 text-emerald-700' : 'border-gray-300 text-gray-700 dark:text-gray-200'}`}>
            <FunnelIcon className="h-4 w-4" /> Penyaringan{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Tanda <b>%</b> memisahkan kata kunci: hasil harus memuat semua kata, urutan bebas, huruf besar/kecil tidak berpengaruh.</p>

        {showFilter && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <div>
              <div className="mb-1 text-xs font-medium text-gray-500">Jenis dokumen (kosong = semua)</div>
              <div className="flex flex-wrap gap-2">
                {TYPES.map(([k, label]) => {
                  const on = types.includes(k)
                  return <button key={k} type="button" onClick={() => setTypes(on ? types.filter((t) => t !== k) : [...types, k])}
                    className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-600'}`}>{label}</button>
                })}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Dari tanggal</label>
                <input type="date" className="input w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Sampai tanggal</label>
                <input type="date" className="input w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s || 'Semua status'}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Nilai (Rp) dari - sampai</label>
                <div className="flex gap-1">
                  <input type="number" className="input w-full" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="min" />
                  <input type="number" className="input w-full" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="maks" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Cepat:</span>
              <button type="button" className="rounded border px-2 py-1" onClick={() => preset(0)}>Hari ini</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => preset(7)}>7 hari</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => preset('month')}>Bulan ini</button>
              <button type="button" className="ml-auto inline-flex items-center gap-1 text-red-600" onClick={clearFilters}><XMarkIcon className="h-4 w-4" /> Reset penyaringan</button>
            </div>
          </div>
        )}
      </div>

      {!hasInput && <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">Ketik kata kunci atau pilih penyaringan untuk mulai mencari.</div>}

      {hasInput && (
        <LoadState loading={loading} error={error} empty={!!data && data.total === 0} emptyText="Tidak ada transaksi yang cocok. Coba kurangi kata kunci atau penyaringan.">
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setActiveType('')} className={`rounded-full border px-3 py-1 text-xs ${!activeType ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-600'}`}>Semua ({data.total})</button>
                {TYPES.filter(([k]) => data.counts[k]).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setActiveType(k)} className={`rounded-full border px-3 py-1 text-xs ${activeType === k ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-600'}`}>{label} ({data.counts[k]})</button>
                ))}
                {Object.values(data.counts).some((c) => c > data.limit) && <span className="text-xs text-amber-600">Hanya {data.limit} teratas per jenis yang ditampilkan. Persempit pencarian untuk hasil lebih tepat.</span>}
              </div>
              <DataTable maxHeight="65vh">
                <thead><tr><Th>Jenis</Th><Th>Nomor</Th><Th>Tanggal</Th><Th>Pihak / Akun</Th><Th>Keterangan</Th><Th right>Nilai</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.type}-${r.id}`} onClick={() => navigate(r.url)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                      <Td className="whitespace-nowrap text-xs text-gray-500">{r.type_label}</Td>
                      <Td className="whitespace-nowrap font-medium text-emerald-700"><Highlight text={r.number} terms={data.terms} /></Td>
                      <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                      <Td><Highlight text={r.party || '-'} terms={data.terms} /></Td>
                      <Td className="max-w-xs truncate"><Highlight text={r.description} terms={data.terms} /></Td>
                      <Td right>{r.amount === null ? '' : <><Money v={r.amount} />{r.side ? <span className="ml-1 text-xs text-gray-400">{r.side}</span> : null}</>}</Td>
                      <Td>{r.status && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">{r.status}</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </>
          )}
        </LoadState>
      )}
    </div>
  )
}

export default FinanceSearch
