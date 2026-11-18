import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useMotionOn, useRevealed } from './RevealContext'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const container = {
  idle: {},
  shown: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
}

const item = {
  idle: { opacity: 0, y: 28, scale: 0.97, filter: 'blur(6px)' },
  shown: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
}

/** Wrapper: its children appear one after another once the screen is revealed. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const motionOn = useMotionOn()
  const revealed = useRevealed()
  if (!motionOn) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={container} initial="idle" animate={revealed ? 'shown' : 'idle'}>
      {children}
    </motion.div>
  )
}

/** A single card inside Stagger. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const motionOn = useMotionOn()
  if (!motionOn) return <div className={className}>{children}</div>
  return <motion.div className={className} variants={item}>{children}</motion.div>
}

export default Stagger
