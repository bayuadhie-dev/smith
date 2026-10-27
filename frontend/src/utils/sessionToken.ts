// Sliding session: while the user is active the access token is renewed in the background, so nobody is logged out
// in the middle of work just because the token's 2 hours are up. Renewal uses /auth/extend-session (needs a still-valid
// token), so the 30-minute inactivity limit enforced by SessionTimeoutModal keeps working: an idle user is not renewed.

const TOKEN_KEY = 'token'
const ACTIVITY_KEY = 'last_activity_time'
export const TOKEN_RENEWED_EVENT = 'auth-token-renewed'

const RENEW_WHEN_LESS_THAN_MS = 60 * 60 * 1000   // renew once less than 1 hour of the token is left
const ACTIVE_WITHIN_MS = 30 * 60 * 1000          // ... and the user did something in the last 30 minutes
const CHECK_EVERY_MS = 60 * 1000

const apiBase = () => {
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL).replace(/\/api$/, '')
  const host = window.location.hostname
  return host === 'erp.graterp.my.id' || host.endsWith('.graterp.my.id') ? 'https://api.graterp.my.id' : `http://${host}:5000`
}

export function tokenExpiresInMs(token: string | null | undefined): number | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 - Date.now() : null
  } catch {
    return null
  }
}

/** Stores a new token and tells the rest of the app (Redux) about it. */
export function setSessionToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  window.dispatchEvent(new CustomEvent(TOKEN_RENEWED_EVENT, { detail: token }))
}

let inFlight: Promise<boolean> | null = null

export function renewSessionToken(): Promise<boolean> {
  if (inFlight) return inFlight
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return Promise.resolve(false)
  inFlight = fetch(`${apiBase()}/api/auth/extend-session`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    .then(async (res) => {
      if (!res.ok) return false
      const data = await res.json()
      if (!data.access_token) return false
      setSessionToken(data.access_token)
      return true
    })
    .catch(() => false)
    .finally(() => { inFlight = null })
  return inFlight
}

const recentlyActive = () => Date.now() - Number(localStorage.getItem(ACTIVITY_KEY) || 0) < ACTIVE_WITHIN_MS

export async function renewIfNeeded(): Promise<void> {
  const left = tokenExpiresInMs(localStorage.getItem(TOKEN_KEY))
  if (left === null || left <= 0) return           // no token, or already expired: nothing to extend
  if (left < RENEW_WHEN_LESS_THAN_MS && recentlyActive()) await renewSessionToken()
}

/** Call once while signed in; returns the cleanup function. */
export function startAutoRenew(): () => void {
  void renewIfNeeded()
  const id = setInterval(() => void renewIfNeeded(), CHECK_EVERY_MS)
  return () => clearInterval(id)
}
