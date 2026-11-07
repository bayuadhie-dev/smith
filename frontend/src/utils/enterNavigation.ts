import type { KeyboardEvent } from 'react'

/**
 * Enter di kolom isian tidak boleh menyimpan form. Enter memindahkan fokus ke kolom yang sama di baris berikutnya
 * (isi atribut data-col pada input), atau ke isian berikutnya kalau tidak ada. Tombol dan textarea tidak terpengaruh.
 */
export function enterMovesDown(e: KeyboardEvent<HTMLFormElement | HTMLElement>) {
  if (e.key !== 'Enter' || e.shiftKey) return
  const el = e.target as HTMLElement
  if (el.tagName !== 'INPUT') return
  const input = el as HTMLInputElement
  if (['submit', 'button', 'checkbox', 'radio'].includes(input.type)) return
  e.preventDefault()
  const form = input.form || (e.currentTarget as HTMLElement)
  const col = input.dataset.col
  const all = Array.from(form.querySelectorAll<HTMLInputElement>('input:not([type=hidden]):not([disabled]):not([readonly])'))
  const same = col ? all.filter((x) => x.dataset.col === col) : []
  const pool = same.length > 1 ? same : all
  const idx = pool.indexOf(input)
  const next = pool[idx + 1]
  if (next) { next.focus(); next.select?.() }
}
