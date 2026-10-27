import { useState } from 'react'
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logout, passwordChanged } from '../../store/slices/authSlice'
import axiosInstance from '../../utils/axiosConfig'

const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'Minimal 8 karakter', test: (p) => p.length >= 8 },
  { label: 'Huruf besar (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Huruf kecil (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'Angka (0-9)', test: (p) => /\d/.test(p) },
  { label: 'Simbol (!@#$%^&* dll)', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/;'`~]/.test(p) },
]

function PasswordField({ value, onChange, placeholder, autoComplete, onCaps }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete: string
  onCaps: (on: boolean) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="input-field w-full pr-11"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={(e) => onCaps(e.getModifierState('CapsLock'))}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        title={show ? 'Sembunyikan' : 'Tampilkan'}
      >
        {show ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  )
}

export default function ForcePasswordChange() {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [caps, setCaps] = useState(false)

  if (!user?.must_change_password) return null

  const passed = RULES.filter((r) => r.test(next)).length
  const allRules = passed === RULES.length
  const mismatch = confirm.length > 0 && confirm !== next
  const barColor = passed <= 2 ? 'bg-red-500' : passed <= 4 ? 'bg-amber-500' : 'bg-emerald-500'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) {
      setError('Konfirmasi password baru tidak sama')
      return
    }
    setSaving(true)
    try {
      await axiosInstance.post('/api/auth/change-password', { current_password: current, new_password: next })
      dispatch(passwordChanged())
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Gagal mengganti password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center p-4"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(17, 24, 39, 0.75)' }}
      role="dialog"
      aria-modal="true"
    >
      <form onSubmit={submit} className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ganti password dulu</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Akun {user.username} dibuat oleh admin dengan password sementara. Buat password baru sebelum memakai sistem.
          </p>
        </div>

        <PasswordField value={current} onChange={setCurrent} placeholder="Password sementara" autoComplete="current-password" onCaps={setCaps} />
        <PasswordField value={next} onChange={setNext} placeholder="Password baru" autoComplete="new-password" onCaps={setCaps} />

        {next.length > 0 && (
          <div className="space-y-2">
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className={`h-full transition-all ${barColor}`} style={{ width: `${(passed / RULES.length) * 100}%` }} />
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {RULES.map((r) => {
                const ok = r.test(next)
                return (
                  <li key={r.label} className={`flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-gray-500 dark:text-gray-400'}`}>
                    {ok ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                    {r.label}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <PasswordField value={confirm} onChange={setConfirm} placeholder="Ulangi password baru" autoComplete="new-password" onCaps={setCaps} />
        {mismatch && <p className="text-xs text-red-600">Konfirmasi belum sama dengan password baru</p>}
        {confirm.length > 0 && !mismatch && allRules && <p className="text-xs text-emerald-600">Password cocok</p>}
        {caps && <p className="text-xs text-amber-600">Caps Lock sedang aktif</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={() => dispatch(logout())}>Keluar</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan password'}</button>
        </div>
      </form>
    </div>
  )
}
