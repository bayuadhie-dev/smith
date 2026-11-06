import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../utils/axiosConfig'
import confirmDialog from './ui/ConfirmDialog'
import { showError, showSuccess } from './ui/Toast'

interface Props {
  docType: 'purchase_order' | 'grn' | 'purchase_invoice' | 'sales_invoice' | 'payment' | 'purchase_down_payment'
  docId: number | string | undefined
  number: string
  listPath: string
  onChanged?: () => void
}

export default function DocActions({ docType, docId, number, listPath, onChanged }: Props) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(number)
  const [busy, setBusy] = useState(false)
  const [reasons, setReasons] = useState<string[] | null>(null)

  useEffect(() => { setValue(number) }, [number])
  useEffect(() => {
    if (!docId) return
    axiosInstance.get(`/api/doc-actions/${docType}/${docId}/can-delete`)
      .then((r) => setReasons(r.data.can_delete ? [] : (r.data.reasons || [])))
      .catch(() => setReasons(null))
  }, [docType, docId])

  const saveNumber = async () => {
    if (!value.trim() || value.trim() === number) { setEditing(false); return }
    setBusy(true)
    try {
      await axiosInstance.put(`/api/doc-actions/${docType}/${docId}/number`, { number: value.trim() })
      showSuccess('Nomor diubah')
      setEditing(false)
      onChanged ? onChanged() : window.location.reload()
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal mengubah nomor')
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!(await confirmDialog(`Hapus ${number}? Dokumen yang belum dipakai akan dihapus permanen.`, { confirmText: 'Hapus' }))) return
    setBusy(true)
    try {
      await axiosInstance.delete(`/api/doc-actions/${docType}/${docId}`)
      showSuccess('Dokumen dihapus')
      navigate(listPath)
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal menghapus')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <>
          <input className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveNumber() }} />
          <button type="button" disabled={busy} onClick={saveNumber} className="rounded-md bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50">Simpan</button>
          <button type="button" onClick={() => { setEditing(false); setValue(number) }} className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-600 dark:text-gray-200">Batal</button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Ubah nomor</button>
      )}
      {reasons !== null && (
        reasons.length === 0
          ? <button type="button" disabled={busy} onClick={remove} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Hapus</button>
          : <span className="text-xs text-gray-500" title={reasons.join('; ')}>Tidak bisa dihapus: {reasons[0]}</span>
      )}
    </div>
  )
}
