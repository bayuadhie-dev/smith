import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'framer-motion'
import { useMotionOn, useRevealed } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface CountUpProps {
  value: number
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
export default function CountUp({ value, format, className, duration = 0.6 }: CountUpProps) {
  const motionOn = useMotionOn()
  const revealed = useRevealed()
  const fmt = format || ((n: number) => Math.round(n).toLocaleString('id-ID'))
  const mv = useMotionValue(0)
  const terakhir = useRef(0)
  const [teks, setTeks] = useState(() => fmt(motionOn ? 0 : value))

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

  return <span className={`tabular-nums ${className || ''}`}>{teks}</span>
}
