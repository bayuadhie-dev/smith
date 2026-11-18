import { useEffect, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { subscribeRequests, activeRequests } from '../../utils/netActivity'
import { useMotionOn } from '../motion/RevealContext'

/** Any RTK Query request still pending? */
function rtkBusy(state: any) {
  const api = state?.api
  if (!api) return false
  const pending = (bucket: any) =>
    bucket ? Object.values(bucket).some((x: any) => x?.status === 'pending') : false
  return pending(api.queries) || pending(api.mutations)
}

/**
 * Thin bar at the top of the screen while the app waits for the server.
 *
 * The UAT server is often slow and there used to be no sign at all that
 * something was happening, so people clicked buttons twice. Three sources are
 * combined so every HTTP path is covered: axios (most pages), RTK Query, and
 * react-query (dashboard).
 *
 * Only shows up once a request takes longer than 180 ms, so quick calls do not
 * make the bar flicker.
 */
export default function TopProgress() {
  const motionOn = useMotionOn()
  const [axiosBusy, setAxiosBusy] = useState(() => activeRequests() > 0)
  const reactQuery = useIsFetching()
  const rtk = useSelector(rtkBusy)
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeRequests((n) => setAxiosBusy(n > 0)), [])

  const busy = axiosBusy || rtk || reactQuery > 0

  useEffect(() => {
    if (!busy) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 180)
    return () => clearTimeout(t)
  }, [busy])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[95] h-0.5 overflow-hidden" aria-hidden>
      <div
        className="h-full w-1/3 rounded-r bg-primary-600 dark:bg-primary-400"
        style={motionOn ? { animation: 'erp-top-progress 1.1s cubic-bezier(0.65,0,0.35,1) infinite' } : { width: '100%', opacity: 0.6 }}
      />
    </div>
  )
}
