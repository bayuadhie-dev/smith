import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/redux'
import { login } from '../../store/slices/authSlice'
import axiosInstance from '../../utils/axiosConfig'
import toast from 'react-hot-toast'
import {
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  LockClosedIcon,
  ArrowRightIcon,
  CubeIcon,
  ChartBarIcon,
  CogIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [companyName, setCompanyName] = useState('ERP System')
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [accountLocked, setAccountLocked] = useState(false)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // Check for session expired message from redirect
  useEffect(() => {
    const state = location.state as { message?: string } | null
    if (state?.message) {
      setSessionMessage(state.message)
      toast.error(state.message, { duration: 5000 })
      // Clear the state so message doesn't show again on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location])

  useEffect(() => {
    loadCompanySettings()
    checkGoogleOAuth()
    // Load saved username if Remember Me was checked previously
    const savedUsername = localStorage.getItem('remembered_username')
    if (savedUsername) {
      setUsername(savedUsername)
      setRememberMe(true)
    }
  }, [])

  const loadCompanySettings = async () => {
    try {
      const response = await axiosInstance.get('/api/settings/company/public')
      if (response.data && response.data.name) {
        setCompanyName(response.data.name)
      }
    } catch (error) {
      console.error('Error loading company settings:', error)
    }
  }

  const checkGoogleOAuth = async () => {
    try {
      const response = await axiosInstance.get('/api/auth/google/url')
      setGoogleEnabled(!!response.data.url)
    } catch (error) {
      console.error('Error checking Google OAuth:', error)
      setGoogleEnabled(false)
    }
  }

  const handleGoogleLogin = async () => {
    const hostname = window.location.hostname
    const isPrivateIP = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')
    
    // Google OAuth tidak mendukung private IP
    if (isPrivateIP) {
      toast.error('Login Google hanya tersedia di production. Silakan login dengan username/password.')
      return
    }
    
    setGoogleLoading(true)
    
    try {
      // Get Google OAuth URL from backend
      const response = await axiosInstance.get('/api/auth/google/url')
      if (response.data.url) {
        window.location.href = response.data.url
      } else {
        toast.error('Google OAuth not configured')
        setGoogleLoading(false)
      }
    } catch (error: any) {
      console.error('Error getting Google OAuth URL:', error)
      toast.error(error.response?.data?.error || 'Gagal terhubung ke Google')
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setRemainingAttempts(null)
    setAccountLocked(false)

    try {
      const loginResult = await dispatch(login({ username, password })).unwrap()
      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem('remembered_username', username)
      } else {
        localStorage.removeItem('remembered_username')
      }
      // Reset session tracking for new login
      localStorage.setItem('session_start_time', Date.now().toString())
      localStorage.setItem('last_activity_time', Date.now().toString())
      
      // The dynamic/random greeting is shown as the Dashboard page heading right
      // after redirect (see DashboardEnhanced.tsx) - showing it here too produced
      // two different random greetings stacked on screen. Keep this toast short.
      toast.success('Login berhasil!', { duration: 3000 });
      // SPA navigation - Redux auth state is already populated by login.fulfilled,
      // so a hard reload here only causes a blank-screen flash and a redundant
      // checkAuth() on remount. RoleBasedRedirect at '/' handles the redirect.
      navigate('/', { replace: true })
    } catch (error: any) {
      // Check if account is locked
      if (error.includes('locked') || error.includes('Account locked')) {
        setAccountLocked(true)
        toast.error(error, { duration: 6000 })
      } else {
        // Extract remaining attempts from error message if available
        const attemptsMatch = error.match(/(\d+) attempts? remaining/)
        if (attemptsMatch) {
          const attempts = parseInt(attemptsMatch[1])
          setRemainingAttempts(attempts)
          if (attempts <= 2) {
            toast.error(`Warning: Only ${attempts} attempts remaining before account lockout!`, { duration: 5000 })
          } else {
            toast.error(error)
          }
        } else {
          toast.error(error || 'Login failed')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: ChartBarIcon, text: 'Real-time Analytics' },
    { icon: CogIcon, text: 'Production Management' },
    { icon: CubeIcon, text: 'Inventory Control' },
    { icon: ShieldCheckIcon, text: 'Quality Assurance' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#065f46] relative">
        <div className="flex flex-col justify-between w-full px-12 xl:px-20 py-14">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-base font-semibold text-[#047857]">
              {companyName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'ER'}
            </span>
            <span className="text-lg font-semibold text-white">{companyName}</span>
          </div>
          <div>
            <h1 className="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight text-white">
              Dari bahan baku<br />sampai faktur.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-emerald-100/90">
              Produksi, gudang, mutu, penjualan, pembelian, keuangan, dan SDM dalam satu sistem.
            </p>
          </div>
          <p className="text-sm text-emerald-100/70">Sistem ERP manufaktur</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#047857] rounded-lg flex items-center justify-center text-base font-semibold text-white">
                {companyName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'ER'}
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{companyName}</span>
            </div>
          </div>

          {/* Session Expired Banner */}
          {sessionMessage && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {sessionMessage}
                </p>
              </div>
            </div>
          )}

          {/* Akun terkunci Warning */}
          {accountLocked && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <ShieldCheckIcon className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Account Locked
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    Terlalu banyak percobaan masuk yang gagal. Tunggu 5 menit lalu coba lagi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Remaining Attempts Warning */}
          {remainingAttempts !== null && remainingAttempts <= 2 && !accountLocked && (
            <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Peringatan: sisa {remainingAttempts} kali percobaan
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Akun akan dikunci 5 menit setelah {remainingAttempts} kali gagal lagi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Welcome Text */}
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Masuk ke sistem
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Gunakan nama pengguna dan kata sandi Anda.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Nama pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all"
                  placeholder="Nama pengguna"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kata sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all"
                  placeholder="Kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#059669] focus:ring-[#059669] cursor-pointer"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Ingat saya</span>
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-[#059669] hover:text-emerald-700 transition-colors">
                Lupa kata sandi?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-50 dark:bg-slate-900 text-slate-500">atau</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={!googleEnabled || googleLoading}
              className={`w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:ring-offset-2 transition-all duration-300 ${(!googleEnabled || googleLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {googleLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent"></div>
                  <span>Menghubungkan ke Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Masuk dengan Google</span>
                </>
              )}
            </button>
            
            {!googleEnabled && (
              <p className="text-xs text-center text-slate-400">
                Google login is not configured
              </p>
            )}
          </div>

          {/* Register Link */}
          <div className="text-center mt-6">
            <p className="text-slate-600 dark:text-slate-400">
              Belum punya akun?{' '}
              <Link to="/register" className="font-semibold text-[#059669] hover:text-emerald-700 transition-colors">
                Daftar
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} {companyName}
          </div>
        </div>
      </div>
    </div>
  )
}
