import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

type SetOptions = { replace?: boolean }

/**
 * State halaman yang disimpan di URL (?key=value). Tab dan drill-down yang memakai ini
 * ikut tombol Back/Forward browser dan bisa dibagikan lewat tautan.
 */
export function useUrlState<T extends string>(key: string, defaultValue: T, allowed?: readonly T[]) {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value = (raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? raw : defaultValue) as T

  const set = useCallback((next: T | ((prev: T) => T), opts?: SetOptions) => {
    setParams((prev) => {
      const current = (() => {
        const r = prev.get(key)
        return (r !== null && (!allowed || (allowed as readonly string[]).includes(r)) ? r : defaultValue) as T
      })()
      const v = typeof next === 'function' ? (next as (p: T) => T)(current) : next
      const out = new URLSearchParams(prev)
      if (v === defaultValue || v === '' || v === null || v === undefined) out.delete(key)
      else out.set(key, String(v))
      return out
    }, { replace: opts?.replace })
  }, [key, defaultValue, allowed, setParams])

  return [value, set] as const
}

/**
 * Mengubah BEBERAPA kunci URL sekaligus dalam satu pembaruan.
 *
 * Memanggil beberapa setter useUrlState berurutan tidak bisa dipakai untuk ini:
 * tiap setter menghitung URL barunya dari alamat yang sedang berlaku saat itu,
 * jadi panggilan terakhir menimpa hasil panggilan sebelumnya. Itu yang membuat
 * pemilihan periode di daftar transaksi hanya menyimpan tanggal "sampai" dan
 * tanggal "dari" selalu kembali ke bawaan (dilaporkan Finance 2026-11-17).
 */
export function useUrlMulti() {
  const [, setParams] = useSearchParams()
  return useCallback((patch: Record<string, string | null | undefined>, opts?: SetOptions) => {
    setParams((prev) => {
      const out = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') out.delete(k)
        else out.set(k, String(v))
      })
      return out
    }, { replace: opts?.replace })
  }, [setParams])
}

/** Id (angka) pilihan di URL, null bila tidak ada. */
export function useUrlNumber(key: string) {
  const [raw, setRaw] = useUrlState<string>(key, '')
  const n = raw !== '' && /^\d+$/.test(raw) ? Number(raw) : null
  const set = useCallback((next: number | null, opts?: SetOptions) => setRaw(next === null ? '' : String(next), opts), [setRaw])
  return [n, set] as const
}

/**
 * Nomor halaman daftar yang tersimpan di URL (?hal=3).
 *
 * Dipakai supaya daftar kembali ke halaman yang sama setelah layar dimuat ulang
 * - keluhan pemakai 2026-11-18: "kalau ngerefresh balik dari awal, saya harus
 * cari lagi tadi sampai di halaman berapa". Perpindahan halaman memakai replace
 * supaya tombol Back browser keluar dari daftar, bukan menelusuri halaman satu
 * per satu.
 */
export function useUrlPage(key = 'hal') {
  const [raw, setRaw] = useUrlState<string>(key, '1')
  const page = Math.max(1, Number(raw) || 1)
  const set = useCallback((next: number | ((prev: number) => number), opts?: SetOptions) => {
    setRaw((prev) => {
      const current = Math.max(1, Number(prev) || 1)
      const v = typeof next === 'function' ? next(current) : next
      return String(Math.max(1, Math.floor(Number(v) || 1)))
    }, { replace: opts?.replace ?? true })
  }, [setRaw])
  return [page, set] as const
}

/**
 * Saringan daftar (cari, status, jenis, ...) yang tersimpan di URL.
 *
 * Sama seperti useUrlState, bedanya perubahan memakai replace supaya mengetik
 * di kotak cari tidak menumpuk riwayat browser - tanpa ini satu kata yang
 * diketik membuat tombol Back harus ditekan sebanyak hurufnya. Tab halaman
 * tetap memakai useUrlState biasa karena memang ingin bisa di-Back.
 */
export function useUrlFilter<T extends string>(key: string, defaultValue: T, allowed?: readonly T[]) {
  const [value, setRaw] = useUrlState<T>(key, defaultValue, allowed)
  const set = useCallback(
    (next: T | ((prev: T) => T), opts?: SetOptions) => setRaw(next, { replace: opts?.replace ?? true }),
    [setRaw],
  )
  return [value, set] as const
}
