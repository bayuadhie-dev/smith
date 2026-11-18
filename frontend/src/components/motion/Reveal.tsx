import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useMotionOn } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * A page section that animates in when it is scrolled into view.
 *
 * Used for everything below the fold: without it a long page feels static,
 * because the entrance animation is long finished by the time the reader
 * scrolls down. Runs `once`, so scrolling up and down does not make it blink.
 */
export default function Reveal({ children, delay = 0, className }: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const motionOn = useMotionOn()
  if (!motionOn) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, filter: 'blur(5px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
