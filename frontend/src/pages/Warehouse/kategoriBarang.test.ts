import { describe, it, expect } from 'vitest'
import { kelompokBarang, namaKategoriBarang, namaKelompokBarang } from './kategoriBarang'

// Lencana di tabel harus sepadan dengan penyaring di server
// (`_syarat_kelompok()` di backend/routes/warehouse.py). Kalau keduanya
// berbeda, orang memilih "Bahan Kimia" lalu melihat baris berlencana "Lainnya",
// atau sebaliknya.

describe('kelompokBarang', () => {
  it('kategori Accurate Fengsheng dikenali', () => {
    expect(kelompokBarang('BAHAN KIMIA', 'chemical_materials')).toBe('chemical')
    expect(kelompokBarang('BAHAN BAKU', 'raw_materials')).toBe('bahan_baku')
    expect(kelompokBarang('BAHAN PEMBANTU', 'packaging_materials')).toBe('packaging')
  })

  it('kode kategori lama Falmaco tetap dikenali', () => {
    expect(kelompokBarang('chemical', 'RAW_MATERIALS')).toBe('chemical')
    expect(kelompokBarang('spunbond', 'RAW_MATERIALS')).toBe('kain')
    expect(kelompokBarang('carton_box', 'packaging_materials')).toBe('packaging')
  })

  it('kategori menang atas material_type yang tidak bisa dipercaya', () => {
    // 65 barang Falmaco berkategori 'stc' bertipe 'packaging_materials'.
    // Kalau material_type didahulukan, semuanya pindah ke Bahan Kemas.
    expect(kelompokBarang('stc', 'packaging_materials')).toBe('aksesoris')
    expect(kelompokBarang('parfum', 'RAW_MATERIALS')).toBe('chemical')
  })

  it('material_type baru dipakai kalau kategorinya tidak dikenal', () => {
    expect(kelompokBarang('KATEGORI BARU', 'chemical_materials')).toBe('chemical')
    expect(kelompokBarang(null, 'raw_materials')).toBe('bahan_baku')
  })

  it('yang tidak cocok ke mana pun jadi Lainnya', () => {
    expect(kelompokBarang('KATEGORI BARU', 'consumables')).toBe('lainnya')
    expect(kelompokBarang(null, null)).toBe('lainnya')
  })

  it('namanya bahasa Indonesia', () => {
    expect(namaKelompokBarang('BAHAN KIMIA', 'chemical_materials')).toBe('Bahan Kimia')
    expect(namaKelompokBarang('carton_box', null)).toBe('Bahan Kemas')
  })
})

describe('namaKategoriBarang', () => {
  it('kode lama diterjemahkan', () => {
    expect(namaKategoriBarang('carton_box')).toBe('Carton Box')
  })

  it('kategori Accurate huruf besar dirapikan supaya tidak berteriak', () => {
    expect(namaKategoriBarang('BAHAN KIMIA')).toBe('Bahan Kimia')
    expect(namaKategoriBarang('BAHAN PEMBANTU')).toBe('Bahan Pembantu')
  })

  it('kosong jadi tanda hubung', () => {
    expect(namaKategoriBarang(null)).toBe('-')
    expect(namaKategoriBarang('  ')).toBe('-')
  })
})
