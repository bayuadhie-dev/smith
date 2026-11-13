import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel, KpiStrip } from '../../components/ui/PageKit'
import AccessibleModal from '../../components/ui/AccessibleModal'
import NumberInput from '../../components/ui/NumberInput'
import { confirmDialog, showError, showSuccess } from '../../components/ui'
import { useUrlState } from '../../hooks/useUrlState'
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail'
import { useDebounce } from '../../hooks/useDebounce'
import { usePermissions } from '../../contexts/PermissionContext'

const API = '/api/petty-cash'
type TabId = 'ringkasan' | 'transaksi' | 'pengisian' | 'laporan' | 'pengaturan'
const TAB_LABEL: Record<TabId, string> = {
  ringkasan: 'Ringkasan', transaksi: 'Transaksi', pengisian: 'Pengisian Kembali', laporan: 'Laporan', pengaturan: 'Pengaturan',
}
const STATUS_LABEL: Record<string, string> = {
  submitted: 'Menunggu Plant Manager', approved: 'Menunggu Pencairan', paid: 'Dicairkan', rejected: 'Ditolak', cancelled: 'Batal',
}
const STATUS_CLASS: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  paid: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}
const REP_LABEL: Record<string, string> = { requested: 'Menunggu Finance', approved: 'Disetujui, menunggu dana', received: 'Dana diterima', rejected: 'Ditolak' }
const REP_CLASS: Record<string, string> = {
  requested: STATUS_CLASS.submitted, approved: STATUS_CLASS.approved, received: STATUS_CLASS.paid, rejected: STATUS_CLASS.rejected,
}
const REASON_LABEL: Record<string, string> = { min_balance: 'Saldo mencapai batas minimum', month_end: 'Akhir bulan', manual: 'Diajukan manual' }

const rp = (n: number | null | undefined) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const dmy = (iso?: string | null) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const errMsg = (e: any, fallback: string) => e?.response?.data?.error || fallback

