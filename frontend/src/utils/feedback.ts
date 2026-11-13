import toast from 'react-hot-toast'
import { motionEnabled } from './motion'

let lastButton: HTMLElement | null = null
let lastClick = 0
let flashUntil = 0

/** Dipanggil saat sebuah penyimpanan berhasil: tombol yang barusan diklik menunjukkan centang, baris baru menyala tipis. */
export function notifySaved() {
  if (!motionEnabled()) return
  const now = Date.now()
  flashUntil = now + 4000
  const b = lastButton
  if (b && b.isConnected && now - lastClick < 8000) {
    b.classList.remove('ui-saved')
    void b.offsetWidth
    b.classList.add('ui-saved')
    window.setTimeout(() => b.classList.remove('ui-saved'), 1200)
  }
}

let started = false
export function initFeedback() {
  if (started || typeof document === 'undefined') return
  started = true
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest?.('button, a.btn-primary') as HTMLElement | null
    if (el) { lastButton = el; lastClick = Date.now() }
  }, true)

  const original = toast.success.bind(toast)
  ;(toast as any).success = (...args: Parameters<typeof toast.success>) => {
    notifySaved()
    return original(...args)
  }

  new MutationObserver((mutations) => {
    if (Date.now() > flashUntil) return
    for (const m of mutations) {
      if (!(m.target instanceof HTMLTableSectionElement) || m.target.tagName !== 'TBODY') continue
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLTableRowElement && (m.target as HTMLElement).children.length > 1) {
          n.classList.add('ui-row-flash')
          window.setTimeout(() => n.classList.remove('ui-row-flash'), 2400)
        }
      })
    }
  }).observe(document.body, { childList: true, subtree: true })
}
