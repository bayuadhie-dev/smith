import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import axiosInstance from '../utils/axiosConfig'
import { showError, showSuccess } from './ui/Toast'

/**
 * Impor Excel langsung di halaman masternya, bukan dengan melempar orang ke
 * Pusat Impor dan menyuruh mencari jenis datanya sendiri. Berkas yang dipilih
 * langsung diperiksa (tanpa menulis apa pun) dan hasilnya ditampilkan baris per
 * baris, jadi orang melihat apa yang akan terjadi sebelum menekan Simpan.
 *
 * Generik untuk semua jenis di Pusat Impor: bentuk tabel pratinjau diambil dari
 * `summary_columns` milik jenisnya, jadi master berikutnya tinggal memasang
 * komponen ini dengan `kind` yang lain.
 */

interface Kolom { field: string; label: string; required: boolean }
interface KolomRingkas { key: string; label: string; type: string }
interface Jenis {
  key: string
  label: string
  description: string
  can_import: boolean
  can_export: boolean
  columns: Kolom[]
  summary_columns: KolomRingkas[]
}
interface Baris {
  key: string
  number: string | null
  rows: number[]
  errors: string[]
  created: string | null
  summary: Record<string, any> | null
}
interface Hasil {
  committed: boolean
  transactions: Baris[]
  summary: { total: number; ok: number; error: number; amount: number }
}

interface Props {
  kind: string
  /** Kata benda jamak untuk kalimat hasil, mis. "karyawan". */
  satuan?: string
  open: boolean
  onClose: () => void
  /** Dipanggil setelah ada yang benar-benar tersimpan, untuk memuat ulang daftar. */
  onSaved?: () => void
}

