import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { MAX_TABS_PER_MODULE, moduleById, moduleForPath, pathLabel, splitPath } from './modules'
import { clearAllDrafts, clearTabDrafts, isTabDirty } from './drafts'

export interface TabState {
  id: string
  path: string
  title: string
  pinned?: boolean
}
export interface ModuleState {
  tabs: TabState[]
  activeTabId: string | null
}
export interface WorkspaceState {
  modules: Record<string, ModuleState>
  order: string[]
  activeModule: string | null
}

const STORAGE_KEY = 'erp_workspace_v1'
const EMPTY: WorkspaceState = { modules: {}, order: [], activeModule: null }

function load(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as WorkspaceState
    const modules: Record<string, ModuleState> = {}
    const order: string[] = []
    for (const id of parsed.order || []) {
      const m = parsed.modules?.[id]
      if (!moduleById(id) || !m?.tabs?.length) continue
      const tabs = m.tabs.filter((t) => t && t.id && t.path && moduleForPath(splitPath(t.path).pathname))
      if (!tabs.length) continue
      modules[id] = { tabs: pinnedFirst(tabs), activeTabId: tabs.some((t) => t.id === m.activeTabId) ? m.activeTabId : tabs[0].id }
      order.push(id)
    }
    const activeModule = parsed.activeModule && modules[parsed.activeModule] ? parsed.activeModule : order[0] || null
    return { modules, order, activeModule }
  } catch {
    return EMPTY
  }
}

export function clearWorkspaceStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  clearAllDrafts()
}

type Action =
  | { type: 'open'; moduleId: string; tab: TabState; allowDuplicate?: boolean }
  | { type: 'activateTab'; moduleId: string; tabId: string }
  | { type: 'activateModule'; moduleId: string }
  | { type: 'closeTab'; moduleId: string; tabId: string }
  | { type: 'closeModule'; moduleId: string }
  | { type: 'path'; tabId: string; path: string; closeInFavourOf?: string }
  | { type: 'reorder'; moduleId: string; fromId: string; toId: string }
  | { type: 'pin'; moduleId: string; tabId: string; pinned: boolean }
  | { type: 'duplicate'; moduleId: string; tabId: string; newId: string }
  | { type: 'closeMany'; moduleId: string; tabIds: string[] }

const isNewFormPath = (pathname: string) => /\/new\/?$/.test(pathname)

