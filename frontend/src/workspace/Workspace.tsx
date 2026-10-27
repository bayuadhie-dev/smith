import React, { Suspense, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import { confirmDialog } from '../components/ui'
import { installClickTracker, titleFromElement } from './clickTracker'
import { attachDomDraft, type DomDraftHandle } from './domDraft'
import { TabContext, isTabDirty, useDirtyVersion } from './drafts'
import { moduleById, moduleForPath, splitPath } from './modules'
import TabBar from './TabBar'
import TabRouter from './TabRouter'
import { useWorkspace, type TabState } from './WorkspaceContext'

installClickTracker()

function TabPane({ tab, active }: { tab: TabState; active: boolean }) {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const pathname = splitPath(tab.path).pathname
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const handle = useRef<DomDraftHandle>()
  const first = useRef(true)

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
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <TabRouter
              initialPath={tab.path}
              containerRef={ref}
              onOpenNew={(path, title) => {
                if (ws.openPath(path, title) === 'not-module') navigate(path)
              }}
              onPathChange={(path) => ws.setTabPath(tab.id, path)}
            />
          </Suspense>
        </ErrorBoundary>
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
    if (pendingUrl.current) {
      if (activePath === pendingUrl.current) pendingUrl.current = null
      return
    }
    if (!activePath) { ignoreUrl.current = '/app'; navigate('/app', { replace: true }); return }
    if (activePath !== urlPath) { ignoreUrl.current = activePath; navigate(activePath, { replace: true }) }
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
          <TabPane key={tab.id} tab={tab} active={id === state.activeModule && tab.id === state.modules[id].activeTabId} />
        )),
      )}
    </div>
  )
}
