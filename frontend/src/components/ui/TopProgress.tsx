import { useEffect, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { langganPermintaan, jumlahPermintaan } from '../../utils/netActivity'
import { useMotionOn } from '../motion/RevealContext'

/** Ada permintaan RTK Query yang belum selesai? */
function rtkSibuk(state: any) {
  const api = state?.api
  if (!api) return false
  const sibuk = (kumpulan: any) =>
    kumpulan ? Object.values(kumpulan).some((x: any) => x?.status === 'pending') : false
  return sibuk(api.queries) || sibuk(api.mutations)
}

/**
 * Garis tipis di puncak layar selama sistem menunggu jawaban server.
 *
 * Server UAT sering lambat dan sebelumnya tidak ada tanda apa pun bahwa sesuatu
 * sedang berjalan - pemakai menekan tombol dua kali karena ragu. Tiga sumber
 * digabung supaya semua jalur HTTP tertangkap: axios (sebagian besar halaman),
 * RTK Query, dan react-query (dashboard).
 *
 * Muncul hanya kalau permintaannya lebih lama dari 180 ms, supaya permintaan
 * cepat tidak membuat garisnya berkedip-kedip.
 */
export default function TopProgress() {
  const motionOn = useMotionOn()
  const [axiosSibuk, setAxiosSibuk] = useState(() => jumlahPermintaan() > 0)
  const reactQuery = useIsFetching()
  const rtk = useSelector(rtkSibuk)
  const [tampil, setTampil] = useState(false)

  useEffect(() => langganPermintaan((n) => setAxiosSibuk(n > 0)), [])

  const sibuk = axiosSibuk || rtk || reactQuery > 0

  useEffect(() => {
    if (!sibuk) { setTampil(false); return }
    const t = setTimeout(() => setTampil(true), 180)
    return () => clearTimeout(t)
  }, [sibuk])

  if (!tampil) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[95] h-0.5 overflow-hidden" aria-hidden>
      <div
        className="h-full w-1/3 rounded-r bg-primary-600 dark:bg-primary-400"
        style={motionOn ? { animation: 'erp-top-progress 1.1s cubic-bezier(0.65,0,0.35,1) infinite' } : { width: '100%', opacity: 0.6 }}
      />
    </div>
  )
}
