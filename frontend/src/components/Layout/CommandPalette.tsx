import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import { getMenuEntries } from '../../utils/menuIndex'
import { useDebounce } from '../../hooks/useDebounce'

export const OPEN_PALETTE_EVENT = 'erp-open-palette'

const MODULE_LABEL: Record<string, string> = {
  products: 'Products', production: 'Production', sales: 'Sales', purchasing: 'Purchasing', hr: 'Human Resources',
  dcc: 'Document Control', finance: 'Finance', shipping: 'Shipping', maintenance: 'Maintenance',
}

interface Item { key: string; kind: 'menu' | 'data'; title: string; subtitle?: string; module: string; href: string; type?: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 250)
  const [data, setData] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOpen = () => { setOpen(true); setQ(''); setData([]); setActive(0) }
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    const term = dq.trim()
    if (!open || term.length < 2) { setData([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    axiosInstance.get('/api/search/global', { params: { q: term, limit: 8 } })
      .then((r) => {
        if (cancelled) return
        setData((r.data?.data?.results || []).map((x: any) => ({
          key: `d-${x.type}-${x.id}`, kind: 'data' as const, title: x.title, subtitle: x.subtitle, module: x.module, href: x.url, type: x.type,
        })))
      })
      .catch(() => { if (!cancelled) setData([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dq, open])

  const menu = useMemo<Item[]>(() => {
    const term = norm(q.trim())
    if (!open || !term) return []
    const words = term.split(/\s+/)
    return getMenuEntries()
      .map((e) => ({ e, hay: norm(`${e.label} ${e.path.join(' ')}`) }))
      .filter(({ hay }) => words.every((w) => hay.includes(w)))
      .sort((a, b) => Number(norm(b.e.label).startsWith(term)) - Number(norm(a.e.label).startsWith(term)))
      .slice(0, 8)
      .map(({ e }) => ({ key: `m-${e.href}-${e.label}`, kind: 'menu' as const, title: e.label, subtitle: e.path.slice(1).join(' › ') || e.path[0], module: e.path[1] || e.path[0] || 'Menu', href: e.href }))
  }, [q, open])

  const items = useMemo(() => [...menu, ...data], [menu, data])
  useEffect(() => { setActive(0) }, [q, data])
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])

  const close = () => setOpen(false)
  const go = (it: Item) => { close(); navigate(it.href) }

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]) }
  }

  const row = (it: Item, i: number) => (
    <button key={it.key} type="button" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(it)} role="option" aria-selected={i === active}
      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${i === active ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}>
      <span className="min-w-0">
        <span className="block truncate font-medium text-gray-900 dark:text-white">{it.title}</span>
        {it.subtitle && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{it.subtitle}</span>}
      </span>
      <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        {it.kind === 'data' ? `${it.type} · ${MODULE_LABEL[it.module] || it.module}` : MODULE_LABEL[it.module] || it.module}
      </span>
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-start justify-center p-4 pt-[12vh]" role="presentation" onKeyDown={onKey}>
      <div className="ui-dialog-overlay fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={close} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Pencarian cepat" className="ui-dialog-panel relative w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 dark:border-gray-700">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu, dokumen, produk, pelanggan, pemasok..."
            className="w-full bg-transparent py-4 text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white" aria-label="Cari" />
          <kbd className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-500 dark:border-gray-600">Esc</kbd>
        </div>
        <div ref={listRef} role="listbox" className="max-h-[55vh] overflow-y-auto py-1">
          {!q.trim() && <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Ketik nama menu, nomor dokumen (SO, PO, faktur, surat jalan, SPK), atau nama produk, pelanggan, pemasok.</p>}
          {menu.length > 0 && <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Menu</p>}
          {menu.map((it, i) => row(it, i))}
          {data.length > 0 && <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Data</p>}
          {data.map((it, i) => row(it, menu.length + i))}
          {q.trim().length >= 2 && loading && <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Mencari data...</p>}
          {q.trim() && !loading && items.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Tidak ada hasil untuk &quot;{q}&quot;.</p>}
        </div>
        <div className="flex gap-4 border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-700">
          <span>↑↓ pilih</span><span>Enter buka</span><span>Esc tutup</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
