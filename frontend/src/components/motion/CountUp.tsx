import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'framer-motion'
import { useMotionOn, useRevealed } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface CountUpProps {
  value: number
  /** Kedipkan sebentar saat nilainya berubah sesudah tampil (data disegarkan). */
  flashOnChange?: boolean
  /** Pemformat angka; bawaan ribuan gaya Indonesia. */
  format?: (n: number) => string
  className?: string
  duration?: number
}

/**
 * Angka yang naik ke nilai aslinya.
 *
 * Saat data di-muat ulang, hitungan LANJUT dari angka terakhir yang tampil -
 * bukan mundur ke nol dulu. Tanpa itu, setiap penyegaran otomatis dashboard
 * (tiap 2 menit) membuat semua angka berkedip dari nol dan terbaca seperti
 * data hilang.
 */
export default function CountUp({ value, format, className, duration = 1.1, flashOnChange = true }: CountUpProps) {
  const motionOn = useMotionOn()
  const revealed = useRevealed()
  const fmt = format || ((n: number) => Math.round(n).toLocaleString('id-ID'))
  const mv = useMotionValue(0)
  const terakhir = useRef(0)
  const nilaiLama = useRef<number | null>(null)
  const [kedip, setKedip] = useState(false)
  const [teks, setTeks] = useState(() => fmt(motionOn ? 0 : value))

  // Kedip hanya untuk perubahan SESUDAH angka pertama tampil - penyegaran
  // otomatis yang nilainya sama tidak membuat layar berkedip-kedip.
  useEffect(() => {
    const lama = nilaiLama.current
    nilaiLama.current = value
    if (!flashOnChange || !motionOn || lama === null || lama === value) return
    setKedip(true)
    const t = setTimeout(() => setKedip(false), 900)
    return () => clearTimeout(t)
  }, [value, flashOnChange, motionOn])

  useEffect(() => {
    if (!motionOn || !revealed) {
      terakhir.current = value
      mv.set(value)
      setTeks(fmt(value))
      return
    }
    mv.set(terakhir.current)
    const kontrol = animate(mv, value, {
      duration,
      ease: EASE,
      onUpdate: (n) => { terakhir.current = n; setTeks(fmt(n)) },
      onComplete: () => { terakhir.current = value; setTeks(fmt(value)) },
    })
    return () => kontrol.stop()
    // fmt sengaja tidak ikut: pemanggil umumnya mengirim fungsi baru tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, motionOn, revealed, duration])

  return <span className={`tabular-nums ${kedip ? 'erp-flash' : ''} ${className || ''}`}>{teks}</span>
}
