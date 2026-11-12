import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'

interface Entry { payment_id: number; payment_number: string; date: string | null; amount: number; description?: string }
interface Adv {
  party_type: string; party_id: number; party_name: string | null; account_code: string; account_name: string
  direction: string; given: number; settled: number; outstanding: number; status: string; last_date: string | null; entries: Entry[]
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

export default function AdvanceRecap() {
  const [rows, setRows] = useState<Adv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    axiosInstance.get('/api/finance/advances-summary').then((r) => { setRows(r.data.advances || []); setTotal(r.data.total_outstanding || 0) })
      .catch(() => setRows([])).finally(() => setLoading(false))
  }, [])

  const shown = rows.filter((r) => !onlyOpen || r.status === 'menggantung')
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Rekap Uang Muka Lainnya</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Uang muka/panjar/deposit yang dicatat dengan nama pemasok atau pelanggan di Pembayaran Kas/Bank. Sisa tidak nol berarti masih menggantung.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Hanya yang menggantung</label>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400">Total sisa menggantung</div>
        <div className="text-2xl font-semibold tabular-nums">{rp(total)}</div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr><th className="px-3 py-2">Pihak</th><th className="px-3 py-2">Akun</th><th className="px-3 py-2">Terakhir</th><th className="px-3 py-2 text-right">Diberikan</th><th className="px-3 py-2 text-right">Diselesaikan</th><th className="px-3 py-2 text-right">Sisa</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && <tr><td colSpan={7} className="p-4 text-gray-500 dark:text-gray-400">Memuat...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={7} className="p-4 text-gray-500 dark:text-gray-400">Tidak ada data.</td></tr>}
            {shown.map((r) => {
              const k = `${r.party_type}-${r.party_id}-${r.account_code}`
              return (
                <>
                  <tr key={k} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40" onClick={() => setOpen(open === k ? null : k)}>
                    <td className="px-3 py-2 font-medium">{r.party_name || `#${r.party_id}`}<span className="ml-2 text-xs text-gray-400">{r.party_type === 'customer' ? 'Pelanggan' : 'Pemasok'}</span></td>
                    <td className="px-3 py-2">{r.account_code} {r.account_name}</td>
                    <td className="px-3 py-2">{r.last_date || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rp(r.given)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rp(r.settled)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{rp(r.outstanding)}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${r.status === 'lunas' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>{r.status === 'lunas' ? 'Selesai' : 'Menggantung'}</span></td>
                  </tr>
                  {open === k && (
                    <tr key={`${k}-d`}><td colSpan={7} className="bg-gray-50 p-3 dark:bg-gray-900/40">
                      {r.entries.map((e, i) => (
                        <div key={i} className="flex justify-between py-0.5 text-xs">
                          <span><Link className="text-blue-700 hover:underline dark:text-blue-300" to={`/app/finance/payments/${e.payment_id}`}>{e.payment_number}</Link> · {e.date || '-'} {e.description ? `· ${e.description}` : ''}</span>
                          <span className="tabular-nums">{rp(e.amount)}</span>
                        </div>
                      ))}
                    </td></tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
