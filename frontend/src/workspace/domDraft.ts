import { clearDraft, readDraft, setDirty, writeDraft } from './drafts'
import { isFormPath } from './modules'

// Best-effort draft for plain form fields inside a tab: remembers what the user typed and puts it back
// after a page refresh (forms with custom widgets can additionally use useDraftState).

const KEY = '__dom'
const FIELD_SEL = 'input,textarea,select'

interface FieldValue { v?: string; c?: boolean }
interface DomDraft { pathname: string; fields: Record<string, FieldValue> }

const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
const areaDesc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
const selectDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!
const checkedDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')!

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function nativeGet(el: Field): string {
  if (el instanceof HTMLTextAreaElement) return areaDesc.get!.call(el)
  if (el instanceof HTMLSelectElement) return selectDesc.get!.call(el)
  return valueDesc.get!.call(el)
}

function nativeSet(el: Field, v: string) {
  if (el instanceof HTMLTextAreaElement) areaDesc.set!.call(el, v)
  else if (el instanceof HTMLSelectElement) selectDesc.set!.call(el, v)
  else valueDesc.set!.call(el, v)
}

function ignored(el: Field): boolean {
  if (el.hasAttribute('data-no-draft') || el.closest('[data-no-draft]')) return true
  if (el instanceof HTMLInputElement) {
    if (['password', 'file', 'hidden', 'search', 'button', 'submit', 'reset', 'image'].includes(el.type)) return true
    if (/cari|search/i.test(el.placeholder || '')) return true
  }
  return false
}

function signature(el: Field): string {
  return [el.getAttribute('name'), el.id, el.getAttribute('placeholder'), (el as HTMLInputElement).type, el.getAttribute('aria-label')].join('|')
}

function keyFor(container: Element, el: Field): string {
  const sig = signature(el)
  const same = Array.from(container.querySelectorAll<Field>(FIELD_SEL)).filter((x) => signature(x) === sig)
  return `${sig}#${same.indexOf(el)}`
}

export interface DomDraftHandle {
  dispose: () => void
  reset: () => void
}

export function attachDomDraft(container: HTMLElement, tabId: string, getPathname: () => string): DomDraftHandle {
  let draft: DomDraft = { pathname: getPathname(), fields: {} }
  const saved = readDraft<DomDraft>(tabId, KEY)
  if (saved && saved.pathname === draft.pathname) draft = saved
  const touched = new Set<string>()
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const persist = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (Object.keys(draft.fields).length) writeDraft(tabId, KEY, draft)
      else clearDraft(tabId, KEY)
    }, 300)
  }

  const onInput = (e: Event) => {
    const el = e.target
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return
    if (ignored(el) || !container.contains(el)) return
    const key = keyFor(container, el)
    touched.add(key)
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) draft.fields[key] = { c: el.checked }
    else draft.fields[key] = { v: nativeGet(el) }
    draft.pathname = getPathname()
    persist()
    // Only forms count as unsaved work; list filters etc. are restored but never block closing the tab.
    if (el.closest('form') || isFormPath(draft.pathname)) setDirty(tabId, KEY, true)
  }
  container.addEventListener('input', onInput, true)
  container.addEventListener('change', onInput, true)

  // ---- restore ---------------------------------------------------------------------------------
  const applied = new Set<string>()
  const apply = () => {
    if (draft.pathname !== getPathname()) return
    const keys = Object.keys(draft.fields)
    if (!keys.length) return
    for (const el of Array.from(container.querySelectorAll<Field>(FIELD_SEL))) {
      if (ignored(el)) continue
      const key = keyFor(container, el)
      const want = draft.fields[key]
      if (!want || applied.has(key) || touched.has(key)) continue
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (want.c !== undefined && el.checked !== want.c) el.click()
        applied.add(key)
        continue
      }
      if (want.v !== undefined && nativeGet(el) !== want.v) {
        nativeSet(el, want.v)
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
      }
      applied.add(key)
    }
  }
  const hasDraft = Object.keys(draft.fields).length > 0
  if (hasDraft) setDirty(tabId, KEY, isFormPath(draft.pathname))
  let observer: MutationObserver | undefined
  let stopTimer: ReturnType<typeof setTimeout> | undefined
  if (hasDraft) {
    apply()
    observer = new MutationObserver(() => apply())
    observer.observe(container, { childList: true, subtree: true })
    stopTimer = setTimeout(() => observer?.disconnect(), 12000)
  }

  return {
    dispose: () => {
      container.removeEventListener('input', onInput, true)
      container.removeEventListener('change', onInput, true)
      observer?.disconnect()
      clearTimeout(stopTimer)
      clearTimeout(saveTimer)
    },
    reset: () => {
      draft = { pathname: getPathname(), fields: {} }
      touched.clear()
      applied.clear()
      observer?.disconnect()
      clearDraft(tabId, KEY)
    },
  }
}
