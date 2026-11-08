import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import axiosInstance from '../../utils/axiosConfig'

interface Details {
  title: string; number: string; amount: string; notes: string
  info: [string, string][]
  items: { nama: string; master: string | null; keterangan: string; qty: number; uom: string; harga: string; total: string }[]
  totals: [string, string][]
}

export default function ApprovalEmail() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState<{ step: string; approver: string; details: Details } | null>(null)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState<'approve' | 'reject'>(params.get('aksi') === 'tolak' ? 'reject' : 'approve')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const api = axios.create({ baseURL: axiosInstance.defaults.baseURL })

  useEffect(() => {
    api.get(`/api/approval-email/${token}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.error || 'Tautan tidak bisa dibuka.'))
  }, [token])

  const submit = async () => {
    setBusy(true); setError('')
    try {
      await api.post(`/api/approval-email/${token}`, { action: choice, notes })
      setDone(choice === 'reject' ? 'Dokumen ditolak. Pengaju akan melihat alasan Anda.' : data?.step === 'review' ? 'Peninjauan dicatat dan dokumen diteruskan ke tahap persetujuan.' : 'Dokumen disetujui.')
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memproses. Coba lagi atau buka di ERP.')
    } finally { setBusy(false) }
  }

  const review = data?.step === 'review'
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-gray-900 dark:text-gray-100">{children}</div>
    </div>
  )

  if (done) return shell(<><h1 className="text-xl font-semibold mb-2">Selesai</h1><p>{done}</p><p className="text-sm text-gray-500 mt-4">Halaman ini boleh ditutup.</p></>)
  if (error && !data) return shell(<><h1 className="text-xl font-semibold mb-2">Tautan tidak bisa dipakai</h1><p>{error}</p></>)
  if (!data) return shell(<p>Memuat...</p>)
  const d = data.details

  return shell(
    <>
      <p className="text-sm text-gray-500">{review ? 'Peninjauan' : 'Persetujuan'} untuk {data.approver}</p>
      <h1 className="text-xl font-semibold mb-1">{d.title} {d.number}</h1>
      <p className="mb-4">Total: <strong>{d.amount}</strong></p>
      <table className="w-full text-sm mb-4"><tbody>
        {d.info.map(([k, v]) => (<tr key={k} className="border-b border-gray-100 dark:border-gray-700"><th className="text-left py-1.5 pr-3 w-44 font-medium text-gray-600 dark:text-gray-400">{k}</th><td className="py-1.5">{v}</td></tr>))}
      </tbody></table>
      {d.items.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"><th className="py-1.5">#</th><th>Barang</th><th className="text-right">Jumlah</th><th className="text-right">Harga</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 align-top">
                  <td className="py-1.5">{i + 1}</td>
                  <td>{it.nama}{it.master && <div className="text-xs text-gray-500">{it.master}</div>}{it.keterangan && <div className="text-xs text-gray-500">Ket: {it.keterangan}</div>}</td>
                  <td className="text-right whitespace-nowrap">{it.qty} {it.uom}</td><td className="text-right whitespace-nowrap">{it.harga}</td><td className="text-right whitespace-nowrap">{it.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-right text-sm mb-4">{d.totals.map(([k, v]) => (<div key={k} className={k === 'Total' ? 'font-semibold' : ''}>{k}: {v}</div>))}</div>
      {d.notes && <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm mb-4"><strong>Catatan:</strong> {d.notes}</div>}

      <div className="flex gap-2 mb-3">
        <button type="button" onClick={() => setChoice('approve')} className={`flex-1 py-2 rounded-md border text-sm font-medium ${choice === 'approve' ? 'bg-[#1f4e5a] text-white border-[#1f4e5a]' : 'border-gray-300 dark:border-gray-600'}`}>{review ? 'Teruskan ke persetujuan' : 'Setujui'}</button>
        <button type="button" onClick={() => setChoice('reject')} className={`flex-1 py-2 rounded-md border text-sm font-medium ${choice === 'reject' ? 'bg-red-700 text-white border-red-700' : 'border-gray-300 dark:border-gray-600'}`}>Tolak</button>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
        placeholder={choice === 'reject' ? 'Alasan penolakan (wajib)' : 'Catatan (opsional)'}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm mb-3" />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button type="button" disabled={busy || (choice === 'reject' && !notes.trim())} onClick={submit}
        className={`w-full py-2.5 rounded-md text-white font-medium disabled:opacity-50 ${choice === 'reject' ? 'bg-red-700' : 'bg-[#1f4e5a]'}`}>
        {busy ? 'Memproses...' : choice === 'reject' ? 'Konfirmasi tolak' : review ? 'Konfirmasi teruskan' : 'Konfirmasi setujui'}
      </button>
    </>
  )
}
