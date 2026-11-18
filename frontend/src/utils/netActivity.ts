/**
 * Counter of in-flight axios requests.
 *
 * Feeds the thin progress bar at the top of the screen
 * (components/ui/TopProgress.tsx). Kept out of axiosConfig so that file stays
 * about HTTP only, and so the view layer never has to know about axios.
 */
type Listener = (count: number) => void

let inFlight = 0
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((fn) => fn(inFlight))
}

export function startRequest() {
  inFlight += 1
  notify()
}

export function finishRequest() {
  inFlight = Math.max(0, inFlight - 1)
  notify()
}

export function activeRequests() {
  return inFlight
}

export function subscribeRequests(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
