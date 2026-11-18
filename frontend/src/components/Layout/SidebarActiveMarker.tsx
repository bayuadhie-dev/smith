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
      const active = el.querySelector('[aria-current="page"]') as HTMLElement | null
      if (!active) { setBox(null); return }
      const a = active.getBoundingClientRect()
      const c = el.getBoundingClientRect()
      setBox({ top: a.top - c.top + el.scrollTop, height: a.height })
    }

    // Measured on the next frame: right after a route change the menu layout
    // (including groups that expand themselves) is not settled yet.
    rafRef.current = requestAnimationFrame(() => requestAnimationFrame(measure))

    const observer = new MutationObserver(measure)
    observer.observe(el, { subtree: true, attributes: true, childList: true, attributeFilter: ['aria-current'] })
    el.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
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
