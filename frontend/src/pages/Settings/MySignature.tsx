import { useCallback, useEffect, useRef, useState } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { confirmDialog, showError, showSuccess } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

const W = 560
const H = 200

const MySignature = () => {
  useDocumentTitle('Tanda Tangan Saya')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [hasSig, setHasSig] = useState(false)

  const loadCurrent = useCallback(async () => {
    try {
      const me = await axiosInstance.get('/api/signatures/me')
      setHasSig(!!me.data.has_signature)
      if (me.data.has_signature) {
        const r = await axiosInstance.get('/api/signatures/me/image', { responseType: 'blob' })
        setCurrent((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(r.data) })
      } else setCurrent(null)
    } catch { setCurrent(null) }
  }, [])

  useEffect(() => { loadCurrent() }, [loadCurrent])

  const ctx = () => {
    const c = canvasRef.current!.getContext('2d')!
    c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#111827'
    return c
  }
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = pos(e); const c = ctx(); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 0.1, p.y + 0.1); c.stroke()
    setDirty(true)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const p = pos(e); const c = ctx(); c.lineTo(p.x, p.y); c.stroke()
  }
  const up = () => { drawing.current = false }
  const clear = () => { canvasRef.current!.getContext('2d')!.clearRect(0, 0, W, H); setDirty(false) }

  const save = async (payload: any, config?: any) => {
    setSaving(true)
    try {
      await axiosInstance.put('/api/signatures/me', payload, config)
      showSuccess('Tanda tangan disimpan.')
      clear(); await loadCurrent()
    } catch (e: any) { showError(e.response?.data?.error || 'Gagal menyimpan tanda tangan.') }
    finally { setSaving(false) }
  }

  const saveDrawn = () => save({ image: canvasRef.current!.toDataURL('image/png') })
  const upload = (f: File | undefined) => {
    if (!f) return
    if (f.size > 1024 * 1024) return showError('Ukuran gambar maksimal 1 MB.')
    const fd = new FormData(); fd.append('file', f)
    save(fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  }
  const remove = async () => {
    if (!(await confirmDialog('Hapus tanda tangan Anda? Dokumen yang sudah tercetak tidak berubah, dokumen baru akan memakai ruang tanda tangan kosong.'))) return
    try { await axiosInstance.delete('/api/signatures/me'); showSuccess('Tanda tangan dihapus.'); setHasSig(false); setCurrent(null) }
    catch (e: any) { showError(e.response?.data?.error || 'Gagal menghapus.') }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <PageHeader title="Tanda Tangan Saya" subtitle="Dipakai pada blok Dibuat oleh / Disetujui oleh di dokumen cetak (PO, faktur, surat jalan) saat dokumen dibuat atau disetujui oleh Anda." />

      <Panel title="Tanda tangan saat ini">
        <div className="p-4">
          {current ? (
            <div className="flex flex-wrap items-center gap-4">
              <img src={current} alt="Tanda tangan" className="h-24 rounded border border-gray-200 bg-white p-2 dark:border-gray-600" />
              <button onClick={remove} className="text-sm font-medium text-red-600 hover:underline">Hapus</button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{hasSig ? 'Memuat...' : 'Belum ada. Dokumen akan memakai ruang kosong untuk tanda tangan basah.'}</p>
          )}
        </div>
      </Panel>

      <Panel title="Gambar tanda tangan baru">
        <div className="space-y-3 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Tanda tangani di kotak dengan jari atau mouse.</p>
          <canvas
            ref={canvasRef} width={W} height={H}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            className="w-full touch-none rounded border border-dashed border-gray-400 bg-white"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={saveDrawn} disabled={!dirty || saving} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan tanda tangan'}</button>
            <button onClick={clear} disabled={!dirty} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">Ulangi</button>
          </div>
        </div>
      </Panel>

      <Panel title="Atau unggah gambar">
        <div className="space-y-2 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">PNG atau JPEG, maksimal 1 MB. PNG dengan latar transparan paling rapi saat dicetak.</p>
          <input type="file" accept="image/png,image/jpeg" disabled={saving} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} className="text-sm" />
        </div>
      </Panel>
    </div>
  )
}

export default MySignature
