import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { motionEnabled } from '../../utils/motion'

/**
 * Thin bar on the sidebar's left edge that slides to the menu item in view.
 *
 * Built as a single element measured from the DOM (`[aria-current="page"]`)
 * rather than one marker per row: the sidebar renders three levels of menu
 * (module, child, grandchild) in different places, so adding a marker to each
 * level would churn that 900-line file. The existing active-item background is
 * left alone - this is an addition, not a replacement.
 */
export default function SidebarActiveMarker({ container }: { container: RefObject<HTMLElement> }) {
  const location = useLocation()
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const el = container.current
    if (!el) return

    const measure = () => {
      // Beberapa baris bisa sama-sama "aktif": induk cocok karena awalan
      // alamatnya sama, anaknya cocok persis. Yang pertama di DOM biasanya si
      // induk - itu sebabnya penanda dulu berhenti di baris yang salah. Yang
      // dipakai: baris yang alamatnya persis sama; kalau tidak ada, yang
      // paling dalam (terakhir di DOM).
      const semua = Array.from(el.querySelectorAll('[aria-current="page"]')) as HTMLElement[]
      if (semua.length === 0) { setBox(null); return }
      const kini = location.pathname + location.search
      const active = semua.find((n) => n.getAttribute('href') === kini) || semua[semua.length - 1]
      const a = active.getBoundingClientRect()
      const c = el.getBoundingClientRect()
      setBox({ top: a.top - c.top + el.scrollTop, height: a.height })
    }

    // Measured on the next frame: right after a route change the menu layout
    // (including groups that expand themselves) is not settled yet.
    rafRef.current = requestAnimationFrame(() => requestAnimationFrame(measure))

    const observer = new MutationObserver(measure)
    observer.observe(el, { subtree: true, attributes: true, childList: true, attributeFilter: ['aria-current'] })
    // Melipat satu kelompok menu hanya mengubah kelas (bukan isi), jadi
    // pengamat di atas diam saja dan penanda tertinggal di tempat lama.
    // Tingginya nav yang berubah itulah sinyal yang bisa diandalkan.
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    el.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
      ro.disconnect()
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [container, location.pathname, location.search])

  if (!box) return null

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 w-0.5 rounded-full bg-primary-600 dark:bg-primary-400"
      style={{
        top: box.top,
        height: box.height,
        transition: motionEnabled() ? 'top 260ms cubic-bezier(0.16,1,0.3,1), height 260ms cubic-bezier(0.16,1,0.3,1)' : undefined,
      }}
    />
  )
}