const pinnedFirst = (tabs: TabState[]) => [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)]

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'open': {
      const cur = state.modules[action.moduleId] || { tabs: [], activeTabId: null }
      // Idempotent: React StrictMode (dev) runs effects twice before state settles, so never trust the caller.
      const same = action.allowDuplicate ? undefined : cur.tabs.find((t) => t.path === action.tab.path)
      if (same) return reducer(state, { type: 'activateTab', moduleId: action.moduleId, tabId: same.id })
      if (cur.tabs.length >= MAX_TABS_PER_MODULE) return state
      return {
        modules: { ...state.modules, [action.moduleId]: { tabs: [...cur.tabs, action.tab], activeTabId: action.tab.id } },
        order: state.order.includes(action.moduleId) ? state.order : [...state.order, action.moduleId],
        activeModule: action.moduleId,
      }
    }
    case 'activateTab': {
      const cur = state.modules[action.moduleId]
      if (!cur) return state
      return { ...state, activeModule: action.moduleId, modules: { ...state.modules, [action.moduleId]: { ...cur, activeTabId: action.tabId } } }
    }
    case 'activateModule':
      return state.modules[action.moduleId] ? { ...state, activeModule: action.moduleId } : state
    case 'closeTab': {
      const cur = state.modules[action.moduleId]
      if (!cur) return state
      const idx = cur.tabs.findIndex((t) => t.id === action.tabId)
      const tabs = cur.tabs.filter((t) => t.id !== action.tabId)
      if (!tabs.length) return reducer(state, { type: 'closeModule', moduleId: action.moduleId })
      const activeTabId = cur.activeTabId === action.tabId ? tabs[Math.min(idx, tabs.length - 1)].id : cur.activeTabId
      return { ...state, modules: { ...state.modules, [action.moduleId]: { tabs, activeTabId } } }
    }
    case 'reorder': {
      const cur = state.modules[action.moduleId]
      if (!cur || action.fromId === action.toId) return state
      const from = cur.tabs.find((t) => t.id === action.fromId)
      const toIdx = cur.tabs.findIndex((t) => t.id === action.toId)
      if (!from || toIdx < 0) return state
      const rest = cur.tabs.filter((t) => t.id !== action.fromId)
      rest.splice(toIdx, 0, from)
      return { ...state, modules: { ...state.modules, [action.moduleId]: { ...cur, tabs: pinnedFirst(rest) } } }
    }
    case 'pin': {
      const cur = state.modules[action.moduleId]
      if (!cur) return state
      const tabs = cur.tabs.map((t) => (t.id === action.tabId ? { ...t, pinned: action.pinned || undefined } : t))
      return { ...state, modules: { ...state.modules, [action.moduleId]: { ...cur, tabs: pinnedFirst(tabs) } } }
    }
    case 'duplicate': {
      const cur = state.modules[action.moduleId]
      const src = cur?.tabs.find((t) => t.id === action.tabId)
      if (!cur || !src) return state
      const copy: TabState = { id: action.newId, path: src.path, title: src.title }
      const at = cur.tabs.findIndex((t) => t.id === action.tabId)
      const tabs = [...cur.tabs.slice(0, at + 1), copy, ...cur.tabs.slice(at + 1)]
      return { ...state, activeModule: action.moduleId, modules: { ...state.modules, [action.moduleId]: { tabs: pinnedFirst(tabs), activeTabId: copy.id } } }
    }
    case 'closeMany': {
      const cur = state.modules[action.moduleId]
      if (!cur) return state
      const drop = new Set(action.tabIds)
      const tabs = cur.tabs.filter((t) => !drop.has(t.id))
      if (!tabs.length) return reducer(state, { type: 'closeModule', moduleId: action.moduleId })
      let activeTabId = cur.activeTabId
      if (activeTabId && drop.has(activeTabId)) {
        const before = cur.tabs.slice(0, cur.tabs.findIndex((t) => t.id === activeTabId)).filter((t) => !drop.has(t.id))
        activeTabId = (before[before.length - 1] || tabs[0]).id
      }
      return { ...state, modules: { ...state.modules, [action.moduleId]: { tabs, activeTabId } } }
    }
    case 'closeModule': {
      const modules = { ...state.modules }
      delete modules[action.moduleId]
      const order = state.order.filter((id) => id !== action.moduleId)
      const at = state.order.indexOf(action.moduleId)
      const activeModule = state.activeModule === action.moduleId ? order[Math.min(at, order.length - 1)] || null : state.activeModule
      return { modules, order, activeModule }
    }
    case 'path': {
      const modules: Record<string, ModuleState> = {}
      for (const id of Object.keys(state.modules)) {
        const m = state.modules[id]
        if (!m.tabs.some((t) => t.id === action.tabId)) { modules[id] = m; continue }
        if (action.closeInFavourOf) {
          const tabs = m.tabs.filter((t) => t.id !== action.tabId)
          modules[id] = { tabs, activeTabId: m.activeTabId === action.tabId ? action.closeInFavourOf : m.activeTabId }
        } else {
          modules[id] = {
            ...m,
            tabs: m.tabs.map((t) => {
              if (t.id !== action.tabId) return t
              const autoTitle = t.title === pathLabel(t.path)
              return { ...t, path: action.path, title: autoTitle ? pathLabel(action.path) : t.title }
            }),
          }
        }
      }
      return { ...state, modules }
    }
  }
}

export type OpenResult = 'opened' | 'activated' | 'full' | 'not-module'

