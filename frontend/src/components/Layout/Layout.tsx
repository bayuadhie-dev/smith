import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import Breadcrumb from '../ui/Breadcrumb'
import AIAssistant from '../AIAssistant/AIAssistant'
import SkipLink from '../ui/SkipLink'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import KeyboardShortcutsModal from '../Common/KeyboardShortcutsModal'

export default function Layout() {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts()
  
  // Initialize sidebar state from localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Di layar sempit, `open` ini juga dipakai buat nampilin drawer overlay mobile
    // (Sidebar.tsx) - kalau dibiarkan default "true" (kayak default desktop), drawer-nya
    // auto muncul nutupin seluruh layar tiap refresh/login (masukan user 2026-08-25:
    // "sidebar selalu muncul duluan kaya auto show"). Drawer itu sifatnya transient/harus
    // ditutup dulu, jadi di mobile SELALU mulai tertutup, apapun preferensi yang kesimpen.
    if (window.innerWidth < 1024) return false
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) {
      return saved === 'true'
    }
    return true
  })

  // Listen for ? key to show shortcuts modal
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isInput) {
          e.preventDefault()
          setShowShortcutsModal(prev => !prev)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const newState = !prev
      // Save to localStorage - this persists across all pages
      localStorage.setItem('sidebarOpen', String(newState))
      return newState
    })
  }

  // Icon-only rail mode toggled from inside Sidebar.tsx - dibaca lewat localStorage +
  // custom event (bukan di-lift jadi state di sini) supaya konten utama ikut nyempit
  // paddingnya tanpa perlu prop-drilling lewat komponen lain.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('erp_sidebar_collapsed') === 'true')
  useEffect(() => {
    const handler = () => setSidebarCollapsed(localStorage.getItem('erp_sidebar_collapsed') === 'true')
    window.addEventListener('erp-sidebar-collapsed-changed', handler)
    return () => window.removeEventListener('erp-sidebar-collapsed-changed', handler)
  }, [])

  // Tombol hamburger di Header dulu cuma bisa show/hide penuh (sidebarOpen) - itu bentrok
  // & bikin bingung sama tombol collapse baru di dalam Sidebar sendiri (masukan user
  // 2026-08-25: "tombol 3 baris itu penyebabnya"). Sekarang di layar desktop (>=1024px),
  // hamburger yang sama toggle collapse (bukan show/hide) - cuma di layar sempit (mobile
  // drawer) dia tetap show/hide seperti semula, karena collapse-rail memang desktop-only.
  const handleHeaderToggle = () => {
    if (window.innerWidth >= 1024) {
      // Collapse cuma berlaku kalau sidebar-nya kelihatan - kalau sebelumnya kesimpen
      // dalam kondisi sidebarOpen=false (default lama di halaman desk/workspace),
      // paksa tampil dulu (minimal jadi rail) supaya hamburger tidak macet nge-toggle
      // collapse di sidebar yang lagi tersembunyi total.
      if (!sidebarOpen) {
        setSidebarOpen(true)
        localStorage.setItem('sidebarOpen', 'true')
      }
      const next = !sidebarCollapsed
      localStorage.setItem('erp_sidebar_collapsed', String(next))
      window.dispatchEvent(new Event('erp-sidebar-collapsed-changed'))
    } else {
      toggleSidebar()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Skip Link for keyboard navigation */}
      <SkipLink href="#main-content" />

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className={`transition-all duration-300 ${sidebarOpen ? (sidebarCollapsed ? 'lg:pl-[84px]' : 'lg:pl-64') : 'lg:pl-0'}`}>
        <Header toggleSidebar={handleHeaderToggle} />
        <main id="main-content" className="py-6" role="main" aria-label="Konten utama">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
            <Breadcrumb />
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* AI Assistant Floating Widget */}
      <AIAssistant />
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal 
        isOpen={showShortcutsModal} 
        onClose={() => setShowShortcutsModal(false)} 
      />
    </div>
  )
}
