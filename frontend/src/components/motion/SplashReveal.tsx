import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { RevealContext, useMotionOn } from './RevealContext'

const KEY = 'erp_splash_pending'
const SPLASH_MS = 900
const REVEAL_S = 0.9
const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1]

/** Titik tengah tanda perusahaan di sidebar, dalam piksel layar. */
function brandOrigin() {
  const bawaan = { x: window.innerWidth * 0.04, y: window.innerHeight * 0.06 }
  const el = document.querySelector('[data-brand-mark]')
  if (!el) return bawaan
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return bawaan
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function adaPenanda() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false           // penyimpanan diblokir: lewati layar pembuka
  }
}

function pakaiPenanda() {
  try {
    localStorage.removeItem(KEY)
  } catch { /* abaikan: paling-paling layar pembuka muncul sekali lagi */ }
}

/**
 * Layar pembuka singkat, lalu tirai gelap dilubangi lingkaran yang melebar dari
 * tanda perusahaan di sidebar.
 *
 * Muncul SEKALI PER LOGIN, bukan per tab: penandanya dipasang saat masuk
 * (authSlice) dan dipakai habis di sini. Jadi menyegarkan halaman atau membuka
 * tab baru tidak memunculkannya lagi - ERP ini dibuka berkali-kali sehari,
 * layar pembuka yang berulang jadi gangguan, bukan sambutan.
 *
 * Catatan teknis (keluhan "kurang halus", 2026-11-18): dulu yang dianimasikan
 * `clip-path` pada PEMBUNGKUS SELURUH APLIKASI, sehingga setiap frame memaksa
 * seluruh pohon DOM (sidebar, header, isi dashboard) digambar ulang - patah di
 * layar besar, dan selama animasi elemen position:fixed di dalamnya berubah
 * acuan. Sekarang yang bergerak hanya SATU lapisan gelap kosong di atas
 * aplikasi; lubangnya dibuat dengan mask radial-gradient yang radiusnya ditulis
 * langsung ke style tiap frame, tanpa render ulang React. Isi aplikasi tidak
 * ikut digambar ulang sama sekali.
 */
export default function SplashReveal({ children, nama, logo }: {
  children: ReactNode
  nama?: string
  /** Logo perusahaan; bila kosong dipakai inisial namanya. */
  logo?: string
}) {
  const motionOn = useMotionOn()
  const [logoGagal, setLogoGagal] = useState(false)
  const [fase, setFase] = useState<'splash' | 'reveal' | 'selesai'>(
    () => (motionOn && adaPenanda() ? 'splash' : 'selesai'))
  const tirai = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fase !== 'splash') return
    pakaiPenanda()
    const t = setTimeout(() => setFase('reveal'), SPLASH_MS)
    return () => clearTimeout(t)
  }, [fase])

  useEffect(() => {
    if (fase !== 'reveal') return
    const el = tirai.current
    if (!el) { setFase('selesai'); return }
    const { x, y } = brandOrigin()
    // Jarak terjauh dari titik asal ke sudut layar, dilebihkan sedikit supaya
    // tepi lingkaran benar-benar keluar layar saat animasi selesai.
    const maks = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) * 1.05
    const lubang = (r: number) => {
      const g = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0 ${r}px, #000 ${r + 0.5}px)`
      el.style.maskImage = g
      ;(el.style as any).webkitMaskImage = g
    }
    lubang(0)
    const kontrol = animate(0, maks, {
      duration: REVEAL_S,
      ease: EASE,
      onUpdate: lubang,
      onComplete: () => setFase('selesai'),
    })
    return () => kontrol.stop()
  }, [fase])

  const inisial = (nama || '').replace(/^PT\.?\s*/i, '').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || 'ER'

  return (
    <RevealContext.Provider value={fase === 'selesai'}>
      {children}

      {fase !== 'selesai' && (
        <div
          ref={tirai}
          className="fixed inset-0 z-[80]"
          style={{ backgroundColor: 'rgb(var(--gray-950))', willChange: 'mask-image' }}
          aria-hidden
        />
      )}

      <AnimatePresence>
        {fase === 'splash' && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            aria-hidden
          >
            {logo && !logoGagal ? (
              <img src={logo} alt={nama || 'Logo perusahaan'} onError={() => setLogoGagal(true)}
                   className="h-16 w-auto max-w-[220px] object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold tracking-tight text-white">
                {inisial}
              </div>
            )}
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-700 border-t-primary-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </RevealContext.Provider>
  )
}
