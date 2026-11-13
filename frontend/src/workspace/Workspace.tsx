import React, { Suspense, useContext, useEffect, useRef, useState } from 'react'
import { ReactReduxContext } from 'react-redux'
import { RefreshCw } from 'lucide-react'
import { api } from '../store/api'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import { confirmDialog } from '../components/ui'
import { installClickTracker, titleFromElement } from './clickTracker'
import { attachDomDraft, type DomDraftHandle } from './domDraft'
import { TabContext, isTabDirty, useDirtyVersion } from './drafts'
import { isFormPath, moduleById, moduleForPath, splitPath } from './modules'
import TabBar from './TabBar'
import { TabActiveContext } from '../components/ui/BreadcrumbTrail'
import TabRouter, { tabNavs } from './TabRouter'
import { useWorkspace, type TabState } from './WorkspaceContext'

installClickTracker()

type NavMeta = { type: 'POP' | 'PUSH' | 'REPLACE'; idx: number }

function TabPane({ tab, active, onNav }: { tab: TabState; active: boolean; onNav: (tabId: string, meta: NavMeta) => void }) {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const pathname = splitPath(tab.path).pathname
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const handle = useRef<DomDraftHandle>()
  const first = useRef(true)
  const reduxCtx = useContext(ReactReduxContext)
  const [nonce, setNonce] = useState(0)
  const [spin, setSpin] = useState(false)
  // Tombol muat ulang hanya di halaman daftar (bukan form atau detail), supaya isian tidak hilang.
  const isList = !isFormPath(pathname) && !/\/\d+(\/|$)/.test(pathname) && /\/app\/[^/]+\/[^/]+/.test(pathname)
  const refresh = () => {
    setSpin(true)
    reduxCtx?.store.dispatch(api.util.resetApiState())
    setNonce((n) => n + 1)
    setTimeout(() => setSpin(false), 800)
  }

  useEffect(() => {
    if (!ref.current) return
    handle.current = attachDomDraft(ref.current, tab.id, () => pathnameRef.current)
    return () => handle.current?.dispose()
  }, [tab.id])

  useEffect(() => {
    if (first.current) { first.current = false; return }
    handle.current?.reset()
  }, [pathname])

  return (
    <div ref={ref} hidden={!active} data-tab-pane={tab.id}>
      <TabContext.Provider value={{ tabId: tab.id }}>
       <TabActiveContext.Provider value={{ tabId: tab.id, active }}>
        {isList && (
          <div className="flex justify-end px-4 pt-2">
            <button type="button" onClick={refresh} title="Muat ulang data daftar ini"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
              <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Perbarui
            </button>
          </div>
        )}
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <TabRouter key={nonce}
              tabId={tab.id}
              active={active}
              initialPath={tab.path}
              containerRef={ref}
              onOpenNew={(path, title) => {
                if (ws.openPath(path, title) === 'not-module') navigate(path)
              }}
              onPathChange={(path, meta) => { onNav(tab.id, meta); ws.setTabPath(tab.id, path) }}
            />
          </Suspense>
        </ErrorBoundary>
       </TabActiveContext.Provider>
      </TabContext.Provider>
    </div>
  )
}

