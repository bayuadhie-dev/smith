import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { checkAuth } from './authSlice'

vi.mock('axios')

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

const store = () => configureStore({ reducer: { auth: authReducer } })

describe('checkAuth', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
    vi.useFakeTimers()
    localStorage.setItem('token', 'tok')
  })
  afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); localStorage.clear() })

  it('keeps the token and retries while the backend is restarting', async () => {
    const get = vi.mocked(axios.get)
    get.mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValueOnce({ data: { id: 1, username: 'u', full_name: 'U', user: { id: 1 } } })
    const s = store()
    const p = s.dispatch(checkAuth())
    await vi.runAllTimersAsync()
    await p
    expect(get).toHaveBeenCalledTimes(3)
    expect(localStorage.getItem('token')).toBe('tok')
    expect(s.getState().auth.isAuthenticated).toBe(true)
  })

  it('removes the token only when the server rejects it', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } })
    const s = store()
    await s.dispatch(checkAuth())
    expect(localStorage.getItem('token')).toBeNull()
    expect(s.getState().auth.isAuthenticated).toBe(false)
  })

  it('keeps the token when the server never comes back', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 503 } })
    const s = store()
    const p = s.dispatch(checkAuth())
    await vi.runAllTimersAsync()
    await p
    expect(localStorage.getItem('token')).toBe('tok')
    expect(s.getState().auth.isAuthenticated).toBe(false)
  })
})
