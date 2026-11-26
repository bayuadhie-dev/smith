/**
 * Dua kelas lebar/tinggi pada satu elemen.
 *
 * Panel notifikasi pernah ditulis `className="w-full absolute ... w-[26rem]"`.
 * Yang menang BUKAN yang ditulis belakangan - urutannya ditentukan CSS hasil
 * build - jadi `w-full` menang dan panelnya selebar tombol loncengnya saja,
 * tulisannya patah jadi "No", "h", "ium". Presiden Direktur yang menemukan
 * (2026-11-26); tidak ada satu pun tes yang bisa menangkapnya karena jsdom
 * tidak menghitung tata letak. Yang bisa diperiksa: kelasnya sendiri.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const UKURAN = (awalan: string) =>
  new RegExp(`(?<![\\w-])${awalan}-(?:full|screen|auto|fit|min|max|\\[[^\\]]+\\]|\\d+(?:/\\d+)?|px)(?![\\w-])`, 'g')

function berkasTsx(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama)
    if (statSync(p).isDirectory()) berkasTsx(p, keluar)
    else if (nama.endsWith('.tsx')) keluar.push(p)
  }
  return keluar
}

/** Hanya bagian statisnya. Isi `${...}` dibuang karena di situ kelasnya memang
 *  bergantian lewat ternary - bukan dua-duanya menempel sekaligus.
 *  Jangan dipecah per spasi: justru gabungan kelas dalam SATU elemen yang dicari. */
function bagianStatis(isi: string): string {
  return isi.replace(/\$\{[^}]*\}/g, ' ')
}

describe('kelas Tailwind yang saling menimpa', () => {
  it('tidak ada elemen dengan dua kelas lebar atau tinggi sekaligus', () => {
    const akar = join(process.cwd(), 'src')
    const bentrok: string[] = []
    const className = /className=(?:"([^"]*)"|\{`((?:[^`\\]|\\.)*)`\})/gs

    for (const f of berkasTsx(akar)) {
      const teks = readFileSync(f, 'utf8')
      for (const m of teks.matchAll(className)) {
        const isi = m[1] ?? m[2] ?? ''
        const baris = teks.slice(0, m.index).split('\n').length
        const potongan = bagianStatis(isi)
        {
          for (const awalan of ['w', 'h']) {
            const kelas = new Set<string>()
            for (const km of potongan.matchAll(UKURAN(awalan))) {
              const sebelum = potongan.slice(Math.max(0, km.index! - 12), km.index!)
              if (!sebelum.includes(':')) kelas.add(km[0])
            }
            if (kelas.size > 1) {
              bentrok.push(`${f.replace(akar, 'src')}:${baris} -> ${[...kelas].sort().join(' + ')}`)
            }
          }
        }
      }
    }

    expect(bentrok, `kelas yang saling menimpa:\n${bentrok.join('\n')}`).toEqual([])
  })
})
