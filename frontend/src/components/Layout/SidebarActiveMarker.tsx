import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { motionEnabled } from '../../utils/motion'

/**
 * Batang tipis di tepi kiri sidebar yang meluncur ke menu yang sedang aktif.
 *
 * Dibuat sebagai satu elemen yang diukur dari DOM (`[aria-current="page"]`),
 * bukan satu penanda per baris menu: sidebar punya tiga tingkat (modul, anak,
 * cucu) yang digambar di tempat berbeda, jadi menyisipkan penanda di tiap
 * tingkat akan mengacak-acak berkas 900 baris itu. Latar menu aktif yang sudah
 * ada tidak diganggu - ini tambahan, bukan pengganti.
 */
export default function SidebarActiveMarker({ wadah }: { wadah: RefObject<HTMLElement> }) {
  const lokasi = useLocation()
  const [kotak, setKotak] = useState<{ top: number; height: number } | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const el = wadah.current
    if (!el) return

    const ukur = () => {
      const aktif = el.querySelector('[aria-current="page"]') as HTMLElement | null
      if (!aktif) { setKotak(null); return }
      const a = aktif.getBoundingClientRect()
      const w = el.getBoundingClientRect()
      setKotak({ top: a.top - w.top + el.scrollTop, height: a.height })
    }

    // Diukur pada frame berikutnya: saat rute baru saja berganti, tata letak
    // menu (termasuk grup yang membuka diri sendiri) belum selesai dihitung.
    rafRef.current = requestAnimationFrame(() => requestAnimationFrame(ukur))

    const pengamat = new MutationObserver(ukur)
    pengamat.observe(el, { subtree: true, attributes: true, childList: true, attributeFilter: ['aria-current'] })
    el.addEventListener('scroll', ukur)
    window.addEventListener('resize', ukur)
    return () => {
      cancelAnimationFrame(rafRef.current)
      pengamat.disconnect()
      el.removeEventListener('scroll', ukur)
      window.removeEventListener('resize', ukur)
    }
  }, [wadah, lokasi.pathname, lokasi.search])

  if (!kotak) return null

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 w-0.5 rounded-full bg-primary-600 dark:bg-primary-400"
      style={{
        top: kotak.top,
        height: kotak.height,
        transition: motionEnabled() ? 'top 260ms cubic-bezier(0.16,1,0.3,1), height 260ms cubic-bezier(0.16,1,0.3,1)' : undefined,
      }}
    />
  )
}
