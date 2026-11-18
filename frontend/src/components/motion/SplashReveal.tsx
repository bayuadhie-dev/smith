import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RevealContext, useMotionOn } from './RevealContext'

const KEY = 'erp_splash_shown'
const SPLASH_MS = 900
const REVEAL_S = 0.9
const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1]

/** Titik tengah tanda perusahaan di sidebar, dalam persen layar. */
function brandOrigin() {
  const el = document.querySelector('[data-brand-mark]')
  if (!el) return '4% 6%'
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return '4% 6%'
  const x = ((r.left + r.width / 2) / window.innerWidth) * 100
  const y = ((r.top + r.height / 2) / window.innerHeight) * 100
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`
}

function sudahPernah() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false           // penyimpanan diblokir: anggap belum, tetap aman
  }
}

function tandai() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch { /* abaikan: cuma berarti layar pembuka muncul lagi di tab ini */ }
}

/**
 * Layar pembuka singkat lalu isi aplikasi "dibuka" dengan lingkaran yang melebar
 * dari tanda perusahaan di sidebar.
 *
 * Hanya sekali per tab (sessionStorage) - ERP ini dibuka berkali-kali sehari,
 * layar pembuka yang muncul tiap pindah halaman akan jadi gangguan, bukan sambutan.
 */
export default function SplashReveal({ children, nama }: { children: ReactNode; nama?: string }) {
  const motionOn = useMotionOn()
  const [fase, setFase] = useState<'splash' | 'reveal' | 'selesai'>(
    () => (motionOn && !sudahPernah() ? 'splash' : 'selesai'))
  const [origin, setOrigin] = useState('4% 6%')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fase !== 'splash') return
    tandai()
    const t = setTimeout(() => {
      setOrigin(brandOrigin())
      setFase('reveal')
    }, SPLASH_MS)
    return () => clearTimeout(t)
  }, [fase])

  const inisial = (nama || '').replace(/^PT\.?\s*/i, '').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || 'ER'

  return (
    <RevealContext.Provider value={fase === 'selesai'}>
      <motion.div
        ref={ref}
        initial={fase === 'selesai' ? false : { clipPath: `circle(0% at ${origin})` }}
        animate={fase === 'reveal' ? { clipPath: `circle(150% at ${origin})` } : undefined}
        transition={{ duration: REVEAL_S, ease: EASE }}
        onAnimationComplete={() => {
          // Clip-path dilepas langsung lewat ref, BUKAN dianimasikan ke "none":
          // Framer Motion menerjemahkan "none" jadi circle(0%) sehingga seluruh
          // isi layar menghilang. Sekalian supaya elemen position:fixed di dalam
          // (sidebar, header) kembali mengacu ke viewport, bukan ke kotak ini.
          if (ref.current) ref.current.style.clipPath = 'none'
          setFase('selesai')
        }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {fase === 'splash' && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gray-950"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-hidden
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold tracking-tight text-white">
              {inisial}
            </div>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-700 border-t-primary-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </RevealContext.Provider>
  )
}