const unduh = (data: Blob, nama: string) => {
  const url = window.URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

/** Pesan galat dari respons blob (ekspor/template gagal) tetap JSON di dalamnya. */
const pesanGalat = async (e: any, bawaan: string) => {
  try {
    return JSON.parse(await e.response.data.text()).error || bawaan
  } catch {
    return e?.response?.data?.error || bawaan
  }
}

const ImportExcelModal: React.FC<Props> = ({ kind, satuan = 'baris', open, onClose, onSaved }) => {
  const [jenis, setJenis] = useState<Jenis | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [sibuk, setSibuk] = useState<'periksa' | 'simpan' | null>(null)
  const [seret, setSeret] = useState(false)
  const [sembunyikanDilewati, setSembunyikanDilewati] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    axiosInstance.get('/api/imports/kinds')
      .then((r) => setJenis((r.data.kinds || []).find((k: Jenis) => k.key === kind) || null))
      .catch(() => showError('Gagal memuat keterangan impor'))
  }, [open, kind])

  // Tutup = mulai bersih. Hasil pemeriksaan berkas lama tidak boleh ikut terbawa.
  useEffect(() => {
    if (!open) { setFile(null); setHasil(null); setSibuk(null); setSeret(false); setSembunyikanDilewati(false) }
  }, [open])

  const kirim = useCallback(async (berkas: File, simpan: boolean) => {
    setSibuk(simpan ? 'simpan' : 'periksa')
    try {
      const form = new FormData()
      form.append('file', berkas)
      form.append('commit', simpan ? '1' : '0')
      const r = await axiosInstance.post(`/api/imports/${kind}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setHasil(r.data)
      if (simpan) {
        showSuccess(`${r.data.summary.ok} ${satuan} tersimpan${r.data.summary.error ? `, ${r.data.summary.error} dilewati` : ''}`)
        onSaved?.()
      }
    } catch (e: any) {
      setHasil(null)
      showError(e?.response?.data?.error || 'Berkas tidak bisa diproses')
    } finally {
      setSibuk(null)
    }
  }, [kind, satuan, onSaved])

  const pilihBerkas = (f: File | null) => {
    setFile(f)
    setHasil(null)
    if (f) kirim(f, false)        // langsung diperiksa, orang tidak perlu menekan tombol lagi
  }

  const unduhTemplate = async () => {
    try {
      const r = await axiosInstance.get(`/api/imports/${kind}/template`, { responseType: 'blob' })
      unduh(r.data, `template_impor_${kind}.xlsx`)
    } catch (e) {
      showError(await pesanGalat(e, 'Gagal mengunduh template'))
    }
  }

  const unduhMasalah = () => {
    if (!hasil) return
    const baris = ['Baris,Nomor,Masalah']
    hasil.transactions.filter((t) => t.errors.length).forEach((t) => {
      baris.push([t.rows.join(' '), t.number || '', t.errors.join('; ')]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })
    unduh(new Blob(['﻿' + baris.join('\n')], { type: 'text/csv;charset=utf-8' }), `masalah_impor_${kind}.csv`)
  }

  if (!open) return null

  const ok = hasil?.summary.ok ?? 0
  const kolomRingkas = jenis?.summary_columns || []

  // Jenis yang punya kolom "Tindakan" (mis. karyawan: baru vs dilengkapi) dipecah
  // per tindakan supaya hasil pemeriksaan terbaca tanpa menghitung baris sendiri.
  const rincianTindakan = hasil && kolomRingkas.some((c) => c.key === 'action')
    ? hasil.transactions.filter((t) => !t.errors.length).reduce<Record<string, number>>((acc, t) => {
        const nama = String(t.summary?.action || '-').split(':')[0].trim()
        acc[nama] = (acc[nama] || 0) + 1
        return acc
      }, {})
    : null

  // Yang akan tersimpan didahulukan. Pada berkas hasil ekspor, baris yang
  // dilewati bisa ratusan dan menenggelamkan segelintir yang benar-benar berubah.
  const barisTampil = hasil
    ? [...hasil.transactions]
        .filter((t) => !(sembunyikanDilewati && t.errors.length))
        .sort((a, b) => (a.errors.length ? 1 : 0) - (b.errors.length ? 1 : 0))
    : []

  const sel = (t: Baris, c: KolomRingkas) => {
    const v = t.summary?.[c.key]
    return v === undefined || v === null || v === '' ? '-' : String(v)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-5xl rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold">Impor {jenis?.label || ''} dari Excel</h3>
            {jenis?.description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{jenis.description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">Tutup</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <ol className="grid gap-3 sm:grid-cols-3">
            <li className="rounded-lg border p-3 dark:border-gray-700">
              <p className="fn-label mb-1">Langkah 1</p>
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Unduh templatenya, isi di Excel.</p>
              <button type="button" onClick={unduhTemplate}
                className="inline-flex items-center gap-1.5 rounded border border-emerald-600 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
                <ArrowDownTrayIcon className="h-4 w-4" /> Unduh Template
              </button>
            </li>
            <li className="rounded-lg border p-3 dark:border-gray-700">
              <p className="fn-label mb-1">Langkah 2</p>
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Pilih berkasnya. Langsung diperiksa, belum disimpan.</p>
              <input ref={input} type="file" accept=".xlsx,.csv" className="hidden"
                onChange={(e) => pilihBerkas(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => input.current?.click()}
                className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
                <ArrowUpTrayIcon className="h-4 w-4" /> {file ? 'Ganti berkas' : 'Pilih berkas'}
              </button>
            </li>
            <li className="rounded-lg border p-3 dark:border-gray-700">
              <p className="fn-label mb-1">Langkah 3</p>
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Lihat hasil pemeriksaan, lalu simpan.</p>
              <button type="button" disabled={!hasil || hasil.committed || ok === 0 || sibuk !== null}
                onClick={() => file && kirim(file, true)}
                className="rounded bg-green-700 px-4 py-1.5 text-sm text-white hover:bg-green-800 disabled:opacity-40">
                {sibuk === 'simpan' ? 'Menyimpan...' : ok ? `Simpan ${ok} ${satuan}` : 'Simpan'}
              </button>
            </li>
          </ol>

          {!file && (
            <div
              onDragOver={(e) => { e.preventDefault(); setSeret(true) }}
              onDragLeave={() => setSeret(false)}
              onDrop={(e) => { e.preventDefault(); setSeret(false); pilihBerkas(e.dataTransfer.files?.[0] || null) }}
              onClick={() => input.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed py-10 text-center ${seret ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
              <DocumentArrowUpIcon className="h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Seret berkas .xlsx ke sini, atau klik untuk memilih</p>
            </div>
          )}

          {file && (
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Berkas: <span className="font-medium">{file.name}</span>
              {sibuk === 'periksa' && <span className="ml-2 text-gray-500">memeriksa...</span>}
            </p>
          )}

          {hasil && (
            <div className="space-y-2">
              <div className={`flex flex-wrap items-center gap-2 rounded p-3 text-sm ${hasil.summary.error ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'}`}>
                {hasil.summary.error ? <ExclamationTriangleIcon className="h-5 w-5 shrink-0" /> : <CheckCircleIcon className="h-5 w-5 shrink-0" />}
                <span>
                  {hasil.committed ? 'Sudah disimpan' : 'Hasil pemeriksaan — belum ada yang disimpan'}: {hasil.summary.total} baris,{' '}
                  {rincianTindakan && Object.keys(rincianTindakan).length
                    ? Object.entries(rincianTindakan).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')
                    : `${hasil.summary.ok} siap`}
                  {hasil.summary.error ? `, ${hasil.summary.error} dilewati` : ''}.
                </span>
                {hasil.summary.error > 0 && (
                  <button type="button" onClick={unduhMasalah}
                    className="ml-auto rounded border border-amber-600 px-2 py-1 text-xs hover:bg-amber-100 dark:hover:bg-amber-900/40">
                    Unduh daftar masalah (.csv)
                  </button>
                )}
              </div>

              {hasil.summary.error > 0 && hasil.summary.ok > 0 && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={sembunyikanDilewati} onChange={(e) => setSembunyikanDilewati(e.target.checked)} />
                  Sembunyikan {hasil.summary.error} baris yang dilewati
                </label>
              )}

              <div className="max-h-96 overflow-auto rounded border dark:border-gray-700">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Baris</th>
                      {kolomRingkas.map((c) => <th key={c.key} className="px-3 py-2 text-left font-medium">{c.label}</th>)}
                      <th className="px-3 py-2 text-left font-medium">Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barisTampil.map((t, i) => (
                      <tr key={i} className={`border-t align-top dark:border-gray-700 ${t.errors.length ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                        <td className="whitespace-nowrap px-3 py-1.5">{t.rows.join(', ')}</td>
                        {kolomRingkas.map((c, k) => (
                          // Kolom ringkas pertama itu penanda barisnya (nomor dokumen /
                          // nomor karyawan) - jangan dipatahkan di tengah tanda hubung.
                          <td key={c.key} className={`px-3 py-1.5 ${k === 0 ? 'whitespace-nowrap' : ''}`}>{sel(t, c)}</td>
                        ))}
                        <td className="px-3 py-1.5">
                          {t.errors.length
                            ? <span className="text-red-600 dark:text-red-400">{t.errors.join('; ')}</span>
                            : <span className="text-green-700 dark:text-green-300">{hasil.committed ? 'Tersimpan' : 'Siap disimpan'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {jenis && (
            <details className="rounded border px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <summary className="cursor-pointer select-none">Daftar kolom ({jenis.columns.length})</summary>
              <p className="mt-2 leading-relaxed">
                {jenis.columns.map((c) => (c.required ? `${c.label}*` : c.label)).join(', ')} — bertanda * wajib diisi.
              </p>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportExcelModal
