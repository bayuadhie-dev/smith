import { createContext, useContext } from 'react'
import { useReducedMotion } from 'framer-motion'
import { motionEnabled } from '../../utils/motion'

/**
 * Penanda "isi layar sudah dibuka" dari SplashReveal.
 *
 * Stagger, CountUp, dan bar menunggu penanda ini supaya tidak jalan di balik
 * layar pembuka - kalau jalan duluan, animasinya selesai sebelum sempat dilihat.
 * Di luar SplashReveal nilainya true, jadi komponen ini tetap bisa dipakai di
 * halaman lain tanpa layar pembuka.
 */
export const RevealContext = createContext(true)

export const useRevealed = () => useContext(RevealContext)

/**
 * Animasi boleh jalan atau tidak.
 *
 * Dua sumber dihormati sekaligus: pengaturan "kurangi gerakan" di perangkat
 * (useReducedMotion) dan toggle animasi per pengguna di halaman Profil
 * (html[data-motion='off'], lihat utils/motion.ts). Mati di salah satunya =
 * semua tampil langsung tanpa gerakan.
 */
export function useMotionOn() {
  const reduced = useReducedMotion()
  return !reduced && motionEnabled()
}
