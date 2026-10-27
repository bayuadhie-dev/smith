import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Copy, Pin, PinOff, Search, X } from 'lucide-react'
import { isTabDirty } from './drafts'
import { moduleById } from './modules'
import { useWorkspace, type TabState } from './WorkspaceContext'

interface Props {
  goModule: (moduleId: string) => void
  closeModule: (moduleId: string) => void
  /** Asks for confirmation when needed (unsaved input) and closes the given tabs. */
  closeTabs: (moduleId: string, tabs: TabState[]) => Promise<void>
}

const SHORTCUT_HINT = {
  close: 'Alt+Shift+W', next: 'Alt+Shift+→', prev: 'Alt+Shift+←', list: 'Alt+Shift+T', jump: 'Alt+Shift+1…9',
}

interface MenuState { x: number; y: number; moduleId: string; tab: TabState }

function ContextMenu({ menu, onClose, closeTabs }: { menu: MenuState; onClose: () => void; closeTabs: Props['closeTabs'] }) {
  const ws = useWorkspace()
  const ref = useRef<HTMLDivElement>(null)
  const tabs = ws.state.modules[menu.moduleId]?.tabs || []
  const idx = tabs.findIndex((t) => t.id === menu.tab.id)
  const others = tabs.filter((t) => t.id !== menu.tab.id && !t.pinned)
  const right = tabs.slice(idx + 1).filter((t) => !t.pinned)

  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const item = (label: string, onClick: () => void, opts: { icon?: React.ReactNode; hint?: string; disabled?: boolean; danger?: boolean } = {}) => (
    <button
      type="button"
      role="menuitem"
      disabled={opts.disabled}
      onClick={() => { onClose(); onClick() }}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${opts.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
    >
      <span className="flex h-4 w-4 items-center justify-center text-gray-400">{opts.icon}</span>
      <span className="flex-1">{label}</span>
      {opts.hint && <span className="text-[11px] text-gray-400">{opts.hint}</span>}
    </button>
  )

  const left = Math.min(menu.x, window.innerWidth - 240)
  const top = Math.min(menu.y, window.innerHeight - 250)
  return (
    <div ref={ref} role="menu" style={{ left, top }} className="fixed z-[70] w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
      {item('Duplikat tab', () => ws.duplicateTab(menu.moduleId, menu.tab.id), { icon: <Copy size={14} /> })}
      {item(menu.tab.pinned ? 'Lepas sematan' : 'Sematkan tab', () => ws.setPinned(menu.moduleId, menu.tab.id, !menu.tab.pinned), { icon: menu.tab.pinned ? <PinOff size={14} /> : <Pin size={14} /> })}
      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
      {item('Tutup', () => void closeTabs(menu.moduleId, [menu.tab]), { icon: <X size={14} />, hint: SHORTCUT_HINT.close })}
      {item('Tutup tab lain', () => void closeTabs(menu.moduleId, others), { disabled: !others.length })}
      {item('Tutup tab di kanan', () => void closeTabs(menu.moduleId, right), { disabled: !right.length })}
      {item('Tutup semua (kecuali tersemat)', () => void closeTabs(menu.moduleId, tabs.filter((t) => !t.pinned)), { danger: true, disabled: !tabs.some((t) => !t.pinned) })}
    </div>
  )
}

function TabSwitcher({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace()
  const { state } = ws
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const items = useMemo(() => {
    const all = state.order.flatMap((id) => (state.modules[id]?.tabs || []).map((t) => ({ moduleId: id, tab: t })))
    const needle = q.trim().toLowerCase()
    return needle ? all.filter(({ tab, moduleId }) => `${tab.title} ${moduleById(moduleId)?.label || ''}`.toLowerCase().includes(needle)) : all
  }, [state, q])

  useEffect(() => { setHi(0) }, [q])
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [onClose])

  const pick = (i: number) => {
    const it = items[i]
    if (!it) return
    ws.activateTab(it.moduleId, it.tab.id)
    onClose()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hi) }
  }

  return (
    <div ref={ref} className="absolute right-0 top-full z-[60] mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <Search size={14} className="text-gray-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Cari tab terbuka..." className="w-full bg-transparent text-sm outline-none" aria-label="Cari tab" />
        <span className="text-[11px] text-gray-400">{items.length}</span>
      </div>
      <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
        {items.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-400">Tidak ada tab yang cocok</li>}
        {items.map(({ moduleId, tab }, i) => {
          const active = moduleId === state.activeModule && tab.id === state.modules[moduleId].activeTabId
          return (
            <li key={tab.id} role="option" aria-selected={i === hi}>
              <button
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${i === hi ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
              >
                {tab.pinned && <Pin size={12} className="shrink-0 text-emerald-600" />}
                <span className={`min-w-0 flex-1 truncate ${active ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-200'}`}>{tab.title}</span>
                {isTabDirty(tab.id) && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Belum disimpan" />}
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-300">{moduleById(moduleId)?.label || moduleId}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400 dark:border-gray-700">↑↓ pilih · Enter buka · Esc tutup</div>
    </div>
  )
}

export default function TabBar({ goModule, closeModule, closeTabs }: Props) {
  const ws = useWorkspace()
  const { state } = ws
  const activeModuleId = state.activeModule
  const activeModuleState = activeModuleId ? state.modules[activeModuleId] : null
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [switcher, setSwitcher] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Keep the active tab visible when many tabs are open.
  useEffect(() => {
    const id = activeModuleState?.activeTabId
    tabRefs.current[id || '']?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeModuleState?.activeTabId, activeModuleId])

  // Keyboard shortcuts. Ctrl+W / Ctrl+Tab are reserved by the browser, so everything uses Alt+Shift.
  const latest = useRef({ state, closeTabs })
  latest.current = { state, closeTabs }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return
      const s = latest.current.state
      const modId = s.activeModule
      const m = modId ? s.modules[modId] : null
      if (!modId || !m) return
      const idx = m.tabs.findIndex((t) => t.id === m.activeTabId)
      const go = (i: number) => { const t = m.tabs[(i + m.tabs.length) % m.tabs.length]; if (t) ws.activateTab(modId, t.id) }
      const digit = /^Digit([1-9])$/.exec(e.code)
      if (e.code === 'KeyW') { const t = m.tabs[idx]; if (t && !t.pinned) void latest.current.closeTabs(modId, [t]) }
      else if (e.code === 'ArrowRight') go(idx + 1)
      else if (e.code === 'ArrowLeft') go(idx - 1)
      else if (e.code === 'KeyT') setSwitcher((v) => !v)
      else if (digit) { const t = m.tabs[Number(digit[1]) - 1]; if (t) ws.activateTab(modId, t.id) }
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ws])

  const endDrag = () => { setDragId(null); setOverId(null) }

  return (
    <div className="mb-3 space-y-2">
      {/* Level 1: modules */}
      <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden rounded-xl bg-gray-100/80 p-1 dark:bg-gray-800/60" role="tablist" aria-label="Modul">
        {state.order.map((id) => {
          const mod = moduleById(id)
          const active = id === activeModuleId
          const tabs = state.modules[id]?.tabs || []
          const anyDirty = tabs.some((t) => isTabDirty(t.id))
          return (
            <div
              key={id}
              role="tab"
              aria-selected={active}
              className={`group flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                active ? 'bg-white text-emerald-700 shadow-sm dark:bg-gray-900 dark:text-emerald-400' : 'text-gray-500 hover:bg-white/70 dark:text-gray-400 dark:hover:bg-gray-700/60'
              }`}
            >
              <button type="button" onClick={() => goModule(id)} className="flex items-center gap-1.5">
                {mod?.label || id}
                {tabs.length > 1 && <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>{tabs.length}</span>}
                {anyDirty && <span className="h-2 w-2 rounded-full bg-amber-500" title="Ada isian belum disimpan" />}
              </button>
              <button type="button" onClick={() => closeModule(id)} className={`rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 ${active ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label={`Tutup modul ${mod?.label}`}>
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Level 2: pages inside the active module */}
      {activeModuleState && activeModuleId && (
        <div className="relative flex items-end gap-1 border-b border-gray-200 dark:border-gray-700">
          <div className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto overflow-y-hidden pt-0.5 [scrollbar-width:thin]" role="tablist" aria-label="Halaman">
            {activeModuleState.tabs.map((tab, i) => {
              const active = tab.id === activeModuleState.activeTabId
              const dirty = isTabDirty(tab.id)
              return (
                <div
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el }}
                  role="tab"
                  aria-selected={active}
                  draggable
                  onDragStart={(e) => { setDragId(tab.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tab.id) }}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(tab.id) } }}
                  onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== tab.id) ws.reorderTab(activeModuleId, dragId, tab.id); endDrag() }}
                  onDragEnd={endDrag}
                  onMouseDown={(e) => { if (e.button === 1) e.preventDefault() }}
                  onAuxClick={(e) => { if (e.button === 1 && !tab.pinned) { e.preventDefault(); void closeTabs(activeModuleId, [tab]) } }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, moduleId: activeModuleId, tab }) }}
                  title={`${tab.title}${i < 9 ? `  (${SHORTCUT_HINT.jump.replace('1…9', String(i + 1))})` : ''}`}
                  className={`group relative -mb-px flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-[13px] transition-colors ${
                    tab.pinned ? 'max-w-[150px]' : 'max-w-[230px]'
                  } ${
                    active
                      ? 'border-gray-200 border-t-2 border-t-emerald-500 bg-white font-medium text-emerald-800 dark:border-gray-700 dark:border-t-emerald-500 dark:bg-gray-900 dark:text-emerald-300'
                      : 'border-transparent text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  } ${dragId === tab.id ? 'opacity-40' : ''} ${overId === tab.id && dragId !== tab.id ? 'ring-2 ring-inset ring-emerald-400' : ''}`}
                >
                  {tab.pinned && <Pin size={12} className="shrink-0 text-emerald-600" aria-label="Tersemat" />}
                  <button type="button" className="min-w-0 truncate" onClick={() => ws.activateTab(activeModuleId, tab.id)}>
                    {tab.title}
                  </button>
                  {dirty && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Belum disimpan" />}
                  {!tab.pinned && (
                    <button
                      type="button"
                      onClick={() => void closeTabs(activeModuleId, [tab])}
                      className={`shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}
                      aria-label={`Tutup ${tab.title}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="relative shrink-0 pb-1 pl-1">
            <button
              type="button"
              onClick={() => setSwitcher((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title={`Daftar semua tab (${SHORTCUT_HINT.list})`}
              aria-label="Daftar tab"
              aria-expanded={switcher}
            >
              <ChevronDown size={14} />
              <span>{state.order.reduce((n, id) => n + (state.modules[id]?.tabs.length || 0), 0)}</span>
            </button>
            {switcher && <TabSwitcher onClose={() => setSwitcher(false)} />}
          </div>
        </div>
      )}

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} closeTabs={closeTabs} />}
    </div>
  )
}
