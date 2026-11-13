import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import AccessibleModal from '../../components/ui/AccessibleModal'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { useUrlState } from '../../hooks/useUrlState'
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail'
import { confirmDialog, showError, showSuccess } from '../../components/ui'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'
import { Skeleton } from '../../components/ui/Skeleton'

interface RequestRow {
  id: number
  request_number: string
  status: string
  machine_name: string | null
  requested_by: string | null
  requested_at: string | null
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  notes: string | null
  items_count: number
  items?: RequestItem[]
}

interface RequestItem {
  id: number
  part_number: string
  part_name: string
  uom: string
  qty_requested: number
  qty_issued: number
  current_stock: number
}

const TABS = [
  { id: 'pending', label: 'Menunggu' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
  { id: '', label: 'Semua' },
]

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Ditolak', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
}

const COLUMNS: ListColumn<RequestRow>[] = [
  { key: 'request_number', label: 'Nomor', value: (r) => r.request_number },
  { key: 'machine_name', label: 'Mesin', value: (r) => r.machine_name },
  { key: 'requested_by', label: 'Peminta', value: (r) => r.requested_by },
  { key: 'requested_at', label: 'Tanggal', value: (r) => r.requested_at, type: 'date' },
  { key: 'items_count', label: 'Jumlah Item', value: (r) => r.items_count, type: 'number' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS[r.status]?.label || r.status },
  { key: 'decided_by', label: 'Diputuskan Oleh', value: (r) => r.decided_by },
  { key: 'decided_at', label: 'Tanggal Keputusan', value: (r) => r.decided_at, type: 'date' },
  { key: 'decision_note', label: 'Catatan Keputusan', value: (r) => r.decision_note },
  { key: 'notes', label: 'Catatan', value: (r) => r.notes },
]

const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')
const fmtNum = (n: number) => n.toLocaleString('id-ID')

