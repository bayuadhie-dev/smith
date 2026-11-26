import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Finance melaporkan 2026-11-24/25: harga PO di layar Rp 409.044 sementara di
// cetakan Rp 409.043,88. Penyebabnya bukan satu halaman - belasan halaman
// Finance punya SALINAN formatter uangnya sendiri, dan `style: 'currency'` untuk
// IDR itu bawaannya NOL angka desimal, jadi semuanya diam-diam membulatkan.
// Beberapa halaman bahkan sudah mengimpor formatRupiah yang benar tapi masih
// punya definisi lokal yang menutupinya.
//
// Tes ini menjaga agar uang hanya diformat lewat satu pintu: utils/currencyUtils.

const AKAR = join(__dirname)

function berkasTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    const p = join(dir, nama)
    if (statSync(p).isDirectory()) return berkasTsx(p)
    return /\.tsx?$/.test(nama) && !nama.endsWith('.test.ts') && !nama.endsWith('.test.tsx') ? [p] : []
  })
}

describe('format uang di halaman Finance', () => {
  it('tidak ada halaman yang memformat rupiah sendiri', () => {
    const pelanggar = berkasTsx(AKAR).filter((p) => {
      const isi = readFileSync(p, 'utf8')
      return /style:\s*'currency'/.test(isi) && /currency:\s*'IDR'/.test(isi)
    })
    expect(pelanggar.map((p) => p.replace(AKAR, ''))).toEqual([])
  })

  it('tidak ada yang membulatkan rupiah ke angka bulat', () => {
    const pelanggar = berkasTsx(AKAR).filter((p) => {
      const isi = readFileSync(p, 'utf8')
      // reportKit memakai maximumFractionDigits: 0 HANYA untuk angka yang memang
      // bulat, lalu jatuh ke 2 desimal kalau ada sennya - itu aturan yang sama
      // dengan formatRupiah, jadi dikecualikan.
      if (p.endsWith('reportKit.tsx')) return false
      return /Rp\s*\$\{Math\.round\(/.test(isi)
        || /maximumFractionDigits:\s*0\s*\}\)\}/.test(isi)
    })
    expect(pelanggar.map((p) => p.replace(AKAR, ''))).toEqual([])
  })
})
