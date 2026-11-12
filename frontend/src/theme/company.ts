import axiosInstance from '../utils/axiosConfig'

const KEY = 'company_theme'

const fromEnvOrHost = (): string | null => {
  const env = (import.meta as any).env?.VITE_COMPANY_THEME
  if (env) return String(env).toLowerCase()
  return /fsnindonesia/i.test(window.location.hostname) ? 'fengsheng' : null
}

const apply = (theme: string | null) => {
  if (theme) document.documentElement.setAttribute('data-company', theme)
  else document.documentElement.removeAttribute('data-company')
}

export function initCompanyTheme() {
  let known: string | null = null
  try { known = localStorage.getItem(KEY) } catch { /* abaikan */ }
  const initial = fromEnvOrHost() || known
  apply(initial)
  if (initial) return
  // Akses lewat alamat IP/hostname lain: tentukan dari nama perusahaan di pengaturan sistem.
  axiosInstance.get('/api/company/public').then((r) => {
    const name = String(r.data?.name || r.data?.company_name || r.data?.company?.name || '')
    const theme = /fengsheng/i.test(name) ? 'fengsheng' : null
    apply(theme)
    try { theme ? localStorage.setItem(KEY, theme) : localStorage.removeItem(KEY) } catch { /* abaikan */ }
  }).catch(() => undefined)
}
