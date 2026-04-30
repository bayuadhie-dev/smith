import { useState, useEffect } from 'react'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    // Apply theme to document
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  return (
    <button
      onClick={toggleTheme}
      className={clsx(
        'relative inline-flex h-10 w-20 items-center rounded-full transition-all duration-300',
        'focus:outline-none focus:ring-4 focus:ring-blue-500/20',
        isDark 
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600' 
          : 'bg-gradient-to-r from-yellow-400 to-orange-500'
      )}
      aria-label="Toggle theme"
    >
      {/* Sliding circle */}
      <span
        className={clsx(
          'inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-all duration-300',
          'flex items-center justify-center',
          isDark ? 'translate-x-11' : 'translate-x-1'
        )}
      >
        {isDark ? (
          <MoonIcon className="h-5 w-5 text-indigo-600" />
        ) : (
          <SunIcon className="h-5 w-5 text-orange-500" />
        )}
      </span>

      {/* Background icons */}
      <span className="absolute left-2 top-2.5">
        <SunIcon className={clsx(
          'h-5 w-5 transition-opacity duration-300',
          isDark ? 'opacity-0' : 'opacity-100 text-white'
        )} />
      </span>
      <span className="absolute right-2 top-2.5">
        <MoonIcon className={clsx(
          'h-5 w-5 transition-opacity duration-300',
          isDark ? 'opacity-100 text-white' : 'opacity-0'
        )} />
      </span>
    </button>
  )
}
