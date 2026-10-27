import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renewIfNeeded, renewSessionToken, tokenExpiresInMs, TOKEN_RENEWED_EVENT } from './sessionToken'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => data.clear(),
  } as Storage
}
const jwt = (expInMs: number) => `h.${btoa(JSON.stringify({ exp: Math.floor((Date.now() + expInMs) / 1000) })).replace(/=/g, '')}.s`
const MIN = 60 * 1000

describe('session token renewal', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'NEW' }) })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('last_activity_time', String(Date.now()))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('reads the expiry from the token', () => {
    expect(Math.round(tokenExpiresInMs(jwt(90 * MIN))! / MIN)).toBe(90)
    expect(tokenExpiresInMs('garbage')).toBeNull()
    expect(tokenExpiresInMs(null)).toBeNull()
  })

  it('renews an active user whose token has less than an hour left, and tells the app', async () => {
    localStorage.setItem('token', jwt(30 * MIN))
    const seen: string[] = []
    window.addEventListener(TOKEN_RENEWED_EVENT, (e) => seen.push((e as CustomEvent<string>).detail), { once: true })
    await renewIfNeeded()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/extend-session')
    expect(localStorage.getItem('token')).toBe('NEW')
    expect(seen).toEqual(['NEW'])
  })

  it('does not renew while plenty of time is left', async () => {
    localStorage.setItem('token', jwt(110 * MIN))
    await renewIfNeeded()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not renew an idle user (the 30-minute inactivity limit still applies)', async () => {
    localStorage.setItem('token', jwt(30 * MIN))
    localStorage.setItem('last_activity_time', String(Date.now() - 45 * MIN))
    await renewIfNeeded()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not try to extend an already expired token', async () => {
    localStorage.setItem('token', jwt(-5 * MIN))
    await renewIfNeeded()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends one request when several callers renew at once, and keeps the old token if the server refuses', async () => {
    localStorage.setItem('token', jwt(20 * MIN))
    const old = localStorage.getItem('token')
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    const results = await Promise.all([renewSessionToken(), renewSessionToken(), renewSessionToken()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results).toEqual([false, false, false])
    expect(localStorage.getItem('token')).toBe(old)
  })
})
