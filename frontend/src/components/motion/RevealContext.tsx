import { createContext, useContext } from 'react'
import { useReducedMotion } from 'framer-motion'
import { motionEnabled } from '../../utils/motion'

/**
 * Flag set by SplashReveal once the screen has been uncovered.
 *
 * Stagger, CountUp and the bars wait for it so they do not run behind the
 * splash screen - otherwise their animation is over before anyone sees it.
 * Outside SplashReveal the value is true, so these components still work on
 * pages that have no splash.
 */
export const RevealContext = createContext(true)

export const useRevealed = () => useContext(RevealContext)

/**
 * Whether animation is allowed to run.
 *
 * Two sources are honoured: the device's "reduce motion" setting
 * (useReducedMotion) and this app's own per-user animation toggle on the
 * Profile page (html[data-motion='off'], see utils/motion.ts). Off in either
 * one means everything renders instantly, with no movement.
 */
export function useMotionOn() {
  const reduced = useReducedMotion()
  return !reduced && motionEnabled()
}
