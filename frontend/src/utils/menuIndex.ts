export interface MenuEntry { label: string; path: string[]; href: string }

let entries: MenuEntry[] = []

/** Daftar datar menu yang boleh dilihat pengguna (diisi Sidebar), dipakai pencarian Ctrl+K. */
export const setMenuEntries = (e: MenuEntry[]) => { entries = e }
export const getMenuEntries = () => entries

export function flattenMenu(groups: any[], allowed: (item: any) => boolean): MenuEntry[] {
  const out: MenuEntry[] = []
  const walk = (items: any[], trail: string[]) => {
    for (const it of items || []) {
      if (!allowed(it)) continue
      const here = [...trail, it.name]
      if (it.href && typeof it.href === 'string') out.push({ label: it.name, path: trail, href: it.href })
      walk(it.children, here)
      walk(it.subChildren, here)
    }
  }
  for (const g of groups) {
    if (g.show !== undefined && !g.show) continue
    walk(g.items, g.groupName && g.groupName !== 'MAIN' ? [g.groupName] : [])
  }
  const seen = new Set<string>()
  return out.filter((e) => (seen.has(e.href + e.label) ? false : (seen.add(e.href + e.label), true)))
}
