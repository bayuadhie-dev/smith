import { describe, it, expect } from 'vitest'
import { getPageTitle } from './useDocumentTitle'

// Judul tab ikut tersimpan di riwayat browser dan terbaca di tiap tangkapan
// layar atau berbagi layar. Halaman pengawasan Bea Cukai dibuka lewat tautan
// yang tokennya ada di dalam alamat - 2026-11-26 tokennya terpampang penuh di
// judul tab karena judul disusun dari potongan terakhir alamat.

describe('getPageTitle', () => {
  it('halaman pengawasan memakai namanya, bukan tokennya', () => {
    const token = 'TXe5cFysPB289JC27hY_WYCe__Ax_UkRSs_TfPzXDI4'
    const judul = getPageTitle(`/public/pengawasan-ethanol/${token}`)
    expect(judul).toBe('Kartu Pengawasan Ethanol')
    expect(judul).not.toContain(token)
  })

  it('potongan alamat yang panjang dan acak tidak pernah jadi judul', () => {
    const judul = getPageTitle('/public/sesuatu/aB3xK9pQ7mN2vR5tY8wL4zC6')
    expect(judul).not.toContain('aB3xK9pQ7mN2vR5tY8wL4zC6')
  })

  it('alamat biasa tetap dapat judulnya', () => {
    expect(getPageTitle('/app/purchasing')).toBe('Purchasing')      // cocok persis
    expect(getPageTitle('/public/attendance')).toBe('Attendance')   // disusun dari alamat
  })
})
