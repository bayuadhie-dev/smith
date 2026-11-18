import { motion } from 'framer-motion'
import { useMotionOn, useRevealed } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const jepit = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))

/** Bar mendatar yang memanjang dari kiri. `value` 0-1. */
export function ProgressBar({ value, className, barClassName }: {
  value: number
  className?: string
  barClassName?: string
}) {
  const motionOn = useMotionOn()
  const revealed = useRevealed()
  const v = jepit(value)
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 ${className || ''}`}>
      <motion.div
        className={`h-full origin-left rounded-full bg-primary-600 ${barClassName || ''}`}
        initial={motionOn ? { scaleX: 0 } : false}
        animate={{ scaleX: motionOn && !revealed ? 0 : v }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{ width: '100%' }}
      />
    </div>
  )
}

/** Bar tegak yang tumbuh dari bawah; `index` memberi jeda berurutan. */
export function GrowBar({ value, index = 0, className, barClassName, title }: {
  value: number
  index?: number
  className?: string
  barClassName?: string
  title?: string
}) {
  const motionOn = useMotionOn()
  const revealed = useRevealed()
  const v = jepit(value)
  return (
    <div className={`flex h-full w-full items-end ${className || ''}`} title={title}>
      <motion.div
        className={`w-full origin-bottom rounded-t bg-primary-600 ${barClassName || ''}`}
        style={{ height: '100%' }}
        initial={motionOn ? { scaleY: 0 } : false}
        animate={{ scaleY: motionOn && !revealed ? 0 : v }}
        transition={{ duration: 0.45, ease: EASE, delay: motionOn ? index * 0.06 : 0 }}
      />
    </div>
  )
}
