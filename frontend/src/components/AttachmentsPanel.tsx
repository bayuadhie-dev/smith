import { useEffect, useRef, useState } from 'react'
import axiosInstance from '../utils/axiosConfig'
import toast from 'react-hot-toast'

interface Att { id: number; filename: string; file_size: number | null; mime_type: string | null; created_at: string | null }

const sizeLabel = (n: number | null) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function AttachmentsPanel({ entityType, entityId }: { entityType: string; entityId: number | string | undefined }) {
  const [items, setItems] = useState<Att[]>([])
  const eid = entityId ? Number(entityId) : 0

  useEffect(() => {
    if (!eid) return
    axiosInstance.get('/api/attachments', { params: { entity_type: entityType, entity_id: eid } })
      .then((r) => setItems(r.data.attachments || []))
      .catch(() => setItems([]))
  }, [entityType, eid])

  const download = async (a: Att) => {
    try {
      const r = await axiosInstance.get(`/api/attachments/${a.id}/file`, { params: { download: 1 }, responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const link = document.createElement('a')
      link.href = url; link.download = a.filename
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch { toast.error('Gagal mengunduh lampiran') }
  }

  if (!eid || items.length === 0) return null
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Lampiran ({items.length})</h3>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between py-2 text-sm">
            <span className="truncate text-gray-800 dark:text-gray-200">{a.filename}</span>
            <span className="flex items-center gap-3 shrink-0 text-gray-500 dark:text-gray-400">
              <span>{sizeLabel(a.file_size)}</span>
              <span>{a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : ''}</span>
              <button type="button" onClick={() => download(a)} className="text-blue-600 hover:underline dark:text-blue-400">Unduh</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export async function uploadAttachments(entityType: string, entityId: number | string | undefined, files: File[]) {
  if (!entityId || !files.length) return
  try {
    for (const f of files) {
      const fd = new FormData()
      fd.append('entity_type', entityType); fd.append('entity_id', String(entityId)); fd.append('file', f)
      await axiosInstance.post('/api/attachments', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
  } catch (e: any) {
    toast.error('Dokumen tersimpan, tapi sebagian lampiran gagal diunggah: ' + (e?.response?.data?.error || 'coba unggah ulang dari halaman detail'))
  }
}

interface Existing { id: number; filename: string; file_size: number | null }

export function PendingAttachments({ files, onChange, entityType, entityId }: { files: File[]; onChange: (f: File[]) => void; entityType?: string; entityId?: number | string }) {
  const input = useRef<HTMLInputElement>(null)
  const [existing, setExisting] = useState<Existing[]>([])
  const eid = entityId ? Number(entityId) : 0
  useEffect(() => {
    if (!entityType || !eid) return
    axiosInstance.get('/api/attachments', { params: { entity_type: entityType, entity_id: eid } })
      .then((r) => setExisting(r.data.attachments || []))
      .catch(() => setExisting([]))
  }, [entityType, eid])
  const removeExisting = async (a: Existing) => {
    if (!window.confirm(`Hapus lampiran "${a.filename}"?`)) return
    try { await axiosInstance.delete(`/api/attachments/${a.id}`); setExisting((x) => x.filter((y) => y.id !== a.id)) } catch { toast.error('Gagal menghapus lampiran') }
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lampiran ({existing.length + files.length})</h3>
        <button type="button" onClick={() => input.current?.click()}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
          Tambah dokumen / foto
        </button>
        <input ref={input} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={(e) => { onChange([...files, ...Array.from(e.target.files || [])]); if (input.current) input.current.value = '' }} />
      </div>
      {existing.length + files.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Opsional. Diunggah otomatis saat disimpan. Maksimal 10 MB per file.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {existing.map((a) => (
            <li key={`e${a.id}`} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate text-gray-800 dark:text-gray-200">{a.filename}</span>
              <span className="flex items-center gap-3 shrink-0 text-gray-500 dark:text-gray-400">
                <span>{sizeLabel(a.file_size)}</span>
                <button type="button" onClick={() => removeExisting(a)} className="text-red-600 hover:underline dark:text-red-400">Hapus</button>
              </span>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate text-gray-800 dark:text-gray-200">{f.name} <span className="text-xs text-green-700 dark:text-green-300">(baru)</span></span>
              <span className="flex items-center gap-3 shrink-0 text-gray-500 dark:text-gray-400">
                <span>{sizeLabel(f.size)}</span>
                <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-red-600 hover:underline dark:text-red-400">Hapus</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
