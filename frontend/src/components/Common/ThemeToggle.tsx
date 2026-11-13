import { useState, useEffect, type MouseEvent } from 'react'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { withThemeFlip } from '../../utils/motion'

interface Props {
  /** Sidebar diciutkan: tampil sebagai satu tombol ikon. */
  collapsed?: boolean
}

export default function ThemeToggle({ collapsed = false }: Props) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const choose = (dark: boolean, e?: MouseEvent) => {
    if (dark === isDark) return
    withThemeFlip(() => {
      document.documentElement.classList.toggle('dark', dark)
      setIsDark(dark)
    }, e ? { x: e.clientX, y: e.clientY } : undefined)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={(e) => choose(!isDark, e)}
        title={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
        aria-label={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <SunIcon className={clsx('absolute h-[18px] w-[18px] transition-all duration-300', isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')} aria-hidden="true" />
        <MoonIcon className={clsx('absolute h-[18px] w-[18px] transition-all duration-300', isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')} aria-hidden="true" />
      </button>
    )
  }

  const option = (dark: boolean, label: string, Icon: typeof SunIcon) => {
    const active = isDark === dark
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={(e) => choose(dark, e)}
        className={clsx(
          'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          active ? 'text-white' : 'text-white/55 hover:text-white/85',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    )
  }

  return (
    <div role="radiogroup" aria-label="Tema tampilan" className="relative flex w-full rounded-lg bg-white/[0.06] p-0.5 ring-1 ring-white/10">
      <span
        aria-hidden="true"
        className={clsx(
          'absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-white/15 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isDark ? 'translate-x-full' : 'translate-x-0',
        )}
      />
      {option(false, 'Terang', SunIcon)}
      {option(true, 'Gelap', MoonIcon)}
    </div>
  )
}
