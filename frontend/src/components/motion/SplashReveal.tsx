import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { RevealContext, useMotionOn } from './RevealContext'

const KEY = 'erp_splash_pending'
const SPLASH_MS = 900
const REVEAL_S = 0.9
const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1]

/** Centre of the company mark in the sidebar, in viewport pixels. */
function brandOrigin() {
  const fallback = { x: window.innerWidth * 0.04, y: window.innerHeight * 0.06 }
  const el = document.querySelector('[data-brand-mark]')
  if (!el) return fallback
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return fallback
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function hasPendingFlag() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false           // storage blocked: skip the splash screen
  }
}

function consumePendingFlag() {
  try {
    localStorage.removeItem(KEY)
  } catch { /* ignore: worst case the splash shows once more */ }
}

/**
 * A short splash screen, then a dark curtain with a hole that widens out of the
 * company mark in the sidebar.
 *
 * Shows ONCE PER LOGIN, not per tab: the flag is set on sign-in (authSlice) and
 * consumed here. Refreshing the page or opening a new tab does not bring it
 * back - this ERP is opened many times a day, and a splash that keeps
 * reappearing is an interruption, not a welcome.
 *
 * Technical note (user: "it is not smooth", 2026-11-18): this used to animate
 * `clip-path` on the WRAPPER AROUND THE WHOLE APP, so every frame forced the
 * entire DOM tree (sidebar, header, dashboard) to repaint - janky on a large
 * screen, and position:fixed descendants changed their containing block while
 * it ran. Now only ONE empty dark layer on top of the app moves; its hole is a
 * radial-gradient mask whose radius is written straight to style each frame,
 * with no React re-render. The app itself is never repainted.
 */
export default function SplashReveal({ children, name, logo }: {
  children: ReactNode
  name?: string
  /** Company logo; the name initials are used when it is missing. */
  logo?: string
}) {
  const motionOn = useMotionOn()
  const [logoFailed, setLogoFailed] = useState(false)
  const [phase, setPhase] = useState<'splash' | 'reveal' | 'done'>(
    () => (motionOn && hasPendingFlag() ? 'splash' : 'done'))
  const curtain = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase !== 'splash') return
    consumePendingFlag()
    const t = setTimeout(() => setPhase('reveal'), SPLASH_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'reveal') return
    const el = curtain.current
    if (!el) { setPhase('done'); return }
    const { x, y } = brandOrigin()
    // Longest distance from the origin to a screen corner, with a little extra
    // so the circle edge is fully off-screen when the animation ends.
    const maxRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) * 1.05
    const hole = (r: number) => {
      const g = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0 ${r}px, #000 ${r + 0.5}px)`
      el.style.maskImage = g
      ;(el.style as any).webkitMaskImage = g
    }
    hole(0)
    const controls = animate(0, maxRadius, {
      duration: REVEAL_S,
      ease: EASE,
      onUpdate: hole,
      onComplete: () => setPhase('done'),
    })
    return () => controls.stop()
  }, [phase])

  const initials = (name || '').replace(/^PT\.?\s*/i, '').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || 'ER'

  return (
    <RevealContext.Provider value={phase === 'done'}>
      {children}

      {phase !== 'done' && (
        <div
          ref={curtain}
          className="fixed inset-0 z-[80]"
          style={{ backgroundColor: 'rgb(var(--brand-900))', willChange: 'mask-image' }}
          aria-hidden
        />
      )}

      <AnimatePresence>
        {phase === 'splash' && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            aria-hidden
          >
            {logo && !logoFailed ? (
              <img src={logo} alt={name || 'Logo perusahaan'} onError={() => setLogoFailed(true)}
                   className="h-16 w-auto max-w-[220px] object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold tracking-tight text-white">
                {initials}
              </div>
            )}
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-700 border-t-primary-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </RevealContext.Provider>
  )
}
