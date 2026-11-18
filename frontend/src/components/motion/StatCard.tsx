import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import CountUp from './CountUp'
import { ProgressBar } from './Bars'
import { useMotionOn } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface StatCardProps {
  label: string
  /** Small icon in a soft tinted tile; gives the card a visual anchor. */
  icon?: ReactNode
  value: number
  /** Number formatter (e.g. rupiah). Defaults to Indonesian thousands. */
  format?: (n: number) => string
  /** Colour class for the figure, following the data tone (neutral/warn/bad). */
  valueClassName?: string
  /** 0-1; when set, a thin bar appears under the figure. */
  progress?: number
  progressClassName?: string
  /** Small line under the figure (e.g. delta against the previous period). */
  footer?: ReactNode
  className?: string
}

/**
 * Dashboard figure card: the number counts up, an optional bar, and a small
 * lift on hover. The data stays the caller's - this component is only a way of
 * presenting it.
 */
export default function StatCard({
  label, value, format, valueClassName, progress, progressClassName, footer, className, icon,
}: StatCardProps) {
  const motionOn = useMotionOn()
  return (
    <motion.div
      className={'group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50 p-3.5 sm:rounded-2xl sm:p-5 '
        + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.35)] '
        + 'transition-shadow hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_20px_40px_-20px_rgba(16,24,40,0.45)] '
        + `dark:border-gray-700/80 dark:from-gray-800 dark:to-gray-900 ${className || ''}`}
      whileHover={motionOn ? { y: -4 } : undefined}
      transition={{ duration: 0.2, ease: EASE }}
    >
      {/* Soft corner glow: reads as a surface rather than a flat box. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary-500/10 blur-2xl dark:bg-primary-400/10" />
      {icon && (
        <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:ring-primary-800/60 sm:mb-3 sm:h-10 sm:w-10 sm:rounded-xl">
          {icon}
        </span>
      )}
      <p className="line-clamp-2 min-h-[1.9em] text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-gray-500 dark:text-gray-400 sm:text-[11px] sm:tracking-[0.12em] lg:line-clamp-1 lg:min-h-0">{label}</p>
      <p className={`mt-1 truncate text-xl font-bold leading-tight tracking-tight sm:text-[2rem] ${valueClassName || 'text-gray-900 dark:text-white'}`}>
        <CountUp value={value} format={format} />
      </p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-2" barClassName={progressClassName} />}
      {footer ? <div className="mt-1 text-xs">{footer}</div> : <p className="mt-1 text-xs text-gray-400">&nbsp;</p>}
    </motion.div>
  )
}
