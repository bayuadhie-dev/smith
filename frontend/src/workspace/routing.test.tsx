import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'

// Regression: with only <Route path="*"> under the /app layout route, the exact URL /app (dashboard) matched nothing.
const Inner = () => (
  <Routes>
    <Route index element={<div>INDEX</div>} />
    <Route path="finance/x" element={<div>FIN</div>} />
  </Routes>
)
const App = () => (
  <Routes>
    <Route path="/app" element={<div><Outlet /></div>}>
      <Route index element={<div>INDEX</div>} />
      <Route path="*" element={<Inner />} />
    </Route>
  </Routes>
)

describe('/app route tree', () => {
  it('renders the dashboard index at /app and pages below it', () => {
    const r1 = render(<MemoryRouter initialEntries={['/app']}><App /></MemoryRouter>)
    expect(screen.queryByText('INDEX')).toBeTruthy()
    r1.unmount()
    render(<MemoryRouter initialEntries={['/app/finance/x']}><App /></MemoryRouter>)
    expect(screen.queryByText('FIN')).toBeTruthy()
  })
})
