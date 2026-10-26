import React, { Suspense, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import { confirmDialog } from '../components/ui'
import { installClickTracker, titleFromElement } from './clickTracker'
import { attachDomDraft, type DomDraftHandle } from './domDraft'
import { TabContext, isTabDirty, useDirtyVersion } from './drafts'
import { moduleById, moduleForPath, splitPath } from './modules'
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
      const back = ws.activeTabPath()
      if (back) { ignoreUrl.current = back; navigate(back, { replace: true }) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPath])

  // Tabs -> browser URL (tab clicked, tab navigated in place, tab closed)
  useEffect(() => {
    if (!inModule) return
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

  const closeTab = async (moduleId: string, tab: TabState) => {
    if (isTabDirty(tab.id) && !(await confirmDialog(`Tab "${tab.title}" berisi isian yang belum disimpan. Tutup tab ini?`))) return
    ws.closeTab(moduleId, tab.id)
  }

  const closeModule = async (moduleId: string) => {
    const tabs = state.modules[moduleId]?.tabs || []
    const dirty = tabs.filter((t) => isTabDirty(t.id)).length
    const label = moduleById(moduleId)?.label || moduleId
    const msg = dirty ? `Modul ${label} punya ${dirty} tab dengan isian belum disimpan. Tutup semua tab ${label}?` : tabs.length > 1 ? `Tutup semua ${tabs.length} tab di modul ${label}?` : ''
    if (msg && !(await confirmDialog(msg))) return
    ws.closeModule(moduleId)
  }

  const bar = 'flex items-end gap-1 overflow-x-auto'
  return (
    <div className={visible ? '' : 'hidden'} data-workspace>
      {state.order.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className={`${bar} border-b border-gray-200 dark:border-gray-700`} role="tablist" aria-label="Modul">
            {state.order.map((id) => {
              const mod = moduleById(id)
              const active = id === state.activeModule
              const anyDirty = (state.modules[id]?.tabs || []).some((t) => isTabDirty(t.id))
              return (
                <div
                  key={id}
                  role="tab"
                  aria-selected={active}
                  className={`group flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm font-semibold ${
                    active
                      ? 'border-gray-200 bg-white text-emerald-700 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <button type="button" onClick={() => goModule(id)} className="flex items-center gap-1.5">
                    {mod?.label || id}
                    {anyDirty && <span className="h-2 w-2 rounded-full bg-amber-500" title="Ada isian belum disimpan" />}
                  </button>
                  <button type="button" onClick={() => closeModule(id)} className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700" aria-label={`Tutup modul ${mod?.label}`}>
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {activeModuleState && (
            <div className={bar} role="tablist" aria-label="Halaman">
              {activeModuleState.tabs.map((tab) => {
                const active = tab.id === activeModuleState.activeTabId
                return (
                  <div
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    className={`flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] ${
                      active
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    <button
                      type="button"
                      title={tab.title}
                      className="min-w-0 truncate"
                      onClick={() => ws.activateTab(state.activeModule!, tab.id)}
                    >
                      {tab.title}
                    </button>
                    {isTabDirty(tab.id) && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Belum disimpan" />}
                    <button type="button" onClick={() => closeTab(state.activeModule!, tab)} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700" aria-label={`Tutup ${tab.title}`}>
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {state.order.map((id) =>
        (state.modules[id]?.tabs || []).map((tab) => (
          <TabPane key={tab.id} tab={tab} active={id === state.activeModule && tab.id === state.modules[id].activeTabId} />
        )),
      )}
    </div>
  )
}