const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap'
const td = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-200'
const btn = 'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50'
const btnPrimary = `${btn} bg-primary-600 text-white hover:bg-primary-700`
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700`
const btnDanger = `${btn} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20`
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1'

const Badge = ({ text, cls }: { text: string; cls: string }) => (
  <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>
)

function ReasonModal({ title, onClose, onSubmit }: { title: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <AccessibleModal
      isOpen
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Batal</button>
          <button
            type="button"
            className={btnDanger}
            disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); try { await onSubmit(reason.trim()) } finally { setBusy(false) } }}
          >
            Tolak
          </button>
        </div>
      }
    >
      <label className={label}>Alasan penolakan (wajib)</label>
      <textarea className="input-field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
    </AccessibleModal>
  )
}

interface TxFormProps {
  fund: any
  categories: string[]
  editing: any | null
  onClose: () => void
  onSaved: () => void
}

function TxForm({ fund, categories, editing, onClose, onSaved }: TxFormProps) {
  const [f, setF] = useState({
    requester_employee_id: editing?.requester_employee_id || null as number | null,
    requester_name: editing?.requester_name || '',
    department: editing?.department || '',
    purpose: editing?.purpose || '',
    category: editing?.category || '',
    amount: editing ? String(editing.amount) : '',
    receipt_number: editing?.receipt_number || '',
    request_date: editing?.request_date || ymd(new Date()),
  })
  const [suggest, setSuggest] = useState<any[]>([])
  const [picked, setPicked] = useState(!!editing?.requester_employee_id)
  const [busy, setBusy] = useState(false)
  const debounced = useDebounce(f.requester_name, 300)
  const limit = Number(fund?.per_txn_limit || 0)
  const over = Number(f.amount) > limit

  useEffect(() => {
    if (picked || debounced.trim().length < 2) { setSuggest([]); return }
    axiosInstance.get(`${API}/employees`, { params: { q: debounced.trim() } })
      .then((r) => setSuggest(r.data?.employees || []))
      .catch(() => setSuggest([]))
  }, [debounced, picked])

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))
  const pick = (e: any) => {
    setPicked(true)
    setSuggest([])
    setF((p) => ({ ...p, requester_employee_id: e.id, requester_name: e.name, department: e.department || p.department }))
  }

  const save = async () => {
    if (!f.requester_name.trim()) return showError('Isi siapa yang meminta')
    if (!f.purpose.trim()) return showError('Isi untuk apa pengeluaran ini')
    if (!f.category) return showError('Pilih kategori')
    if (!(Number(f.amount) > 0)) return showError('Isi jumlah')
    if (over) return showError(`Melebihi batas per transaksi ${rp(limit)}`)
    if (!f.receipt_number.trim()) return showError('Nomor nota wajib diisi')
    setBusy(true)
    try {
      const body = { ...f, amount: Number(f.amount), requester_employee_id: f.requester_employee_id || undefined }
      if (editing) await axiosInstance.put(`${API}/transactions/${editing.id}`, body)
      else await axiosInstance.post(`${API}/transactions`, body)
      showSuccess(editing ? 'Permintaan diperbarui' : 'Permintaan dibuat, menunggu Plant Manager')
      onSaved()
    } catch (e: any) {
      showError(errMsg(e, 'Gagal menyimpan permintaan'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccessibleModal
      isOpen
      onClose={onClose}
      title={editing ? `Ubah ${editing.number}` : 'Buat Permintaan Kas Kecil'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Batal</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative">
          <label className={label}>Diminta oleh *</label>
          <input
            className="input-field"
            value={f.requester_name}
            onChange={(e) => { setPicked(false); setF((p) => ({ ...p, requester_name: e.target.value, requester_employee_id: null })) }}
            placeholder="Ketik nama karyawan"
          />
          {suggest.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
              {suggest.map((e) => (
                <li key={e.id}>
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => pick(e)}>
                    {e.name}{e.department ? <span className="text-gray-500 dark:text-gray-400"> - {e.department}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className={label}>Departemen</label>
          <input className="input-field" value={f.department} onChange={(e) => set('department', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Untuk apa *</label>
          <textarea className="input-field" rows={2} value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Jelaskan keperluan pengeluaran" />
        </div>
        <div>
          <label className={label}>Kategori *</label>
          <select className="input-field" value={f.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">- Pilih kategori -</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Tanggal *</label>
          <input type="date" className="input-field" value={f.request_date} onChange={(e) => set('request_date', e.target.value)} />
        </div>
        <div>
          <label className={label}>Jumlah (Rp) *</label>
          <NumberInput currency className="input-field text-right" value={f.amount} onChange={(e: any) => set('amount', e.target.value)} />
          <p className={`mt-1 text-xs ${over ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
            Maksimal {rp(limit)} per transaksi{over ? ', jumlah ini melebihi batas' : ''}
          </p>
        </div>
        <div>
          <label className={label}>Nomor nota *</label>
          <input className="input-field" value={f.receipt_number} onChange={(e) => set('receipt_number', e.target.value)} />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Nomor yang tertera di nota atau kwitansi. Satu nomor nota hanya bisa dipakai sekali.</p>
        </div>
      </div>
    </AccessibleModal>
  )
}

