import { describe, it, expect } from 'vitest'
import { formatCurrencyAmount, formatNumber, formatRupiah } from './currencyUtils'

// Intl memakai spasi tak-putus antara "Rp" dan angkanya; yang diuji di sini
// bukan jenis spasinya.
const rapi = (s: string) => s.replace(/\u00a0/g, ' ')

// Dilaporkan Finance 2026-11-24: harga satuan PO Rp 337.125,50 tampil
// "Rp 337.126". Angka tersimpannya benar - yang membulatkan tampilannya.
// Finance membaca angka bulat itu sebagai harga yang tersimpan, menyusun ulang
// totalnya dari situ, lalu selisih Rp 38,85 dengan ERP.

describe('formatRupiah', () => {
  it('angka yang punya sen ditampilkan lengkap', () => {
    expect(rapi(formatRupiah(337125.5))).toBe('Rp 337.125,50')
    expect(rapi(formatRupiah(76536.6))).toBe('Rp 76.536,60')
    expect(rapi(formatRupiah(20834355.9))).toBe('Rp 20.834.355,90')
  })

  it('angka bulat tetap bulat - layar tidak penuh ",00"', () => {
    expect(rapi(formatRupiah(5000000))).toBe('Rp 5.000.000')
    expect(rapi(formatRupiah(0))).toBe('Rp 0')
  })

  it('sisa floating point bukan sen sungguhan', () => {
    // 0,1 + 0,2 = 0,30000000000000004 - jangan sampai memunculkan desimal palsu
    expect(rapi(formatRupiah(1000 + 0.1 + 0.2 - 0.3))).toBe('Rp 1.000')
    expect(rapi(formatRupiah(2500.000001))).toBe('Rp 2.500')
  })

  it('sen sungguhan muncul, pecahan jauh di bawah sen tidak', () => {
    expect(rapi(formatRupiah(100.01))).toBe('Rp 100,01')
    expect(rapi(formatRupiah(100.004))).toBe('Rp 100')
  })

  it('angka negatif ikut aturan yang sama', () => {
    expect(rapi(formatRupiah(-337125.5))).toBe('-Rp 337.125,50')
    expect(rapi(formatRupiah(-5000))).toBe('-Rp 5.000')
  })

  it('showDecimals: true tetap memaksa dua desimal', () => {
    expect(rapi(formatRupiah(5000000, { showDecimals: true }))).toBe('Rp 5.000.000,00')
  })

  it('tanpa simbol ikut menampilkan sen', () => {
    expect(rapi(formatRupiah(337125.5, { showSymbol: false }))).toBe('337.125,50')
    expect(rapi(formatNumber(337125.5))).toBe('337.125,50')
  })

  it('kosong dan bukan angka tetap Rp 0', () => {
    expect(rapi(formatRupiah(null))).toBe('Rp 0')
    expect(rapi(formatRupiah(undefined))).toBe('Rp 0')
    expect(rapi(formatRupiah(NaN))).toBe('Rp 0')
  })
})

describe('formatCurrencyAmount', () => {
  it('rupiah ikut aturan formatRupiah', () => {
    expect(rapi(formatCurrencyAmount(337125.5, 'IDR'))).toBe('Rp 337.125,50')
    expect(rapi(formatCurrencyAmount(5000000, 'IDR'))).toBe('Rp 5.000.000')
  })

  it('mata uang asing tetap selalu dua desimal', () => {
    expect(formatCurrencyAmount(1234.5, 'USD')).toContain('1,234.50')
  })
})
