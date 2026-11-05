import { useEffect, useState } from 'react'
import axiosInstance from '../utils/axiosConfig'

interface Change { field: string; old: any; new: any }
interface Entry { id: number; timestamp: string | null; user: string; changes: Change[] }

const LABELS: Record<string, string> = {
  quantity: 'Jumlah', unit_price: 'Harga satuan', total_amount: 'Total', notes: 'Catatan', status: 'Status',
  required_date: 'Tgl dibutuhkan', expected_date: 'Tgl estimasi', order_date: 'Tgl order', payment_terms: 'Termin',
  delivery_address: 'Alamat kirim', supplier_id: 'Pemasok', customer_id: 'Pelanggan', due_date: 'Jatuh tempo',
  invoice_date: 'Tgl faktur', receipt_date: 'Tgl terima', delivery_note_number: 'No. surat jalan', vehicle_number: 'No. kendaraan',
  driver_name: 'Sopir', description: 'Nama', reference_number: 'No. referensi', amount: 'Jumlah', currency: 'Mata uang',
}
const label = (f: string) => LABELS[f] || f.replace(/_/g, ' ')
const val = (v: any) => (v === null || v === undefined || v === '' ? '(kosong)' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export default function RiwayatPanel({ table, id }: { table: string; id: number | string | undefined }) {
  const [rows, setRows] = useState<Entry[]>([])
  const rid = id ? Number(id) : 0
  useEffect(() => {
    if (!rid) return
    axiosInstance.get('/api/history', { params: { table, id: rid } })
      .then((r) => setRows(r.data.history || []))
      .catch(() => setRows([]))
  }, [table, rid])

  if (!rid) return null
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Riwayat ({rows.length})</h3>
      {rows.length === 0 && <p className="text-sm text-gray-500">Belum ada perubahan setelah dibuat.</p>}
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((e) => (
          <li key={e.id} className="py-2 text-sm">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span className="font-medium">{e.user}</span>
              <span className="text-xs text-gray-500">{e.timestamp ? new Date(e.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
              {e.changes.map((c, i) => (
                <li key={i}><span className="font-medium">{label(c.field)}</span>: <span className="line-through text-red-600">{val(c.old)}</span> → <span className="text-green-700">{val(c.new)}</span></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
