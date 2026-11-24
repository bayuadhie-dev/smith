import { describe, it, expect } from 'vitest'
import { jumlahDitagih } from './PurchaseInvoiceForm'

// Dilaporkan gudang 2026-11-24 (PT Shinwa, PO 26-10-OLC-002): barang datang
// 8.108,56 kg atas pesanan 8.000 kg, tapi isian faktur memajang sisa PO
// (3.953,88) bukan barang yang datang (4.062,44) - "quantitynya sesuai
// kekurangan po, bukan sesuai barang dtg". Akibatnya faktur yang dibuat kurang
// dari barang yang diterima dan selisihnya menggantung di GR/IR.

const baris = (dipesan: number, datang: number, jasa = false) =>
  ({ quantity: dipesan, quantity_received: datang, is_non_inventory: jasa })

describe('jumlahDitagih', () => {
  it('menagih barang yang datang, bukan sisa pesanan', () => {
    expect(jumlahDitagih(baris(8000, 8108.56), 4046.12)).toBeCloseTo(4062.44, 2)
  })

  it('kiriman kurang dari pesanan ditagih sebesar yang datang', () => {
    expect(jumlahDitagih(baris(8000, 3000), 0)).toBe(3000)
  })

  it('kiriman pas sesuai pesanan', () => {
    expect(jumlahDitagih(baris(500, 500), 0)).toBe(500)
  })

  it('yang sudah ditagih faktur lain tidak ditagih dua kali', () => {
    expect(jumlahDitagih(baris(1000, 1000), 600)).toBe(400)
  })

  it('tidak pernah negatif walau tagihan sebelumnya melebihi kiriman', () => {
    expect(jumlahDitagih(baris(1000, 400), 900)).toBe(0)
  })

  it('belum ada barang datang berarti belum ada yang ditagih', () => {
    expect(jumlahDitagih(baris(1000, 0), 0)).toBe(0)
  })

  it('jasa tidak punya penerimaan barang, jadi tetap ikut sisa pesanan', () => {
    expect(jumlahDitagih(baris(10, 0, true), 4)).toBe(6)
  })
})