export default function PettyCash() {
  const perms = usePermissions()
  const can = (p: string) => perms.isSuperAdmin || perms.hasPermission(p)
  const canManage = can('petty_cash.manage')
  const canCreate = can('petty_cash.create')
  const canReplenishApprove = can('petty_cash.replenish_approve')
  const canReport = can('petty_cash.report') || can('petty_cash.view')

  const allowed = useMemo(
    () => (['ringkasan', 'transaksi', 'pengisian', ...(canReport ? ['laporan'] : []), ...(canManage ? ['pengaturan'] : [])] as TabId[]),
    [canReport, canManage],
  )
  const [tab, setTab] = useUrlState<TabId>('tab', 'ringkasan', allowed)
  useBreadcrumbTrail(tab === 'ringkasan' ? [] : [{ label: TAB_LABEL[tab] }])

  const [fund, setFund] = useState<any>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadFund = useCallback(async () => {
    try {
      const r = await axiosInstance.get(`${API}/fund`)
      setFund(r.data)
    } catch (e: any) {
      showError(errMsg(e, 'Gagal memuat kas kecil'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFund()
    axiosInstance.get(`${API}/meta`).then((r) => setCategories(r.data?.categories || [])).catch(() => undefined)
  }, [loadFund])

  if (loading) return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Memuat...</div>
  if (!fund) return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Kas kecil belum disiapkan.</div>

  return (
    <div className="space-y-5 p-6">
      <PageHeader title="Kas Kecil" subtitle={`${fund.name}. Pemegang kas: ${fund.custodian_name || 'belum diatur'}. Penyetuju: ${fund.approver_name || 'belum diatur'}.`} />
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {allowed.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t
              ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === 'ringkasan' && <Ringkasan fund={fund} reload={loadFund} />}
      {tab === 'transaksi' && <Transaksi fund={fund} categories={categories} canCreate={canCreate} reload={loadFund} />}
      {tab === 'pengisian' && <Pengisian fund={fund} canApprove={canReplenishApprove} reload={loadFund} />}
      {tab === 'laporan' && <Laporan categories={categories} />}
      {tab === 'pengaturan' && canManage && <Pengaturan fund={fund} reload={loadFund} />}
    </div>
  )
}

function Ringkasan({ fund, reload }: { fund: any; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const lowBalance = fund.balance <= fund.min_balance
  const request = async () => {
    if (!(await confirmDialog(`Ajukan pengisian kembali ${rp(fund.suggested_replenishment)} ke Finance?`, { title: 'Pengisian Kembali', confirmText: 'Ajukan', danger: false }))) return
    setBusy(true)
    try {
      await axiosInstance.post(`${API}/replenishments`, {})
      showSuccess('Pengajuan pengisian kembali dikirim ke Finance')
      await reload()
    } catch (e: any) {
      showError(errMsg(e, 'Gagal mengajukan pengisian kembali'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-5">
      {fund.needs_replenishment && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">Perlu pengisian kembali: {REASON_LABEL[fund.replenishment_reason] || 'segera ajukan'}</p>
            <p className="text-sm text-red-700/80 dark:text-red-300/80">Jumlah yang disarankan {rp(fund.suggested_replenishment)} (dana tetap dikurangi saldo).</p>
          </div>
          {fund.can_pay && <button type="button" className={btnPrimary} disabled={busy} onClick={request}>Ajukan Pengisian Kembali</button>}
        </div>
      )}
      <KpiStrip
        items={[
          { label: 'Saldo sekarang', value: rp(fund.balance), tone: lowBalance ? 'bad' : null, hint: `Minimum ${rp(fund.min_balance)}` },
          { label: 'Dana tetap', value: rp(fund.fixed_amount) },
          { label: 'Batas per transaksi', value: rp(fund.per_txn_limit) },
          { label: 'Menunggu Plant Manager', value: rp(fund.waiting_approval), tone: fund.waiting_approval > 0 ? 'warn' : null },
          { label: 'Menunggu pencairan', value: rp(fund.waiting_payment), tone: fund.waiting_payment > 0 ? 'warn' : null },
        ]}
      />
      <Panel title="Pengisian kembali berjalan">
        {fund.open_replenishment_id ? (
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Ada pengajuan pengisian kembali senilai {rp(fund.open_replenishment_amount)} yang belum selesai. Lihat di tab Pengisian Kembali.
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tidak ada pengajuan yang berjalan. Pengeluaran yang sudah dicairkan dan belum tercakup pengisian: {rp(fund.unreplenished_paid)}.
          </p>
        )}
      </Panel>
      <Panel title="Aturan">
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
          <li>Maksimal {rp(fund.per_txn_limit)} per transaksi, dan setiap transaksi wajib punya nomor nota.</li>
          <li>Permintaan disetujui Plant Manager, lalu dicairkan oleh pemegang kas.</li>
          <li>Ajukan pengisian kembali bila saldo mencapai {rp(fund.min_balance)} atau kurang, atau pada akhir bulan, mana yang lebih dulu.</li>
        </ul>
      </Panel>
    </div>
  )
}

function Transaksi({ fund, categories, canCreate, reload }: { fund: any; categories: string[]; canCreate: boolean; reload: () => Promise<void> }) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [flt, setFlt] = useState({ status: '', category: '', date_from: '', date_to: '', q: '' })
  const [form, setForm] = useState<{ editing: any | null } | null>(null)
  const [rejecting, setRejecting] = useState<any | null>(null)
  const q = useDebounce(flt.q, 300)
  const PER = 50

  const load = useCallback(async () => {
    try {
      const params: any = { page, per_page: PER }
      if (flt.status) params.status = flt.status
      if (flt.category) params.category = flt.category
      if (flt.date_from) params.date_from = flt.date_from
      if (flt.date_to) params.date_to = flt.date_to
      if (q.trim()) params.q = q.trim()
      const r = await axiosInstance.get(`${API}/transactions`, { params })
      setRows(r.data?.transactions || [])
      setTotal(r.data?.total || 0)
    } catch (e: any) {
      showError(errMsg(e, 'Gagal memuat transaksi'))
    }
  }, [page, flt.status, flt.category, flt.date_from, flt.date_to, q])

  useEffect(() => { load() }, [load])

  const refresh = async () => { await Promise.all([load(), reload()]) }
  const act = async (t: any, path: string, okMsg: string, body: any = {}) => {
    try {
      await axiosInstance.post(`${API}/transactions/${t.id}/${path}`, body)
      showSuccess(okMsg)
      await refresh()
    } catch (e: any) {
      showError(errMsg(e, 'Aksi gagal'))
    }
  }
  const approve = async (t: any) => {
    if (await confirmDialog(`Setujui ${t.number} sebesar ${rp(t.amount)} untuk ${t.requester_name}?`, { title: 'Setujui permintaan', confirmText: 'Setujui', danger: false })) await act(t, 'approve', 'Permintaan disetujui')
  }
  const pay = async (t: any) => {
    if (await confirmDialog(`Cairkan ${rp(t.amount)} untuk ${t.number}? Saldo kas kecil akan berkurang.`, { title: 'Cairkan', confirmText: 'Cairkan', danger: false })) await act(t, 'pay', 'Kas dicairkan')
  }
  const cancel = async (t: any) => {
    if (await confirmDialog(`Batalkan ${t.number}?`, { title: 'Batalkan permintaan', confirmText: 'Batalkan' })) await act(t, 'cancel', 'Permintaan dibatalkan')
  }

  const setF = (k: string, v: string) => { setPage(1); setFlt((p) => ({ ...p, [k]: v })) }
  const pages = Math.max(1, Math.ceil(total / PER))

  return (
    <div className="space-y-4">
      <Panel
        title="Daftar permintaan"
        action={canCreate ? <button type="button" className={btnPrimary} onClick={() => setForm({ editing: null })}>Buat Permintaan</button> : undefined}
      >
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <select className="input-field" value={flt.status} onChange={(e) => setF('status', e.target.value)}>
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-field" value={flt.category} onChange={(e) => setF('category', e.target.value)}>
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" className="input-field" value={flt.date_from} onChange={(e) => setF('date_from', e.target.value)} aria-label="Dari tanggal" />
          <input type="date" className="input-field" value={flt.date_to} onChange={(e) => setF('date_to', e.target.value)} aria-label="Sampai tanggal" />
          <input className="input-field" value={flt.q} onChange={(e) => setF('q', e.target.value)} placeholder="Cari pemohon, keperluan, nota" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className={th}>No.</th><th className={th}>Tanggal</th><th className={th}>Pemohon</th><th className={th}>Departemen</th>
                <th className={th}>Untuk Apa</th><th className={th}>Kategori</th><th className={th}>No. Nota</th>
                <th className={`${th} text-right`}>Jumlah</th><th className={th}>Status</th><th className={th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className={`${td} whitespace-nowrap font-medium`}>{t.number}</td>
                  <td className={`${td} whitespace-nowrap`}>{dmy(t.request_date)}</td>
                  <td className={td}>{t.requester_name}</td>
                  <td className={td}>{t.department || '-'}</td>
                  <td className={`${td} max-w-xs`}>
                    {t.purpose}
                    {t.rejection_reason && <p className="text-xs text-red-600 dark:text-red-400">Ditolak: {t.rejection_reason}</p>}
                  </td>
                  <td className={td}>{t.category}</td>
                  <td className={`${td} whitespace-nowrap`}>{t.receipt_number}</td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{rp(t.amount)}</td>
                  <td className={td}><Badge text={STATUS_LABEL[t.status] || t.status} cls={STATUS_CLASS[t.status] || STATUS_CLASS.cancelled} /></td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {fund.can_approve && t.status === 'submitted' && <button type="button" className={btnPrimary} onClick={() => approve(t)}>Setujui</button>}
                      {fund.can_approve && (t.status === 'submitted' || t.status === 'approved') && <button type="button" className={btnDanger} onClick={() => setRejecting(t)}>Tolak</button>}
                      {fund.can_pay && t.status === 'approved' && <button type="button" className={btnPrimary} onClick={() => pay(t)}>Cairkan</button>}
                      {canCreate && t.status === 'submitted' && <button type="button" className={btnGhost} onClick={() => setForm({ editing: t })}>Ubah</button>}
                      {canCreate && (t.status === 'submitted' || t.status === 'approved') && <button type="button" className={btnGhost} onClick={() => cancel(t)}>Batalkan</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada permintaan.</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-600 dark:text-gray-300">
            <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
            <span>Halaman {page} dari {pages}</span>
            <button type="button" className={btnGhost} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
          </div>
        )}
      </Panel>
      {form && <TxForm fund={fund} categories={categories} editing={form.editing} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await refresh() }} />}
      {rejecting && (
        <ReasonModal
          title={`Tolak ${rejecting.number}`}
          onClose={() => setRejecting(null)}
          onSubmit={async (reason) => { const t = rejecting; setRejecting(null); await act(t, 'reject', 'Permintaan ditolak', { reason }) }}
        />
      )}
    </div>
  )
}

function Pengisian({ fund, canApprove, reload }: { fund: any; canApprove: boolean; reload: () => Promise<void> }) {
  const [rows, setRows] = useState<any[]>([])
  const load = useCallback(async () => {
    try {
      const r = await axiosInstance.get(`${API}/replenishments`)
      setRows(r.data?.replenishments || [])
    } catch (e: any) {
      showError(errMsg(e, 'Gagal memuat pengisian kembali'))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (r: any, path: string, okMsg: string) => {
    try {
      await axiosInstance.post(`${API}/replenishments/${r.id}/${path}`, {})
      showSuccess(okMsg)
      await Promise.all([load(), reload()])
    } catch (e: any) {
      showError(errMsg(e, 'Aksi gagal'))
    }
  }
  const approve = async (r: any) => {
    if (await confirmDialog(`Setujui pengisian kembali ${rp(r.amount_requested)} (${r.number})?`, { title: 'Setujui pengisian kembali', confirmText: 'Setujui', danger: false })) await act(r, 'approve', 'Pengisian kembali disetujui')
  }
  const receive = async (r: any) => {
    if (await confirmDialog(`Konfirmasi dana ${rp(r.amount_requested)} sudah diterima?`, { title: 'Terima dana', confirmText: 'Dana diterima', danger: false })) await act(r, 'receive', 'Dana diterima, saldo bertambah')
  }

  return (
    <Panel title="Pengisian kembali ke Finance">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className={th}>No.</th><th className={th}>Tanggal</th><th className={th}>Alasan</th>
              <th className={`${th} text-right`}>Saldo saat diajukan</th><th className={`${th} text-right`}>Jumlah diminta</th>
              <th className={th}>Status</th><th className={th}>No. transaksi dicakup</th><th className={th}>Disetujui</th><th className={th}>Diterima</th><th className={th}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap font-medium`}>{r.number}</td>
                <td className={`${td} whitespace-nowrap`}>{dmy(r.request_date)}</td>
                <td className={td}>{REASON_LABEL[r.reason] || r.reason}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{rp(r.balance_at_request)}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{rp(r.amount_requested)}</td>
                <td className={td}><Badge text={REP_LABEL[r.status] || r.status} cls={REP_CLASS[r.status] || STATUS_CLASS.cancelled} /></td>
                <td className={`${td} max-w-xs text-xs`}>{r.transaction_numbers?.length ? r.transaction_numbers.join(', ') : '-'}</td>
                <td className={`${td} whitespace-nowrap`}>{r.approved_by_name ? `${r.approved_by_name}, ${dmy(r.approved_at)}` : '-'}</td>
                <td className={`${td} whitespace-nowrap`}>{r.received_at ? `${rp(r.amount_received)}, ${dmy(r.received_at)}` : '-'}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {canApprove && r.status === 'requested' && <button type="button" className={btnPrimary} onClick={() => approve(r)}>Setujui</button>}
                    {fund.can_pay && r.status === 'approved' && <button type="button" className={btnPrimary} onClick={() => receive(r)}>Terima Dana</button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada pengajuan pengisian kembali.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Laporan({ categories }: { categories: string[] }) {
  const now = new Date()
  const [flt, setFlt] = useState({
    date_from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    date_to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    category: '',
    status: '',
  })
  const [data, setData] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const params: any = { date_from: flt.date_from, date_to: flt.date_to }
      if (flt.category) params.category = flt.category
      if (flt.status) params.status = flt.status
      const r = await axiosInstance.get(`${API}/report`, { params })
      setData(r.data)
    } catch (e: any) {
      showError(errMsg(e, 'Gagal memuat laporan'))
    } finally {
      setBusy(false)
    }
  }, [flt.date_from, flt.date_to, flt.category, flt.status])

  useEffect(() => { load() }, [load])

  const approver = (t: any) => (t.approved_by_name ? `${t.approved_by_name}, ${dmy(t.approved_at)}` : '-')
  const payer = (t: any) => (t.paid_by_name ? `${t.paid_by_name}, ${dmy(t.paid_at)}` : '-')

  const exportExcel = () => {
    if (!data) return
    const head = ['No. Transaksi', 'Tanggal', 'Pemohon', 'Departemen', 'Untuk Apa', 'Kategori', 'No. Nota', 'Jumlah', 'Status',
      'Disetujui oleh', 'Tanggal Persetujuan', 'Dicairkan oleh', 'Tanggal Pencairan', 'No. Pengisian']
    const body = (data.transactions as any[]).map((t) => [
      t.number, dmy(t.request_date), t.requester_name, t.department || '', t.purpose, t.category, t.receipt_number, Number(t.amount),
      STATUS_LABEL[t.status] || t.status, t.approved_by_name || '', t.approved_at ? dmy(t.approved_at) : '',
      t.paid_by_name || '', t.paid_at ? dmy(t.paid_at) : '', t.replenishment_number || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([head, ...body, [], ['Total (tidak termasuk ditolak/batal)', '', '', '', '', '', '', Number(data.total_counted)]])
    ws['!cols'] = [18, 12, 22, 16, 40, 28, 16, 16, 24, 20, 18, 20, 16, 16].map((wch) => ({ wch }))
    const s = data.summary || {}
    const sum: any[][] = [
      ['Kas Kecil', data.fund?.name || ''],
      ['Periode', `${dmy(flt.date_from)} s/d ${dmy(flt.date_to)}`],
      [],
      ['Saldo sekarang', Number(s.balance || 0)],
      ['Dana tetap', Number(s.fixed_amount || 0)],
      ['Total dicairkan (seluruh waktu)', Number(s.total_paid || 0)],
      [],
      ['Per kategori', 'Jumlah'],
      ...(data.by_category as any[]).map((c) => [c.name, Number(c.amount)]),
      [],
      ['Per pemohon', 'Jumlah'],
      ...(data.by_requester as any[]).map((c) => [c.name, Number(c.amount)]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(sum)
    ws2['!cols'] = [{ wch: 36 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan')
    XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan')
    XLSX.writeFile(wb, `Kas_Kecil_${flt.date_from}_${flt.date_to}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <Panel title="Filter laporan" action={<button type="button" className={btnPrimary} disabled={!data || busy} onClick={exportExcel}>Ekspor Excel</button>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className={label}>Dari tanggal</label>
            <input type="date" className="input-field" value={flt.date_from} onChange={(e) => setFlt((p) => ({ ...p, date_from: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Sampai tanggal</label>
            <input type="date" className="input-field" value={flt.date_to} onChange={(e) => setFlt((p) => ({ ...p, date_to: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Kategori</label>
            <select className="input-field" value={flt.category} onChange={(e) => setFlt((p) => ({ ...p, category: e.target.value }))}>
              <option value="">Semua kategori</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select className="input-field" value={flt.status} onChange={(e) => setFlt((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Semua (kecuali batal)</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </Panel>

      {data && (
        <>
          <KpiStrip
            items={[
              { label: 'Jumlah transaksi', value: data.count },
              { label: 'Total pengeluaran', value: rp(data.total_counted), hint: 'Tidak termasuk ditolak dan batal' },
              { label: 'Saldo sekarang', value: rp(data.summary?.balance) },
            ]}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel title="Per kategori">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(data.by_category as any[]).map((c) => (
                    <tr key={c.name}><td className={td}>{c.name}</td><td className={`${td} text-right tabular-nums`}>{rp(c.amount)}</td></tr>
                  ))}
                  {data.by_category.length === 0 && <tr><td className={td}>Tidak ada data.</td></tr>}
                </tbody>
              </table>
            </Panel>
            <Panel title="Per pemohon">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(data.by_requester as any[]).map((c) => (
                    <tr key={c.name}><td className={td}>{c.name}</td><td className={`${td} text-right tabular-nums`}>{rp(c.amount)}</td></tr>
                  ))}
                  {data.by_requester.length === 0 && <tr><td className={td}>Tidak ada data.</td></tr>}
                </tbody>
              </table>
            </Panel>
          </div>
          <Panel title="Rincian transaksi">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className={th}>No. Transaksi</th><th className={th}>Tanggal</th><th className={th}>Pemohon</th><th className={th}>Departemen</th>
                    <th className={th}>Untuk Apa</th><th className={th}>Kategori</th><th className={th}>No. Nota</th><th className={`${th} text-right`}>Jumlah</th>
                    <th className={th}>Status</th><th className={th}>Disetujui oleh</th><th className={th}>Dicairkan oleh</th><th className={th}>No. Pengisian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(data.transactions as any[]).map((t) => (
                    <tr key={t.id}>
                      <td className={`${td} whitespace-nowrap font-medium`}>{t.number}</td>
                      <td className={`${td} whitespace-nowrap`}>{dmy(t.request_date)}</td>
                      <td className={td}>{t.requester_name}</td>
                      <td className={td}>{t.department || '-'}</td>
                      <td className={`${td} max-w-xs`}>{t.purpose}</td>
                      <td className={td}>{t.category}</td>
                      <td className={`${td} whitespace-nowrap`}>{t.receipt_number}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{rp(t.amount)}</td>
                      <td className={td}><Badge text={STATUS_LABEL[t.status] || t.status} cls={STATUS_CLASS[t.status] || STATUS_CLASS.cancelled} /></td>
                      <td className={`${td} whitespace-nowrap`}>{approver(t)}</td>
                      <td className={`${td} whitespace-nowrap`}>{payer(t)}</td>
                      <td className={`${td} whitespace-nowrap`}>{t.replenishment_number || '-'}</td>
                    </tr>
                  ))}
                  {data.transactions.length === 0 && <tr><td colSpan={12} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Tidak ada transaksi pada filter ini.</td></tr>}
                </tbody>
                {data.transactions.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-300 dark:border-gray-600">
                      <td className={`${td} font-semibold`} colSpan={7}>Total (tidak termasuk ditolak/batal)</td>
                      <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums`}>{rp(data.total_counted)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

function Pengaturan({ fund, reload }: { fund: any; reload: () => Promise<void> }) {
  const [users, setUsers] = useState<any[]>([])
  const [f, setF] = useState({
    fixed_amount: String(fund.fixed_amount),
    per_txn_limit: String(fund.per_txn_limit),
    min_balance: String(fund.min_balance),
    custodian_user_id: fund.custodian_user_id ? String(fund.custodian_user_id) : '',
    approver_user_id: fund.approver_user_id ? String(fund.approver_user_id) : '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    axiosInstance.get(`${API}/users`).then((r) => setUsers(r.data?.users || [])).catch(() => showError('Gagal memuat daftar pengguna'))
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      await axiosInstance.put(`${API}/fund`, {
        fixed_amount: Number(f.fixed_amount),
        per_txn_limit: Number(f.per_txn_limit),
        min_balance: Number(f.min_balance),
        custodian_user_id: f.custodian_user_id ? Number(f.custodian_user_id) : null,
        approver_user_id: f.approver_user_id ? Number(f.approver_user_id) : null,
      })
      showSuccess('Pengaturan kas kecil disimpan')
      await reload()
    } catch (e: any) {
      showError(errMsg(e, 'Gagal menyimpan pengaturan'))
    } finally {
      setBusy(false)
    }
  }

  const userSelect = (key: 'custodian_user_id' | 'approver_user_id') => (
    <select className="input-field" value={f[key]} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}>
      <option value="">- Belum diatur -</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.username ? ` (${u.username})` : ''}</option>)}
    </select>
  )

  return (
    <Panel title="Pengaturan kas kecil" action={<button type="button" className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Dana tetap (Rp)</label>
          <NumberInput currency className="input-field text-right" value={f.fixed_amount} onChange={(e: any) => setF((p) => ({ ...p, fixed_amount: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Batas per transaksi (Rp)</label>
          <NumberInput currency className="input-field text-right" value={f.per_txn_limit} onChange={(e: any) => setF((p) => ({ ...p, per_txn_limit: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Batas saldo minimum (Rp)</label>
          <NumberInput currency className="input-field text-right" value={f.min_balance} onChange={(e: any) => setF((p) => ({ ...p, min_balance: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Pemegang kas</label>
          {userSelect('custodian_user_id')}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Hanya pengguna ini yang bisa mencairkan dan mengajukan pengisian kembali.</p>
        </div>
        <div>
          <label className={label}>Penyetuju (Plant Manager)</label>
          {userSelect('approver_user_id')}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Hanya pengguna ini yang bisa menyetujui atau menolak permintaan.</p>
        </div>
      </div>
    </Panel>
  )
}
