import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import CountUp from './CountUp'
import { ProgressBar } from './Bars'
import { useMotionOn } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface StatCardProps {
  label: string
  value: number
  /** Pemformat angka (mis. rupiah). Bawaan: ribuan gaya Indonesia. */
  format?: (n: number) => string
  /** Kelas warna angka, mengikuti nada data (netral/peringatan/buruk). */
  valueClassName?: string
  /** 0-1; bila diisi, bar tipis muncul di bawah angka. */
  progress?: number
  progressClassName?: string
  /** Baris kecil di bawah angka (mis. delta terhadap periode lalu). */
  footer?: ReactNode
  className?: string
}

/**
 * Kartu angka dashboard: angka naik ke nilainya, bar opsional, dan sedikit
 * terangkat saat disentuh kursor. Sumber datanya tetap milik pemanggil -
 * kartu ini hanya cara menampilkannya.
 */
export default function StatCard({
  label, value, format, valueClassName, progress, progressClassName, footer, className,
}: StatCardProps) {
  const motionOn = useMotionOn()
  return (
    <motion.div
      className={'group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50 p-5 '
        + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.35)] '
        + 'transition-shadow hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_20px_40px_-20px_rgba(16,24,40,0.45)] '
        + `dark:border-gray-700/80 dark:from-gray-800 dark:to-gray-900 ${className || ''}`}
      whileHover={motionOn ? { y: -4 } : undefined}
      transition={{ duration: 0.2, ease: EASE }}
    >
      {/* Cahaya lembut di pojok: memberi kesan permukaan, bukan kotak datar. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary-500/10 blur-2xl dark:bg-primary-400/10" />
      <p className="truncate text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1.5 truncate text-3xl font-semibold tracking-tight ${valueClassName || 'text-gray-900 dark:text-white'}`}>
        <CountUp value={value} format={format} />
      </p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-2" barClassName={progressClassName} />}
      {footer ? <div className="mt-1 text-xs">{footer}</div> : <p className="mt-1 text-xs text-gray-400">&nbsp;</p>}
    </motion.div>
  )
}
