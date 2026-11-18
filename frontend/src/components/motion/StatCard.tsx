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
      className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${className || ''}`}
      whileHover={motionOn ? { y: -4 } : undefined}
      transition={{ duration: 0.2, ease: EASE }}
    >
      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold ${valueClassName || 'text-gray-900 dark:text-white'}`}>
        <CountUp value={value} format={format} />
      </p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-2" barClassName={progressClassName} />}
      {footer ? <div className="mt-1 text-xs">{footer}</div> : <p className="mt-1 text-xs text-gray-400">&nbsp;</p>}
    </motion.div>
  )
}
