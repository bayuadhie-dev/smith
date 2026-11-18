import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'framer-motion'
import { useMotionOn, useRevealed } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface CountUpProps {
  value: number
  /** Flash briefly when the value changes after it is already on screen. */
  flashOnChange?: boolean
  /** Number formatter; defaults to Indonesian thousand separators. */
  format?: (n: number) => string
  className?: string
  duration?: number
}

/**
 * A number that counts up to its value.
 *
 * On a data refresh the count CONTINUES from the number currently shown instead
 * of dropping back to zero first. Without that, every automatic dashboard
 * refresh (every 2 minutes) makes all figures blink from zero, which reads like
 * the data was lost.
 */
export default function CountUp({ value, format, className, duration = 1.1, flashOnChange = true }: CountUpProps) {
  const motionOn = useMotionOn()
  const revealed = useRevealed()
  const fmt = format || ((n: number) => Math.round(n).toLocaleString('id-ID'))
  const mv = useMotionValue(0)
  const lastShown = useRef(0)
  const prevValue = useRef<number | null>(null)
  const [flash, setFlash] = useState(false)
  const [text, setText] = useState(() => fmt(motionOn ? 0 : value))

  // Flash only for changes AFTER the first number was painted, so an automatic
  // refresh returning the same value does not make the screen blink.
  useEffect(() => {
    const previous = prevValue.current
    prevValue.current = value
    if (!flashOnChange || !motionOn || previous === null || previous === value) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(t)
  }, [value, flashOnChange, motionOn])

  useEffect(() => {
    if (!motionOn || !revealed) {
      lastShown.current = value
      mv.set(value)
      setText(fmt(value))
      return
    }
    mv.set(lastShown.current)
    const controls = animate(mv, value, {
      duration,
      ease: EASE,
      onUpdate: (n) => { lastShown.current = n; setText(fmt(n)) },
      onComplete: () => { lastShown.current = value; setText(fmt(value)) },
    })
    return () => controls.stop()
    // fmt is deliberately excluded: callers usually pass a fresh function per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, motionOn, revealed, duration])

  return <span className={`tabular-nums ${flash ? 'erp-flash' : ''} ${className || ''}`}>{text}</span>
}
