import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { StrictMode, useState } from 'react'
import { WorkspaceProvider } from './WorkspaceContext'
import Workspace from './Workspace'
import { registerAppRoutes } from './routeRegistry'
import { useDraftState } from './drafts'

function ListPage() {
  const nav = useNavigate()
  return (
    <div data-testid="list">
      <input placeholder="Catatan" data-testid="note" />
      <Link to="/app/finance/payments/18">PAY-18</Link>
      <a href="/app/finance/payments/20">PAY-20</a>
      <table><tbody><tr onClick={() => nav('/app/finance/payments/19')}><td>PAY-19</td><td>Alfamart</td></tr></tbody></table>
      <button onClick={() => nav('/app/finance/payments/new')}>Catat Baru</button>
    </div>
  )
}
function DetailPage() { return <div data-testid="detail">detail</div> }
function FormPage() {
  const nav = useNavigate()
  const [party, setParty, discard] = useDraftState('form', { party: '' })
  const [text, setText] = useState('')
  return (
    <div data-testid="form">
      <input placeholder="Nama" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={() => setParty({ party: 'ALFAMART' })}>pilih</button>
      <span data-testid="party">{party.party}</span>
      <button onClick={() => { discard(); nav('/app/finance/payments') }}>Batal</button>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="finance/payments" element={<ListPage />} />
      <Route path="finance/payments/new" element={<FormPage />} />
      <Route path="finance/payments/:id" element={<DetailPage />} />
      <Route path="*" element={<div>nf</div>} />
    </Routes>
  )
}

function Shell({ start = '/app/finance/payments' }: { start?: string }) {
  return (
    <StrictMode>
      <MemoryRouter initialEntries={[start]}>
        <WorkspaceProvider>
          <Workspace visible />
        </WorkspaceProvider>
      </MemoryRouter>
    </StrictMode>
  )
}

const tabTitles = () => screen.getAllByRole('tab').map((t) => t.textContent?.trim())

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

beforeEach(() => {
  cleanup()
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
  registerAppRoutes(AppRoutes)
})

describe('workspace tabs', () => {
  it('opens the page of the URL as a module tab with a list tab', async () => {
    render(<Shell />)
    await waitFor(() => expect(screen.getByTestId('list')).toBeTruthy())
    expect(tabTitles()).toContain('Finance')
    expect(tabTitles()).toContain('Payments')
    expect(tabTitles().filter((t) => t === 'Payments').length).toBe(1)   // StrictMode must not create a twin tab
  })

  it('opens a detail in a new tab titled with the clicked text and keeps the list state', async () => {
    render(<Shell />)
    await waitFor(() => expect(screen.getByTestId('list')).toBeTruthy())
    fireEvent.input(screen.getByTestId('note'), { target: { value: 'catatan saya' } })
    fireEvent.click(screen.getByText('PAY-18'))
    await waitFor(() => expect(screen.getByTestId('detail')).toBeTruthy())
    expect(tabTitles().some((t) => t?.startsWith('PAY-18'))).toBe(true)
    // the list is still mounted (hidden) with what was typed
    expect((screen.getByTestId('note') as HTMLInputElement).value).toBe('catatan saya')
    expect(screen.getByTestId('note').closest('[hidden]')).not.toBeNull()
  })

  it('a legacy plain <a href> opens a new tab with the link text instead of reloading the page', async () => {
    render(<Shell />)
    await waitFor(() => expect(screen.getByTestId('list')).toBeTruthy())
    fireEvent.click(screen.getByText('PAY-20'))
    await waitFor(() => expect(screen.getByTestId('detail')).toBeTruthy())
    expect(tabTitles().some((t) => t?.startsWith('PAY-20'))).toBe(true)
    expect(screen.getByTestId('list').closest('[hidden]')).not.toBeNull()
  })

  it('row click uses the first cell as the title, and the same detail is not opened twice', async () => {
    render(<Shell />)
    await waitFor(() => expect(screen.getByTestId('list')).toBeTruthy())
    fireEvent.click(screen.getByText('Alfamart'))
    await waitFor(() => expect(tabTitles().some((t) => t?.startsWith('PAY-19'))).toBe(true))
    fireEvent.click(screen.getByText('Payments'))
    fireEvent.click(screen.getAllByText('Alfamart')[0])
    await waitFor(() => expect(tabTitles().filter((t) => t?.startsWith('PAY-19')).length).toBe(1))
  })

  it('restores tabs and form drafts after a refresh', async () => {
    const first = render(<Shell />)
    await waitFor(() => expect(screen.getByTestId('list')).toBeTruthy())
    fireEvent.click(screen.getByText('Catat Baru'))
    await waitFor(() => expect(screen.getByTestId('form')).toBeTruthy())
    fireEvent.click(screen.getByText('pilih'))
    const nama = screen.getByPlaceholderText('Nama') as HTMLInputElement
    fireEvent.input(nama, { target: { value: 'Toko Maju' } })
    await act(async () => { await new Promise((r) => setTimeout(r, 450)) })
    first.unmount()

    render(<Shell start="/app/finance/payments/new" />)
    await waitFor(() => expect(screen.getByTestId('form')).toBeTruthy())
    await waitFor(() => expect(screen.getByTestId('party').textContent).toBe('ALFAMART'))
    await waitFor(() => expect((screen.getByPlaceholderText('Nama') as HTMLInputElement).value).toBe('Toko Maju'))
    expect(tabTitles().some((t) => t?.startsWith('Catat Baru'))).toBe(true)
    expect(tabTitles().some((t) => t === 'Payments')).toBe(true)
  })

  it('Batal (going up) closes the form tab and goes back to the existing list tab', async () => {
    render(<Shell />)
    await waitFor(() => expect(screen.getByTestId('list')).toBeTruthy())
    fireEvent.click(screen.getByText('Catat Baru'))
    await waitFor(() => expect(screen.getByTestId('form')).toBeTruthy())
    fireEvent.click(screen.getByText('Batal'))
    await waitFor(() => expect(screen.queryByTestId('form')).toBeNull())
    expect(tabTitles().some((t) => t?.startsWith('Catat Baru'))).toBe(false)
  })
})

import userEvent from '@testing-library/user-event'

describe('typing inside a tab', () => {
  it('keeps every typed character (first keystroke included)', async () => {
    render(<Shell start="/app/finance/payments/new" />)
    await waitFor(() => expect(screen.getByTestId('form')).toBeTruthy())
    const input = screen.getByPlaceholderText('Nama') as HTMLInputElement
    const user = userEvent.setup()
    await user.click(input)
    await user.keyboard('Toko Maju')
    expect(input.value).toBe('Toko Maju')
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(input.value).toBe('Toko Maju')
    // the form tab is marked as holding unsaved input
    expect(document.querySelector('[role="tab"] .bg-amber-500')).not.toBeNull()
  })
})