const Badge = ({ status }: { status: string }) => {
  const s = STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' }
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

const SparePartRequests = () => {
  const [tabUrl, setTabUrl] = useUrlState('tab', 'pending', ['pending', 'approved', 'rejected', 'semua'] as const)
  const tab = tabUrl === 'semua' ? '' : tabUrl
  const setTab = (id: string) => setTabUrl((id === '' ? 'semua' : id) as typeof tabUrl)
  useBreadcrumbTrail(tabUrl === 'pending' ? [] : [{ label: TABS.find((t) => t.id === tab)?.label || 'Semua' }])
  const [rows, setRows] = useState<RequestRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<RequestRow | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const tools = useListTools<RequestRow>(rows, COLUMNS, { filename: `Permintaan_Sparepart_${tabUrl}`, initialSort: { key: 'requested_at', dir: 'desc' } })

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axiosInstance.get('/api/spare-parts/requests', { params: { status: tab || undefined, per_page: 1000 } })
      setRows(res.data.requests || [])
      setPendingCount(res.data.pending || 0)
    } catch (e: any) {
      setRows([])
      showError(e.response?.data?.error || 'Daftar permintaan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  const openDetail = async (r: RequestRow) => {
    try {
      const res = await axiosInstance.get(`/api/spare-parts/requests/${r.id}`)
      setDetail(res.data)
    } catch (e: any) {
      showError(e.response?.data?.error || 'Detail gagal dimuat.')
    }
  }

  const act = async (kind: 'approve' | 'reject' | 'cancel', note?: string) => {
    if (!detail) return
    setBusy(true)
    try {
      const res = await axiosInstance.post(`/api/spare-parts/requests/${detail.id}/${kind}`, note ? { note } : {})
      showSuccess(res.data?.message || 'Berhasil.')
      setRejectOpen(false)
      setReason('')
      setDetail(null)
      load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Gagal memproses permintaan.')
    } finally {
      setBusy(false)
    }
  }

  const approve = async () => {
    if (!detail) return
    const ok = await confirmDialog(
      `Setujui ${detail.request_number}? Stok sparepart langsung berkurang sesuai jumlah yang diminta dan tidak bisa dibatalkan dari sini.`,
    )
    if (ok) act('approve')
  }

  const cancel = async () => {
    if (!detail) return
    if (await confirmDialog(`Batalkan permintaan ${detail.request_number}?`)) act('cancel')
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Permintaan Sparepart"
        subtitle="Permintaan sparepart dari mekanik. Disetujui oleh kepala maintenance, stok berkurang saat disetujui."
        actions={<Link to="/app/maintenance/parts-requests/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Permintaan baru</Link>}
      />

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}
          >
            {t.label}
            {t.id === 'pending' && pendingCount > 0 && (
              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor, mesin, atau peminta" />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortTh tools={tools} col="request_number" className={th}>Nomor</SortTh>
              <SortTh tools={tools} col="machine_name" className={th}>Mesin</SortTh>
              <SortTh tools={tools} col="requested_by" className={th}>Peminta</SortTh>
              <SortTh tools={tools} col="requested_at" className={th}>Tanggal</SortTh>
              <SortTh tools={tools} col="items_count" align="right" className={`${th} text-right`}>Item</SortTh>
              <SortTh tools={tools} col="status" className={th}>Status</SortTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && <tr><td colSpan={6} className="px-4 py-4"><div className="space-y-2" role="status" aria-label="Memuat data">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div></td></tr>}
            {!loading && tools.rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Tidak ada permintaan.</td></tr>}
            {tools.rows.map((r) => (
              <tr key={r.id} onClick={() => openDetail(r)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">{r.request_number}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{r.machine_name || '-'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{r.requested_by || '-'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.requested_at)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{r.items_count}</td>
                <td className="px-4 py-2.5"><Badge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AccessibleModal
        isOpen={!!detail && !rejectOpen}
        onClose={() => setDetail(null)}
        title={detail ? `Permintaan ${detail.request_number}` : ''}
        size="full"
        footer={
          detail?.status === 'pending' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={cancel} disabled={busy} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">Batalkan permintaan</button>
              <button type="button" onClick={() => setRejectOpen(true)} disabled={busy} className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-700 dark:text-red-300">Tolak</button>
              <button type="button" onClick={approve} disabled={busy} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">Setujui</button>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Status</dt><dd className="mt-0.5"><Badge status={detail.status} /></dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Mesin</dt><dd className="mt-0.5 text-gray-800 dark:text-gray-200">{detail.machine_name || '-'}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Peminta</dt><dd className="mt-0.5 text-gray-800 dark:text-gray-200">{detail.requested_by || '-'}, {fmtDate(detail.requested_at)}</dd></div>
              {detail.notes && <div className="sm:col-span-3"><dt className="text-xs text-gray-500 dark:text-gray-400">Catatan</dt><dd className="mt-0.5 text-gray-800 dark:text-gray-200">{detail.notes}</dd></div>}
              {detail.decided_by && <div className="sm:col-span-3"><dt className="text-xs text-gray-500 dark:text-gray-400">Keputusan</dt><dd className="mt-0.5 text-gray-800 dark:text-gray-200">{detail.decided_by}, {fmtDate(detail.decided_at)}{detail.decision_note ? `. ${detail.decision_note}` : ''}</dd></div>}
            </dl>
            <Panel title="Item">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    <tr><th className="px-4 py-2">Sparepart</th><th className="px-4 py-2 text-right">Diminta</th><th className="px-4 py-2 text-right">Stok sekarang</th><th className="px-4 py-2 text-right">Dikeluarkan</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(detail.items || []).map((i) => {
                      const short = detail.status === 'pending' && i.qty_requested > i.current_stock
                      return (
                        <tr key={i.id}>
                          <td className="px-4 py-2"><span className="font-medium text-gray-900 dark:text-white">{i.part_number}</span> <span className="text-gray-600 dark:text-gray-300">{i.part_name}</span></td>
                          <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtNum(i.qty_requested)} {i.uom}</td>
                          <td className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${short ? 'font-medium text-red-600 dark:text-red-400' : ''}`}>{fmtNum(i.current_stock)} {i.uom}{short ? ' (kurang)' : ''}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtNum(i.qty_issued)} {i.uom}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}
      </AccessibleModal>

      <AccessibleModal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Tolak permintaan"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejectOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Kembali</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { if (!reason.trim()) { showError('Alasan penolakan wajib diisi.'); return } act('reject', reason.trim()) }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Tolak permintaan
            </button>
          </div>
        }
      >
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Alasan penolakan</label>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="Wajib diisi" />
      </AccessibleModal>
    </div>
  )
}

export default SparePartRequests
