import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import { showError } from '../../components/ui/Toast'
import { fmtQty, unitFor } from './convertingUnits'

const TYPE_LABEL: Record<string, string> = {
  perforating: 'Perforating', slitting: 'Slitting', laminasi: 'Laminasi Kain', bagmaker: 'Bagmaker', folding: 'Folding', cutting: 'Cutting',
}

interface Col { label: string; get: (r: any, i: number) => any; align?: 'right' | 'left'; total?: boolean }

function DataTable({ title, cols, rows }: { title: string; cols: Col[]; rows: any[] }) {
  if (!rows || rows.length === 0) return null
  const totals = cols.map((c) => (c.total ? rows.reduce((s, r, i) => s + (Number(c.get(r, i)) || 0), 0) : null))
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 dark:text-white mb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b">
              <th className="py-2 pr-3 text-left">#</th>
              {cols.map((c) => <th key={c.label} className={`py-2 px-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                {cols.map((c) => {
                  const v = c.get(r, i)
                  return <td key={c.label} className={`py-2 px-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{typeof v === 'number' ? fmtQty(v) : (v ?? '-') === '' ? '-' : (v ?? '-')}</td>
                })}
              </tr>
            ))}
          </tbody>
          {totals.some((t) => t !== null) && (
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-3" />
                {cols.map((c, ci) => <td key={c.label} className={`py-2 px-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{totals[ci] !== null ? fmtQty(totals[ci]) : ci === 0 ? 'Total' : ''}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

const KV = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="font-medium text-slate-800 dark:text-white">{value === null || value === undefined || value === '' ? '-' : value}</p>
  </div>
)

export default function ConvertingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    axiosInstance.get(`/api/converting/production/${id}`)
      .then((r) => setP(r.data.production))
      .catch((e) => { showError(e?.response?.data?.error || 'Gagal memuat data produksi'); setP(null) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-slate-500">Memuat...</div>
  if (!p) return (
    <div className="p-8">
      <p className="text-slate-600 mb-3">Data produksi tidak ditemukan.</p>
      <Link to="/app/production/converting" className="text-blue-600 hover:underline">Kembali ke dashboard</Link>
    </div>
  )

  const type: string = p.machine?.machine_type || ''
  const md = p.machine_data || {}
  const rows: any[] = md.rows || []
  const unit = unitFor(type)
  const downtime: any[] = md.downtime_entries || []
  const dtTotal = downtime.reduce((s, e) => s + (Number(e.duration_minutes) || 0) * (Number(e.frequency) || 1), 0)

  const tables: JSX.Element[] = []
  if (type === 'slitting') {
    tables.push(<DataTable key="t" title="Data Slitting per Roll" rows={rows} cols={[
      { label: 'No Roll', get: (r) => r.no_roll },
      { label: 'Width (cm)', get: (r) => r.width, align: 'right' },
      { label: 'Weight (kg)', get: (r) => r.weight, align: 'right', total: true },
      { label: 'Length (m)', get: (r) => r.length, align: 'right' },
      { label: 'Thick', get: (r) => r.thick, align: 'right' },
      { label: 'Hasil per jalur (kg)', get: (r) => (r.slitting || []).filter((v: any) => Number(v) > 0).map((v: any) => fmtQty(v)).join(' | ') },
      { label: 'Loss (kg)', get: (r) => r.loss, align: 'right', total: true },
      { label: 'Total Length (m)', get: (r) => r.total_length, align: 'right', total: true },
      { label: 'Total Weight (kg)', get: (r) => r.total_weight, align: 'right', total: true },
    ]} />)
  } else if (type === 'perforating' || type === 'cutting') {
    tables.push(<DataTable key="t" title={`Data ${TYPE_LABEL[type]} per Roll`} rows={rows} cols={[
      { label: 'No Roll', get: (r) => r.no_roll },
      { label: 'Width (cm)', get: (r) => r.width, align: 'right' },
      { label: 'Weight (kg)', get: (r) => r.weight, align: 'right', total: true },
      { label: 'Length (m)', get: (r) => r.length, align: 'right', total: true },
      { label: 'Repeat Length', get: (r) => r.repeat_length, align: 'right' },
      { label: 'Repeat Width', get: (r) => r.repeat_width, align: 'right' },
    ]} />)
  } else if (type === 'folding') {
    tables.push(<DataTable key="t" title="Data Folding per Roll" rows={rows} cols={[
      { label: 'No Roll', get: (r) => r.no_roll },
      { label: 'No Slitting', get: (r) => r.no_slitting },
      { label: 'Weight (kg)', get: (r) => r.weight, align: 'right', total: true },
      { label: 'Length (m)', get: (r) => r.length, align: 'right', total: true },
    ]} />)
  } else if (type === 'bagmaker') {
    tables.push(<DataTable key="t" title="Data Bagmaker" rows={rows} cols={[
      { label: 'No Roll', get: (r) => r.no_roll },
      { label: 'Plan Downtime', get: (r) => r.plan_downtime },
      { label: 'Unplan Downtime', get: (r) => r.unplan_downtime },
      { label: 'Menit', get: (r) => r.total_minutes, align: 'right', total: true },
      { label: 'Berat Roll (kg)', get: (r) => r.roll_weight, align: 'right', total: true },
      { label: 'Panjang Roll (m)', get: (r) => r.roll_length, align: 'right', total: true },
      { label: 'Output Grade A (pcs)', get: (r) => r.output_grade_a, align: 'right', total: true },
      { label: 'Output Grade C (pcs)', get: (r) => r.output_grade_c, align: 'right', total: true },
    ]} />)
  } else if (type === 'laminasi') {
    tables.push(<DataTable key="t" title="Data Laminasi" rows={rows} cols={[
      { label: 'Jam', get: (r) => [r.time_start, r.time_end].filter(Boolean).join(' - ') },
      { label: 'Menit', get: (r) => r.total_minutes, align: 'right', total: true },
      { label: 'Produk', get: (r) => r.product_name },
      { label: 'Film', get: (r) => [r.film_type, r.film_gsm ? `${r.film_gsm} gsm` : ''].filter(Boolean).join(' ') },
      { label: 'Nonwoven', get: (r) => [r.nonwoven_type, r.nonwoven_gsm ? `${r.nonwoven_gsm} gsm` : ''].filter(Boolean).join(' ') },
      { label: 'Winding Width', get: (r) => r.winding_width, align: 'right' },
      { label: 'Winding Length', get: (r) => r.winding_length, align: 'right', total: true },
      { label: 'GSM Total', get: (r) => r.gsm_total, align: 'right' },
      { label: 'Speed', get: (r) => r.speed, align: 'right' },
      { label: 'Lem', get: (r) => [r.lem_type, r.lem_usage ? `${fmtQty(r.lem_usage)}` : ''].filter(Boolean).join(' / ') },
    ]} />)
  }

  const axisBlock = (title: string, axis: any) => axis && Object.values(axis).some((v) => Number(v)) ? (
    <div key={title} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 dark:text-white mb-3">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(axis).map(([k, v]) => <KV key={k} label={k.replace(/_/g, ' ')} value={fmtQty(v as any)} />)}
      </div>
    </div>
  ) : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/production/converting')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" aria-label="Kembali"><ArrowLeftIcon className="h-5 w-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Detail Produksi {TYPE_LABEL[type] || type}</h1>
          <p className="text-sm text-slate-500">
            {p.machine?.name} ({p.machine?.code}) · {new Date(p.production_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} · Shift {p.shift}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow">
          <p className="text-sm opacity-90">Grade A</p><p className="text-2xl font-bold">{fmtQty(p.grade_a)}</p><p className="text-xs opacity-75">{unit}</p>
        </div>
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl p-4 text-white shadow">
          <p className="text-sm opacity-90">Grade B / Reject</p><p className="text-2xl font-bold">{fmtQty(p.grade_b)}</p><p className="text-xs opacity-75">{unit}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow">
          <p className="text-sm opacity-90">Loss</p><p className="text-2xl font-bold">{fmtQty(p.loss_kg)}</p><p className="text-xs opacity-75">kg</p>
        </div>
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow">
          <p className="text-sm opacity-90">Efisiensi</p><p className="text-2xl font-bold">{fmtQty(p.efficiency_rate)}%</p><p className="text-xs opacity-75">target {p.machine?.target_efficiency ?? '-'}%</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow">
          <p className="text-sm opacity-90">Downtime</p><p className="text-2xl font-bold">{fmtQty(p.downtime_minutes)}</p><p className="text-xs opacity-75">menit</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <KV label="Produk" value={p.product_name} />
        <KV label="NJO" value={p.njo} />
        <KV label="Spesifikasi" value={p.specification} />
        <KV label="Operator" value={p.operator_name} />
        <KV label="Target Speed" value={p.target_speed} />
        <KV label="Actual Speed" value={p.actual_speed} />
        <KV label="Status" value={p.status} />
        <KV label="Dicatat" value={p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : null} />
        {p.notes && <div className="col-span-2 md:col-span-4"><KV label="Catatan" value={p.notes} /></div>}
      </div>

      {tables}
      {axisBlock('Pengaturan Axis Film', md.film_axis)}
      {axisBlock('Pengaturan Axis Nonwoven', md.nonwoven_axis)}
      {rows.length === 0 && type !== 'laminasi' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 text-sm text-slate-500">Tidak ada data per baris untuk rekaman ini.</div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-3">Downtime</h2>
        {downtime.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada downtime.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-xs text-slate-500 border-b"><th className="py-2 pr-3 text-left">Alasan</th><th className="py-2 px-3 text-left">Kategori</th><th className="py-2 px-3 text-right">Durasi (menit)</th><th className="py-2 px-3 text-right">Frekuensi</th><th className="py-2 pl-3 text-right">Total (menit)</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {downtime.map((e, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">{e.reason || '-'}</td><td className="py-2 px-3">{e.category || '-'}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtQty(e.duration_minutes)}</td><td className="py-2 px-3 text-right tabular-nums">{fmtQty(e.frequency ?? 1)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{fmtQty((Number(e.duration_minutes) || 0) * (Number(e.frequency) || 1))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 font-semibold"><td className="py-2 pr-3" colSpan={4}>Total</td><td className="py-2 pl-3 text-right tabular-nums">{fmtQty(dtTotal)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
