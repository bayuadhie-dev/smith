import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KUNCI_MUAT_ULANG, muat } from './muatChunk'

// Dilaporkan 2026-11-24: "banyak halaman tidak bisa diakses". Aplikasinya
// sehat - tabnya yang basi. Tiap deploy mengganti nama berkas potongan kode,
// dan tab lama masih meminta nama yang sudah tidak ada.

const muatUlang = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  muatUlang.mockClear()
  Object.defineProperty(window, 'location', {
    value: { reload: muatUlang },
    writable: true,
    configurable: true,
  })
})

afterEach(() => { vi.restoreAllMocks() })

describe('muat', () => {
  it('impor yang berhasil diteruskan apa adanya', async () => {
    const modul = { default: 'Halaman' }
    await expect(muat(async () => modul)).resolves.toBe(modul)
    expect(muatUlang).not.toHaveBeenCalled()
  })

  it('impor yang gagal memicu satu kali muat ulang', async () => {
    const janji = muat(async () => { throw new Error('Failed to fetch dynamically imported module') })

    // Sengaja tidak pernah selesai: halamannya sedang dimuat ulang, jadi React
    // tidak boleh terlanjur menggambar layar error.
    const hasil = await Promise.race([janji, Promise.resolve('tertahan')])
    expect(hasil).toBe('tertahan')
    expect(muatUlang).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(KUNCI_MUAT_ULANG)).toBe('1')
  })

  it('gagal lagi setelah dimuat ulang dilempar, bukan berputar', async () => {
    sessionStorage.setItem(KUNCI_MUAT_ULANG, '1')
    const galat = new Error('berkasnya memang rusak')

    await expect(muat(async () => { throw galat })).rejects.toBe(galat)
    expect(muatUlang).not.toHaveBeenCalled()
  })

  it('satu impor berhasil membersihkan penandanya', async () => {
    sessionStorage.setItem(KUNCI_MUAT_ULANG, '1')
    await muat(async () => ({ default: 'Halaman' }))
    expect(sessionStorage.getItem(KUNCI_MUAT_ULANG)).toBeNull()
  })

  it('sessionStorage yang ditolak peramban tidak ikut menjatuhkan halaman', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('ditolak') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('ditolak') })

    const janji = muat(async () => { throw new Error('gagal') })
    const hasil = await Promise.race([janji, Promise.resolve('tertahan')])
    expect(hasil).toBe('tertahan')
    expect(muatUlang).toHaveBeenCalledTimes(1)
  })
})
