import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowsRightLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import LoadingSpinner from '../../components/Common/LoadingSpinner'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

interface AccountRef { id: number; code: string; name: string; currency: string }
interface TransferRow {
  id: number
  number: string
  transfer_date: string
  from_account: AccountRef | null
  to_account: AccountRef | null
  amount: number
  amount_received: number | null
  fee_amount: number
  fee_charged_to: string
  reference_number: string | null
  notes: string | null
  status: string
  journal_number: string | null
  created_by_name: string | null
  cancel_reason: string | null
}

const money = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`
const tanggal = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_LABEL: Record<string, string> = { posted: 'Terjurnal', cancelled: 'Dibatalkan' }

const COLUMNS: ListColumn<TransferRow>[] = [
  { key: 'number', label: 'No. Transfer', value: (r) => r.number },
  { key: 'transfer_date', label: 'Tanggal', type: 'date', value: (r) => r.transfer_date },
  { key: 'from_name', label: 'Dari', value: (r) => (r.from_account ? `${r.from_account.code} ${r.from_account.name}` : '') },
  { key: 'to_name', label: 'Ke', value: (r) => (r.to_account ? `${r.to_account.code} ${r.to_account.name}` : '') },
  { key: 'amount', label: 'Nilai', type: 'number', value: (r) => r.amount },
  { key: 'fee_amount', label: 'Biaya', type: 'number', value: (r) => r.fee_amount },
  { key: 'reference_number', label: 'No. Bukti', value: (r) => r.reference_number || '' },
  { key: 'notes', label: 'Keterangan', value: (r) => r.notes || '' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS_LABEL[r.status] || r.status },
]

export default function BankTransferList() {
  const [rows, setRows] = useState<TransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<number | null>(null)
  const [jurnal, setJurnal] = useState<Record<number, any[]>>({})

  const load = useCallback(() => {
    setLoading(true)
    axiosInstance.get('/api/finance/bank-transfers', { params: { per_page: 500 } })
      .then((r) => setRows(r.data?.transfers || []))
      .catch(() => toast.error('Gagal memuat daftar transfer'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const tools = useListTools<TransferRow>(rows, COLUMNS, {
    filename: 'Transfer_Kas_Bank',
    initialSort: { key: 'transfer_date', dir: 'desc' },
    dateColumn: 'transfer_date',
  })

  const lihatJurnal = async (id: number) => {
    setOpen(open === id ? null : id)
    if (jurnal[id]) return
    try {
      const r = await axiosInstance.get(`/api/finance/bank-transfers/${id}`)
      setJurnal((p) => ({ ...p, [id]: r.data?.journal || [] }))
    } catch {
      toast.error('Gagal memuat jurnal transfer')
    }
  }

  const batalkan = async (row: TransferRow) => {
    const ok = await confirmDialog(
      `Batalkan transfer ${row.number} senilai ${money(row.amount)}? Jurnal pembalik akan dibuat otomatis.`,
      { title: 'Batalkan transfer', confirmText: 'Batalkan transfer' },
    )
    if (!ok) return
    try {
      await axiosInstance.post(`/api/finance/bank-transfers/${row.id}/cancel`, {})
      toast.success(`Transfer ${row.number} dibatalkan`)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal membatalkan transfer')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
            <ArrowsRightLeftIcon className="h-6 w-6" aria-hidden="true" />
            Transfer Kas/Bank
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Pemindahan dana antar rekening sendiri, misalnya Bank BCA ke Kas Purbalingga.
          </p>
        </div>
        <Link to="/app/finance/bank-transfers/new" className="btn-primary shrink-0">
          <PlusIcon className="mr-1.5 h-5 w-5" aria-hidden="true" />
          Transfer Baru
        </Link>
      </div>

      <div className="card space-y-4 p-4 sm:p-6">
        <ListToolbar tools={tools} placeholder="Cari nomor, akun, keterangan" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <SortTh tools={tools} col="number" className="px-3 py-2 text-left">No. Transfer</SortTh>
                <SortTh tools={tools} col="transfer_date" className="px-3 py-2 text-left">Tanggal</SortTh>
                <SortTh tools={tools} col="from_name" className="px-3 py-2 text-left">Dari</SortTh>
                <SortTh tools={tools} col="to_name" className="px-3 py-2 text-left">Ke</SortTh>
                <SortTh tools={tools} col="amount" align="right" className="px-3 py-2 text-right">Nilai</SortTh>
                <SortTh tools={tools} col="fee_amount" align="right" className="px-3 py-2 text-right">Biaya</SortTh>
                <SortTh tools={tools} col="status" className="px-3 py-2 text-left">Status</SortTh>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tools.rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className={r.status === 'cancelled' ? 'text-gray-400 line-through dark:text-gray-500' : ''}>
                    <td className="px-3 py-2 font-medium">{r.number}</td>
                    <td className="px-3 py-2">{tanggal(r.transfer_date)}</td>
                    <td className="px-3 py-2">{r.from_account ? `${r.from_account.code} ${r.from_account.name}` : '-'}</td>
                    <td className="px-3 py-2">{r.to_account ? `${r.to_account.code} ${r.to_account.name}` : '-'}</td>
                    <td className="px-3 py-2 text-right">{money(r.amount)}</td>
                    <td className="px-3 py-2 text-right">{r.fee_amount ? money(r.fee_amount) : '-'}</td>
                    <td className="px-3 py-2">
                      {r.status === 'cancelled'
                        ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">Dibatalkan</span>
                        : <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Terjurnal</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => lihatJurnal(r.id)} className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-300">
                          {open === r.id ? 'Tutup jurnal' : 'Lihat jurnal'}
                        </button>
                        {r.status !== 'cancelled' && (
                          <button type="button" onClick={() => batalkan(r)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
                            Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <td colSpan={8} className="px-3 py-3">
                        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                          Jurnal {r.journal_number || '-'}{r.notes ? ` · ${r.notes}` : ''}{r.created_by_name ? ` · dicatat oleh ${r.created_by_name}` : ''}
                          {r.cancel_reason ? ` · alasan batal: ${r.cancel_reason}` : ''}
                        </p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="text-left uppercase text-gray-500 dark:text-gray-400">
                              <tr><th className="px-2 py-1">Akun</th><th className="px-2 py-1 text-right">Debit</th><th className="px-2 py-1 text-right">Kredit</th></tr>
                            </thead>
                            <tbody>
                              {(jurnal[r.id] || []).map((j: any, i: number) => (
                                <tr key={i} className={j.is_reversal ? 'text-gray-500 dark:text-gray-400' : ''}>
                                  <td className="px-2 py-1">
                                    {j.account_code} {j.account_name}
                                    {j.is_reversal && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] dark:bg-gray-700">pembalik</span>}
                                  </td>
                                  <td className="px-2 py-1 text-right">{j.debit ? money(j.debit) : '-'}</td>
                                  <td className="px-2 py-1 text-right">{j.credit ? money(j.credit) : '-'}</td>
                                </tr>
                              ))}
                              {(jurnal[r.id] || []).length === 0 && (
                                <tr><td colSpan={3} className="px-2 py-2 text-gray-500 dark:text-gray-400">Memuat jurnal...</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {tools.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                    Belum ada transfer kas/bank pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
