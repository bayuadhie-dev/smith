import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'

/**
 * Tombol tambah melayang di pojok kanan bawah halaman daftar.
 *
 * Tidak didaftarkan per halaman: tombol ini MENCARI tombol "tambah" milik
 * halaman yang sedang terbuka (tautan apa pun yang berujung /new) lalu
 * mencerminkannya. Akibatnya halaman tanpa tombol tambah tidak pernah dapat
 * tombol melayang, targetnya dijamin sama persis dengan yang sudah ada, dan
 * halaman baru ikut dapat tanpa diubah.
 *
 * Saat tombol aslinya sedang kelihatan di layar, yang melayang disembunyikan -
 * gunanya memang hanya supaya tidak perlu menggulir ke atas.
 */
export default function ListFab() {
  const location = useLocation()
  const navigate = useNavigate()
  const [target, setTarget] = useState<{ href: string; label: string } | null>(null)

  useEffect(() => {
    let batal = false
    let observer: MutationObserver | null = null
    let io: IntersectionObserver | null = null

    const cari = () => {
      if (batal) return
      const pane = (document.querySelector('[data-tab-pane]:not([hidden])') || document.querySelector('main')) as HTMLElement | null
      if (!pane) { setTarget(null); return }
      const link = Array.from(pane.querySelectorAll<HTMLAnchorElement>('a[href]')).find((a) => {
        const href = a.getAttribute('href') || ''
        return /\/new\/?$/.test(href) && !a.closest('[hidden]') && a.offsetParent !== null
      })
      if (!link) { setTarget(null); return }
      const href = link.getAttribute('href') || ''
      const label = (link.textContent || '').trim().slice(0, 40) || 'Tambah'

      io?.disconnect()
      io = new IntersectionObserver(([entry]) => {
        if (batal) return
        setTarget(entry.isIntersecting ? null : { href, label })
      }, { threshold: 0.4 })
      io.observe(link)
    }

    const timer = setTimeout(cari, 400)
    const pane = document.querySelector('[data-tab-pane]:not([hidden])') || document.body
    observer = new MutationObserver(() => { clearTimeout(timer); setTimeout(cari, 300) })
    observer.observe(pane, { childList: true, subtree: true })

    return () => {
      batal = true
      clearTimeout(timer)
      observer?.disconnect()
      io?.disconnect()
    }
  }, [location.pathname, location.search])

  if (!target) return null

  return (
    <button
      type="button"
      onClick={() => navigate(target.href.replace(/^#/, ''))}
      title={target.label}
      aria-label={target.label}
      className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700 active:scale-95 lg:bottom-8 lg:right-8"
    >
      <PlusIcon className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}
