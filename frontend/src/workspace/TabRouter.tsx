import React, { useMemo, useRef, useState } from 'react'
import { Routes, Route, createPath, parsePath, UNSAFE_LocationContext, UNSAFE_NavigationContext, UNSAFE_RouteContext } from 'react-router-dom'
import type { Location, NavigationType, To } from 'react-router-dom'
import { currentClick } from './clickTracker'
import { getAppRoutes } from './routeRegistry'

interface Props {
  initialPath: string
  containerRef: React.RefObject<HTMLElement>
  /** A click inside this tab navigated to another page: open it as a new tab. */
  onOpenNew: (path: string, title?: string) => void
  /** This tab's own location changed in place. */
  onPathChange: (path: string) => void
}

function makeLocation(path: string, state: unknown = null): Location {
  const p = parsePath(path)
  return { pathname: p.pathname || '/', search: p.search || '', hash: p.hash || '', state, key: Math.random().toString(36).slice(2, 8) }
}

const toPath = (to: To): string => (typeof to === 'string' ? to : createPath(to))

/**
 * A tab is a tiny router of its own (so every page keeps working unchanged) with a navigator that decides
 * whether a navigation stays inside the tab or opens a new one.
 */
export default function TabRouter({ initialPath, containerRef, onOpenNew, onPathChange }: Props) {
  const [loc, setLoc] = useState<Location>(() => makeLocation(initialPath))
  const [navType, setNavType] = useState<'POP' | 'PUSH' | 'REPLACE'>('POP')
  const locRef = useRef(loc)
  locRef.current = loc
  const hist = useRef({ stack: [initialPath], idx: 0 })
  const cb = useRef({ onOpenNew, onPathChange })
  cb.current = { onOpenNew, onPathChange }

  const navigator = useMemo(() => {
    const show = (path: string, type: 'POP' | 'PUSH' | 'REPLACE', state: unknown = null) => {
      const next = makeLocation(path, state)
      locRef.current = next
      setNavType(type)
      setLoc(next)
      cb.current.onPathChange(path)
    }
    const go = (to: To, state: unknown, replace: boolean) => {
      const target = typeof to === 'string' ? parsePath(to) : to
      const targetPath = toPath(to)
      const cur = locRef.current
      const targetPathname = target.pathname || cur.pathname
      if (targetPathname !== cur.pathname && !replace) {
        const click = currentClick()
        const isUp = cur.pathname.startsWith(targetPathname.replace(/\/$/, '') + '/')
        if (click && containerRef.current?.contains(click.target) && !isUp) {
          cb.current.onOpenNew(targetPath, click.title || undefined)
          return
        }
      }
      const h = hist.current
      if (replace) h.stack[h.idx] = targetPath
      else { h.stack = h.stack.slice(0, h.idx + 1).concat(targetPath); h.idx = h.stack.length - 1 }
      show(targetPath, replace ? 'REPLACE' : 'PUSH', state)
    }
    return {
      createHref: (to: To) => toPath(to),
      encodeLocation: (to: To) => {
        const p = typeof to === 'string' ? parsePath(to) : to
        return { pathname: p.pathname || '/', search: p.search || '', hash: p.hash || '' }
      },
      go: (delta: number) => {
        const h = hist.current
        const next = Math.max(0, Math.min(h.stack.length - 1, h.idx + delta))
        if (next === h.idx) return
        h.idx = next
        show(h.stack[next], 'POP')
      },
      push: (to: To, state?: unknown) => go(to, state, false),
      replace: (to: To, state?: unknown) => go(to, state, true),
    }
  }, [containerRef])

  const AppRoutes = getAppRoutes()
  const navValue = useMemo(() => ({ navigator, static: false, basename: '/' }), [navigator])
  const locValue = useMemo(() => ({ location: loc, navigationType: navType as unknown as NavigationType }), [loc, navType])
  // A <Router> may not be nested inside the app's BrowserRouter, so provide the same contexts it would
  // (navigation + location) and reset the route context so the tab's <Routes> matches from the root.
  const emptyRoute = useMemo(() => ({ outlet: null, matches: [], isDataRoute: false }), [])
  return (
    <UNSAFE_NavigationContext.Provider value={navValue as any}>
      <UNSAFE_LocationContext.Provider value={locValue as any}>
        <UNSAFE_RouteContext.Provider value={emptyRoute as any}>
          <Routes>
            <Route path="/app/*" element={AppRoutes ? <AppRoutes /> : null} />
          </Routes>
        </UNSAFE_RouteContext.Provider>
      </UNSAFE_LocationContext.Provider>
    </UNSAFE_NavigationContext.Provider>
  )
}
