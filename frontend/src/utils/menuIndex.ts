import type { ComponentType, SVGProps } from 'react'

export interface MenuEntry {
  /** Nama menu yang benar-benar bisa dibuka (daun), mis. "Kas Kecil". */
  label: string
  /** Jalur grup dan induknya, mis. ["Finance & HR", "Human Resources"]. */
  path: string[]
  href: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

let entries: MenuEntry[] = []

/** Daftar datar menu yang boleh dilihat pengguna (diisi Sidebar), dipakai pencarian. */
export const setMenuEntries = (e: MenuEntry[]) => { entries = e }
export const getMenuEntries = () => entries

/** Buang tanda baca dan huruf berdiakritik supaya "Pre-Shift" cocok dengan "pre shift". */
export const normalizeTerm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Semua menu daun (punya href) yang lolos pemeriksaan izin, beserta jalurnya. */
export function flattenMenu(groups: any[], allowed: (item: any) => boolean): MenuEntry[] {
  const out: MenuEntry[] = []
  const walk = (items: any[], trail: string[], inherited?: MenuEntry['icon']) => {
    for (const it of items || []) {
      if (!it || !allowed(it)) continue
      const icon = it.icon || inherited
      const kids = [...(it.children || []), ...(it.subChildren || [])]
      if (it.href && typeof it.href === 'string') out.push({ label: it.name, path: trail, href: it.href, icon })
      if (kids.length) walk(kids, [...trail, it.name], icon)
    }
  }
  for (const g of groups) {
    if (g.show !== undefined && !g.show) continue
    walk(g.items, g.groupName && g.groupName !== 'MAIN' ? [g.groupName] : [])
  }
  const seen = new Set<string>()
  return out.filter((e) => {
    const key = `${e.href}|${e.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Menu yang cocok dengan semua kata kunci; yang namanya diawali kata kunci didahulukan. */
export function searchMenu(term: string, limit = 12): MenuEntry[] {
  const q = normalizeTerm(term)
  if (!q) return []
  const words = q.split(' ')
  const scored: { e: MenuEntry; score: number }[] = []
  for (const e of entries) {
    const label = normalizeTerm(e.label)
    const hay = `${label} ${normalizeTerm(e.path.join(' '))}`
    if (!words.every((w) => hay.includes(w))) continue
    const score = label === q ? 0 : label.startsWith(q) ? 1 : label.includes(q) ? 2 : 3
    scored.push({ e, score })
  }
  scored.sort((a, b) => a.score - b.score || a.e.label.length - b.e.label.length)
  return scored.slice(0, limit).map((s) => s.e)
}
