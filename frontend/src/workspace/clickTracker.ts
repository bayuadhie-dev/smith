// Remembers the element that was just clicked, but only for the rest of that click's own event dispatch.
// A navigation triggered synchronously by a click (link / row / button) is "user navigation" and opens a
// new tab titled with the clicked text; a navigation after an await (e.g. after saving) is not.

export interface ClickInfo {
  title: string
  target: Element
}

let active: ClickInfo | null = null
let installed = false

const GENERIC_ACTION = /^(view|detail|details|lihat|edit|ubah|buka|open|show|more|\.\.\.)$/i

const clean = (t: string | null | undefined) => (t || '').replace(/\s+/g, ' ').trim()

function firstCellText(row: Element): string {
  for (const cell of Array.from(row.querySelectorAll('td,th,[role="cell"],[role="gridcell"]'))) {
    const t = clean(cell.textContent)
    if (t && t.length <= 60) return t
  }
  return ''
}

export function titleFromElement(el: Element): string {
  const link = el.closest('a,button,[role="button"],[role="menuitem"],[role="link"]')
  const row = el.closest('tr,[role="row"]')
  const explicit = clean(el.closest('[data-tab-title]')?.getAttribute('data-tab-title'))
  if (explicit) return explicit.length > 60 ? explicit.slice(0, 57) + '…' : explicit
  let text = link ? clean(link.textContent) : ''
  if (row && (!text || text.length > 60 || GENERIC_ACTION.test(text) || link?.getAttribute('title'))) {
    const cell = firstCellText(row)
    if (cell) text = cell
  }
  if (!text) text = clean((el.closest('[title]') as HTMLElement | null)?.title)
  if (text.length > 60) text = text.slice(0, 57) + '…'
  return text
}

export function installClickTracker() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target
      if (!(el instanceof Element)) return
      active = { title: titleFromElement(el), target: el }
      setTimeout(() => { active = null }, 0)
    },
    true,
  )
}

export function currentClick(): ClickInfo | null {
  return active
}
