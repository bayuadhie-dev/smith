import { flushSync } from 'react-dom'

export type MotionPref = 'on' | 'off'

const KEY = 'erp_motion'
const keyFor = (userId?: string | number | null) => (userId ? `${KEY}:${userId}` : KEY)

function read(key: string): MotionPref | null {
  try {
    const v = localStorage.getItem(key)
    return v === 'on' || v === 'off' ? v : null
  } catch {
    return null
  }
}

/** Preferensi animasi per pengguna. Belum pernah diatur: ikut perangkat ("kurangi gerakan" = mati). */
export function getMotionPref(userId?: string | number | null): MotionPref {
  const own = userId ? read(keyFor(userId)) : null
  if (own) return own
  const last = read(`${KEY}:last`)
  if (last) return last
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'off' : 'on'
}

export function applyMotion(pref: MotionPref) {
  document.documentElement.dataset.motion = pref
}

export function setMotionPref(pref: MotionPref, userId?: string | number | null) {
  try {
    localStorage.setItem(keyFor(userId), pref)
    localStorage.setItem(`${KEY}:last`, pref)
  } catch { /* penyimpanan diblokir: tetap berlaku selama sesi */ }
  applyMotion(pref)
}

export function syncMotionForUser(userId?: string | number | null) {
  const pref = getMotionPref(userId)
  try { localStorage.setItem(`${KEY}:last`, pref) } catch { /* abaikan */ }
  applyMotion(pref)
}

export function motionEnabled() {
  return document.documentElement.dataset.motion !== 'off'
}

/**
 * Ganti tema dengan efek "flip": layar baru melebar dari titik klik (View Transitions API).
 * Tanpa dukungan browser atau animasi dimatikan, perubahan langsung diterapkan.
 */
export function withThemeFlip(change: () => void, origin?: { x: number; y: number }) {
  const doc = document as any
  if (!motionEnabled() || typeof doc.startViewTransition !== 'function') {
    change()
    return
  }
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transition = doc.startViewTransition(() => { flushSync(change) })
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => undefined)
}
