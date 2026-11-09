import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react'

const PREFIX = 'erp_draft:'

export const TabContext = createContext<{ tabId: string } | null>(null)

// ---- dirty tracking (a tab is "dirty" while it holds unsaved input) --------------------------------
const dirtyMap = new Map<string, Set<string>>()
const listeners = new Set<() => void>()
let dirtyVersion = 0

// Deferred on purpose: setDirty() is called from a capture-phase input listener. A synchronous re-render at that
// moment lands BEFORE React handles the same input event, and React would reset the controlled input to its old
// value (the first typed character vanished). A macrotask runs after the event has been fully handled.
let notifyScheduled = false
function notify() {
  if (notifyScheduled) return
  notifyScheduled = true
  setTimeout(() => {
    notifyScheduled = false
    dirtyVersion++
    listeners.forEach((l) => l())
  }, 0)
}

export function setDirty(tabId: string, key: string, dirty: boolean) {
  const set = dirtyMap.get(tabId) || new Set<string>()
  const had = set.has(key)
  if (dirty && !had) set.add(key)
  else if (!dirty && had) set.delete(key)
  else return
  if (set.size) dirtyMap.set(tabId, set)
  else dirtyMap.delete(tabId)
  notify()
}

export function isTabDirty(tabId: string): boolean {
  return (dirtyMap.get(tabId)?.size || 0) > 0
}

export function useDirtyVersion(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => dirtyVersion,
  )
}

// ---- storage ---------------------------------------------------------------------------------------
function storageKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

function storageKey(tabId: string, key: string) {
  return `${PREFIX}${tabId}:${key}`
}

export function readDraft<T>(tabId: string, key: string): T | undefined {
  try {
    const raw = localStorage.getItem(storageKey(tabId, key))
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export function writeDraft(tabId: string, key: string, value: unknown) {
  try {
    localStorage.setItem(storageKey(tabId, key), JSON.stringify(value))
  } catch {
    /* storage full / unavailable: drafts are best effort */
  }
}

export function clearDraft(tabId: string, key: string) {
  try { localStorage.removeItem(storageKey(tabId, key)) } catch { /* ignore */ }
  setDirty(tabId, key, false)
}

export function clearTabDrafts(tabId: string) {
  try {
    const prefix = `${PREFIX}${tabId}:`
    for (const k of storageKeys()) if (k.startsWith(prefix)) localStorage.removeItem(k)
  } catch { /* ignore */ }
  if (dirtyMap.delete(tabId)) notify()
}

export function clearAllDrafts() {
  try {
    for (const k of storageKeys()) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch { /* ignore */ }
  dirtyMap.clear()
  notify()
}

/**
 * useState that survives a page refresh while the form lives inside a workspace tab.
 * Outside a tab it behaves like plain useState. Call the returned `discard()` after a successful save.
 */
export function useDraftState<T>(key: string, initial: T | (() => T), enabled = true): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const ctx = useContext(TabContext)
  const tabId = enabled ? ctx?.tabId : undefined
  const initialRef = useRef<T>()
  const [value, setValue] = useState<T>(() => {
    const base = typeof initial === 'function' ? (initial as () => T)() : initial
    initialRef.current = base
    if (!tabId) return base
    const saved = readDraft<T>(tabId, key)
    return saved !== undefined ? saved : base
  })
  const baseJson = useRef<string>(JSON.stringify(initialRef.current))
  const discarded = useRef(false)

  useEffect(() => {
    if (!tabId || discarded.current) return
    const handle = setTimeout(() => {
      if (JSON.stringify(value) === baseJson.current) clearDraft(tabId, key)
      else { writeDraft(tabId, key, value); setDirty(tabId, key, true) }
    }, 300)
    return () => clearTimeout(handle)
  }, [value, tabId, key])

  useEffect(() => {
    if (tabId && readDraft(tabId, key) !== undefined) setDirty(tabId, key, true)
  }, [tabId, key])

  const discard = useCallback(() => {
    discarded.current = true
    if (tabId) clearDraft(tabId, key)
  }, [tabId, key])

  return [value, setValue, discard]
}

/**
 * Draft for react-hook-form forms: the whole form (incl. rows) is saved per tab and restored after a refresh.
 * Only for new records (pass enabled=false in edit mode). Call the returned discard() after a successful save.
 */
export function useFormDraft(form: { watch: any; getValues: any; reset: any }, enabled: boolean, key = '__rhf'): () => void {
  const ctx = useContext(TabContext)
  const tabId = enabled ? ctx?.tabId : undefined
  const base = useRef<string>()
  const discarded = useRef(false)

  useEffect(() => {
    if (!tabId) return
    base.current = JSON.stringify(form.getValues())
    const saved = readDraft<any>(tabId, key)
    if (saved !== undefined) { form.reset(saved); setDirty(tabId, key, true) }
    let timer: ReturnType<typeof setTimeout> | undefined
    const sub = form.watch((vals: any) => {
      if (discarded.current) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const json = JSON.stringify(vals)
        if (json === base.current) clearDraft(tabId, key)
        else { writeDraft(tabId, key, vals); setDirty(tabId, key, true) }
      }, 400)
    })
    return () => { clearTimeout(timer); sub.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, key])

  return useCallback(() => {
    discarded.current = true
    if (tabId) clearDraft(tabId, key)
  }, [tabId, key])
}

export function useClearTabDrafts(): () => void {
  const ctx = useContext(TabContext)
  return useCallback(() => { if (ctx?.tabId) clearTabDrafts(ctx.tabId) }, [ctx?.tabId])
}
