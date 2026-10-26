export interface ModuleDef {
  id: string
  label: string
  prefixes: string[]
}

// Modules that get a top-level workspace tab; every other /app/* page renders normally.
export const MODULES: ModuleDef[] = [
  { id: 'finance', label: 'Finance', prefixes: ['/app/finance', '/app/accounting'] },
  { id: 'sales', label: 'Sales', prefixes: ['/app/sales', '/app/returns'] },
  { id: 'purchasing', label: 'Purchasing', prefixes: ['/app/purchasing'] },
  { id: 'production', label: 'Production', prefixes: ['/app/production'] },
  { id: 'warehouse', label: 'Warehouse', prefixes: ['/app/warehouse', '/app/wms'] },
  { id: 'hr', label: 'Human Resources', prefixes: ['/app/hr'] },
  { id: 'quality', label: 'Quality', prefixes: ['/app/quality'] },
]

export const MAX_TABS_PER_MODULE = Number.POSITIVE_INFINITY

export function moduleForPath(pathname: string): ModuleDef | null {
  return MODULES.find((m) => m.prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) || null
}

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id)
}

export function splitPath(path: string): { pathname: string; search: string } {
  const q = path.indexOf('?')
  const h = path.indexOf('#')
  const end = h >= 0 ? h : path.length
  return q >= 0 && q < end ? { pathname: path.slice(0, q), search: path.slice(q, end) } : { pathname: path.slice(0, end), search: '' }
}

const SEGMENT_WORDS: Record<string, string> = { new: 'Baru', edit: 'Ubah', create: 'Baru' }

// Fallback tab title when nothing was clicked (e.g. a deep link): "penerimaan-penjualan" -> "Penerimaan Penjualan".
export function pathLabel(path: string): string {
  const { pathname } = splitPath(path)
  const parts = pathname.split('/').filter(Boolean).slice(1) // drop "app"
  const named = parts.filter((p) => !/^\d+$/.test(p))
  const last = named[named.length - 1] || parts[0] || 'Halaman'
  const word = SEGMENT_WORDS[last] || last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const hasId = parts.some((p) => /^\d+$/.test(p))
  if (hasId && !SEGMENT_WORDS[last]) return `${word} #${parts.find((p) => /^\d+$/.test(p))}`
  if (hasId) return `${named[named.length - 2] ? named[named.length - 2].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''} ${word}`.trim()
  return word
}

export function isFormPath(pathname: string): boolean {
  return /\/(new|edit|create|input)(\/|$)/.test(pathname)
}