export default function Workspace({ visible }: { visible: boolean }) {
  const ws = useWorkspace()
  const { state } = ws
  const location = useLocation()
  const navigate = useNavigate()
  useDirtyVersion()
  const ignoreUrl = useRef<string | null>(null)
  // URL path whose tab is being opened/activated; the tabs->URL effect must not run against stale state meanwhile.
  const pendingUrl = useRef<string | null>(null)
  const recentClick = useRef<{ title: string; time: number } | null>(null)
  const navType = useNavigationType()
  const lastNav = useRef<{ tabId: string; type: NavMeta['type']; idx: number } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element) recentClick.current = { title: titleFromElement(e.target), time: Date.now() }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const urlPath = location.pathname + location.search
  const inModule = moduleForPath(location.pathname) !== null
  const activeModuleState = state.activeModule ? state.modules[state.activeModule] : null
  const activePath = activeModuleState?.tabs.find((t) => t.id === activeModuleState.activeTabId)?.path || null

  // Browser URL -> tabs (sidebar click, deep link, refresh)
  useEffect(() => {
    if (ignoreUrl.current === urlPath) { ignoreUrl.current = null; return }
    if (!inModule) return
    // Back/Forward browser: terjemahkan ke riwayat di dalam tab pemilik entri itu, jangan buka tab baru.
    const stamp = (location.state as { wsTab?: string } | null)?.wsTab
    if (navType === 'POP' && stamp) {
      const ownerModule = Object.keys(state.modules).find((mid) => state.modules[mid].tabs.some((t) => t.id === stamp))
      const handle = tabNavs.get(stamp)
      if (ownerModule && handle) {
        const m = state.modules[ownerModule]
        if (state.activeModule !== ownerModule || m.activeTabId !== stamp) ws.activateTab(ownerModule, stamp)
        const stack = handle.stack()
        if (stack[handle.idx()] !== urlPath) {
          let j = -1
          for (let d = 1; d < stack.length && j < 0; d++) {
            if (stack[handle.idx() - d] === urlPath) j = handle.idx() - d
            else if (stack[handle.idx() + d] === urlPath) j = handle.idx() + d
          }
          if (j >= 0) handle.goIdx(j)
          else handle.apply(urlPath, 'PUSH')
        }
        return
      }
    }
    if (ws.activeTabPath() === urlPath) return
    const click = recentClick.current
    const title = click && Date.now() - click.time < 1500 ? click.title : undefined
    const result = ws.openPath(urlPath, title || undefined)
    if (result === 'full') {
      pendingUrl.current = null
      const back = ws.activeTabPath()
      if (back) { ignoreUrl.current = back; navigate(back, { replace: true }) }
    } else {
      pendingUrl.current = urlPath
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPath])

  // Tabs -> browser URL (tab clicked, tab navigated in place, tab closed)
  useEffect(() => {
    if (!inModule) return
    const tid = activeModuleState?.activeTabId || undefined
    const stampState = () => (tid ? { wsTab: tid, wsIdx: tabNavs.get(tid)?.idx() ?? 0 } : undefined)
    if (pendingUrl.current) {
      if (activePath === pendingUrl.current) {
        pendingUrl.current = null
        if (tid) navigate(urlPath, { replace: true, state: stampState() })
      }
      return
    }
    if (!activePath) { ignoreUrl.current = '/app'; navigate('/app', { replace: true }); return }
    if (activePath !== urlPath) {
      ignoreUrl.current = activePath
      const nav = lastNav.current
      lastNav.current = null
      // Pindah halaman di dalam tab = entri baru di riwayat browser, supaya tombol Back mundur selangkah.
      if (nav && nav.tabId === tid && nav.type === 'PUSH') navigate(activePath, { state: { wsTab: tid, wsIdx: nav.idx } })
      else navigate(activePath, { replace: true, state: stampState() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, state.activeModule])

  const goModule = (moduleId: string) => {
    ws.activateModule(moduleId)
    const m = state.modules[moduleId]
    const path = m?.tabs.find((t) => t.id === m.activeTabId)?.path
    if (path && path !== urlPath) { ignoreUrl.current = path; navigate(path) }
  }

  const closeModule = async (moduleId: string) => {
    const tabs = state.modules[moduleId]?.tabs || []
    const dirty = tabs.filter((t) => isTabDirty(t.id)).length
    const label = moduleById(moduleId)?.label || moduleId
    const msg = dirty ? `Modul ${label} punya ${dirty} tab dengan isian belum disimpan. Tutup semua tab ${label}?` : tabs.length > 1 ? `Tutup semua ${tabs.length} tab di modul ${label}?` : ''
    if (msg && !(await confirmDialog(msg))) return
    ws.closeModule(moduleId)
  }

  const closeTabs = async (moduleId: string, tabs: TabState[]) => {
    if (!tabs.length) return
    const dirty = tabs.filter((t) => isTabDirty(t.id))
    if (dirty.length) {
      const msg = tabs.length === 1
        ? `Tab "${tabs[0].title}" berisi isian yang belum disimpan. Tutup tab ini?`
        : `${dirty.length} dari ${tabs.length} tab punya isian yang belum disimpan. Tutup semuanya?`
      if (!(await confirmDialog(msg))) return
    } else if (tabs.length > 3 && !(await confirmDialog(`Tutup ${tabs.length} tab?`))) return
    ws.closeTabs(moduleId, tabs.map((t) => t.id))
  }

  return (
    <div className={visible ? '' : 'hidden'} data-workspace>
      {state.order.length > 0 && <TabBar goModule={goModule} closeModule={closeModule} closeTabs={closeTabs} />}

      {state.order.map((id) =>
        (state.modules[id]?.tabs || []).map((tab) => (
          <TabPane key={tab.id} tab={tab} active={id === state.activeModule && tab.id === state.modules[id].activeTabId} onNav={(tabId, meta) => { lastNav.current = { tabId, ...meta } }} />
        )),
      )}
    </div>
  )
}
