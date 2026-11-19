import { confirmDialog } from '../components/ui'
import { clearTabDrafts } from './drafts'

/**
 * One confirmation for every "Batal" button in the app.
 *
 * Finance asked for a warning before Batal throws away what they typed. Doing
 * that per form would mean touching ~40 files and would be forgotten on the
 * next form, so it is caught once here with two capture-phase listeners: one
 * notes that the user really typed something inside a tab, the other sees the
 * Batal click before React does and asks first. A form nobody touched - or one
 * only filled in by the app itself, like a default address - is cancelled
 * straight away without a dialog.
 *
 * The tab "dirty" flag from drafts.ts is deliberately NOT used here: it also
 * turns on when a form prefills itself, which would put the dialog in front of
 * every Batal click.
 */

const CANCEL_LABEL = /^(batal|batalkan|cancel)$/i

/** tab pane id -> the path that was open when the user typed in it. */
const touched = new Map<string, string>()

/** Buttons we already asked about, re-dispatched after the user confirmed. */
const allowed = new WeakSet<Element>()

let installed = false

function paneOf(el: Element): string | null {
  return el.closest('[data-tab-pane]')?.getAttribute('data-tab-pane') || null
}

function isRealField(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  if (['password', 'file', 'hidden', 'search', 'button', 'submit', 'reset', 'image'].includes(el.type)) return false
  // Typing in a list's search box is not unsaved work.
  return !/cari|search/i.test(el.placeholder || '')
}

function labelOf(el: Element): string {
  const text = (el.getAttribute('aria-label') || el.textContent || '').trim()
  return text.length > 20 ? '' : text
}

export function installCancelGuard() {
  if (installed || typeof document === 'undefined') return
  installed = true

  const onEdit = (e: Event) => {
    if (!e.isTrusted || !(e.target instanceof Element)) return
    if (!isRealField(e.target)) return
    const pane = paneOf(e.target)
    if (pane) touched.set(pane, location.pathname)
  }
  document.addEventListener('input', onEdit, true)
  document.addEventListener('change', onEdit, true)

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return
    const target = e.target
    if (!(target instanceof Element)) return
    const el = target.closest('a,button')
    if (!el || allowed.has(el)) return
    if (el.hasAttribute('data-no-cancel-guard') || el.closest('[data-no-cancel-guard]')) return
    if (!CANCEL_LABEL.test(labelOf(el))) return

    const pane = paneOf(el)
    if (!pane || touched.get(pane) !== location.pathname) return

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    confirmDialog('Isian yang belum disimpan akan hilang. Yakin ingin membatalkan?', {
      title: 'Batalkan pengisian?',
      confirmText: 'Ya, batalkan',
      cancelText: 'Lanjut mengisi',
    }).then((ok) => {
      if (!ok) return
      touched.delete(pane)
      // The saved draft is part of the abandoned input; keeping it would restore
      // the form the next time the page is opened.
      clearTabDrafts(pane)
      allowed.add(el)
      try {
        (el as HTMLElement).click()
      } finally {
        allowed.delete(el)
      }
    })
  }, true)
}