interface WorkspaceApi {
  state: WorkspaceState
  openPath: (path: string, title?: string) => OpenResult
  activateTab: (moduleId: string, tabId: string) => void
  activateModule: (moduleId: string) => void
  closeTab: (moduleId: string, tabId: string) => void
  closeModule: (moduleId: string) => void
  setTabPath: (tabId: string, path: string) => void
  reorderTab: (moduleId: string, fromId: string, toId: string) => void
  setPinned: (moduleId: string, tabId: string, pinned: boolean) => void
  duplicateTab: (moduleId: string, tabId: string) => void
  closeTabs: (moduleId: string, tabIds: string[]) => void
  activeTabPath: () => string | null
}

const Ctx = createContext<WorkspaceApi | null>(null)

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return v
}

let seq = 0
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`

export function WorkspaceProvider({ children, onFull }: { children: React.ReactNode; onFull?: (moduleLabel: string) => void }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const ref = useRef(state)
  ref.current = state

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  const openPath = useCallback((path: string, title?: string): OpenResult => {
    const { pathname } = splitPath(path)
    const mod = moduleForPath(pathname)
    if (!mod) return 'not-module'
    const cur = ref.current.modules[mod.id]
    const existing = cur?.tabs.find((t) => t.path === path)
    // A form for a new record that already has unsaved input must not be reopened: start a fresh empty one instead.
    const allowDuplicate = !!existing && isNewFormPath(pathname) && isTabDirty(existing.id)
    if (existing && !allowDuplicate) {
      dispatch({ type: 'activateTab', moduleId: mod.id, tabId: existing.id })
      return 'activated'
    }
    if ((cur?.tabs.length || 0) >= MAX_TABS_PER_MODULE) {
      onFull?.(mod.label)
      return 'full'
    }
    dispatch({ type: 'open', moduleId: mod.id, tab: { id: newId(), path, title: title || pathLabel(path) }, allowDuplicate })
    return 'opened'
  }, [onFull])

  const setTabPath = useCallback((tabId: string, path: string) => {
    let moduleTabs: TabState[] | undefined
    let old: TabState | undefined
    for (const m of Object.values(ref.current.modules)) {
      const t = m.tabs.find((x) => x.id === tabId)
      if (t) { old = t; moduleTabs = m.tabs; break }
    }
    if (!old || old.path === path) return
    const oldPathname = splitPath(old.path).pathname
    const newPathname = splitPath(path).pathname
    if (oldPathname !== newPathname) clearTabDrafts(tabId)
    // Going "up" (e.g. Batal on a form) onto a page another tab already shows: close this tab, show that one.
    const goingUp = oldPathname.startsWith(newPathname.replace(/\/$/, '') + '/')
    const other = goingUp ? moduleTabs!.find((t) => t.id !== tabId && t.path === path) : undefined
    dispatch({ type: 'path', tabId, path, closeInFavourOf: other?.id })
  }, [])

  const api = useMemo<WorkspaceApi>(() => ({
    state,
    openPath,
    activateTab: (moduleId, tabId) => dispatch({ type: 'activateTab', moduleId, tabId }),
    activateModule: (moduleId) => dispatch({ type: 'activateModule', moduleId }),
    closeTab: (moduleId, tabId) => { clearTabDrafts(tabId); dispatch({ type: 'closeTab', moduleId, tabId }) },
    closeModule: (moduleId) => {
      ref.current.modules[moduleId]?.tabs.forEach((t) => clearTabDrafts(t.id))
      dispatch({ type: 'closeModule', moduleId })
    },
    setTabPath,
    reorderTab: (moduleId, fromId, toId) => dispatch({ type: 'reorder', moduleId, fromId, toId }),
    setPinned: (moduleId, tabId, pinned) => dispatch({ type: 'pin', moduleId, tabId, pinned }),
    duplicateTab: (moduleId, tabId) => dispatch({ type: 'duplicate', moduleId, tabId, newId: newId() }),
    closeTabs: (moduleId, tabIds) => { tabIds.forEach(clearTabDrafts); dispatch({ type: 'closeMany', moduleId, tabIds }) },
    activeTabPath: () => {
      const s = ref.current
      const m = s.activeModule ? s.modules[s.activeModule] : null
      return m?.tabs.find((t) => t.id === m.activeTabId)?.path || null
    },
  }), [state, openPath, setTabPath])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
