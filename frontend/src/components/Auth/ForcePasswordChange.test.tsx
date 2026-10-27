import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { setCredentials } from '../../store/slices/authSlice'
import ForcePasswordChange from './ForcePasswordChange'

const post = vi.fn()
vi.mock('../../utils/axiosConfig', () => ({ default: { post: (...a: any[]) => post(...a) } }))

function setup(mustChange: boolean | undefined) {
  const store = configureStore({ reducer: { auth: authReducer } })
  store.dispatch(setCredentials({ token: 't', user: { id: 1, username: 'hr', email: 'hr@x', full_name: 'HR', is_admin: false, is_super_admin: false, roles: [], must_change_password: mustChange } }))
  render(<Provider store={store}><ForcePasswordChange /></Provider>)
  return store
}
const fill = (cur: string, next: string, conf: string) => {
  fireEvent.change(screen.getByPlaceholderText('Password sementara'), { target: { value: cur } })
  fireEvent.change(screen.getByPlaceholderText('Password baru'), { target: { value: next } })
  fireEvent.change(screen.getByPlaceholderText('Ulangi password baru'), { target: { value: conf } })
}

describe('ForcePasswordChange', () => {
  beforeEach(() => { cleanup(); post.mockReset() })

  it('renders nothing when no change is required', () => {
    setup(false)
    expect(screen.queryByText('Ganti password dulu')).toBeNull()
  })

  it('blocks with a modal when must_change_password is true', () => {
    setup(true)
    expect(screen.getByText('Ganti password dulu')).toBeTruthy()
  })

  it('rejects mismatched confirmation without calling the API', () => {
    setup(true)
    fill('Fengsheng#26', 'Baru#12345', 'Beda#12345')
    fireEvent.click(screen.getByText('Simpan password'))
    expect(screen.getByText('Konfirmasi password baru tidak sama')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps the modal on failure', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Password must contain at least one number' } } })
    setup(true)
    fill('Fengsheng#26', 'BaruSaja#', 'BaruSaja#')
    fireEvent.click(screen.getByText('Simpan password'))
    await waitFor(() => expect(screen.getByText('Password must contain at least one number')).toBeTruthy())
    expect(screen.getByText('Ganti password dulu')).toBeTruthy()
  })

  it('posts the change and unlocks on success', async () => {
    post.mockResolvedValue({ data: {} })
    const store = setup(true)
    fill('Fengsheng#26', 'Baru#12345', 'Baru#12345')
    fireEvent.click(screen.getByText('Simpan password'))
    await waitFor(() => expect(screen.queryByText('Ganti password dulu')).toBeNull())
    expect(post).toHaveBeenCalledWith('/api/auth/change-password', { current_password: 'Fengsheng#26', new_password: 'Baru#12345' })
    expect(store.getState().auth.user?.must_change_password).toBe(false)
  })

  it('eye icon toggles visibility per field', () => {
    setup(true)
    const input = screen.getByPlaceholderText('Password baru') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.click(screen.getAllByLabelText('Tampilkan password')[1])
    expect(input.type).toBe('text')
    expect((screen.getByPlaceholderText('Password sementara') as HTMLInputElement).type).toBe('password')
    fireEvent.click(screen.getByLabelText('Sembunyikan password'))
    expect(input.type).toBe('password')
  })

  it('shows live rule checklist and mismatch hint', () => {
    setup(true)
    fireEvent.change(screen.getByPlaceholderText('Password baru'), { target: { value: 'abc' } })
    expect(screen.getByText('Huruf besar (A-Z)')).toBeTruthy()
    expect(screen.getByText('Huruf besar (A-Z)').className).not.toContain('emerald')
    expect(screen.getByText('Huruf kecil (a-z)').closest('li')!.className).toContain('emerald')
    fireEvent.change(screen.getByPlaceholderText('Ulangi password baru'), { target: { value: 'abd' } })
    expect(screen.getByText('Konfirmasi belum sama dengan password baru')).toBeTruthy()
  })
})
