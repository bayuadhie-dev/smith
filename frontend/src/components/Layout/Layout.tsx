import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import Breadcrumb from '../ui/Breadcrumb'
import AIAssistant from '../AIAssistant/AIAssistant'
import SkipLink from '../ui/SkipLink'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import KeyboardShortcutsModal from '../Common/KeyboardShortcutsModal'

export default function Layout() {
  const location = useLocation()
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts()
  
  // Check if current page is desk or workspace
  const isDeskOrWorkspace = location.pathname === '/desk' || location.pathname.startsWith('/workspace/')
  
  // Initialize sidebar state from localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) {
      return saved === 'true'
    }
    // Default: collapsed on desk/workspace, open on other pages
    return !isDeskOrWorkspace
  })
  
  // Only auto-collapse on first visit to desk/workspace (if no saved state)
  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen')
    
    // Only apply auto-collapse if user hasn't set any preference yet
    if (saved === null && isDeskOrWorkspace) {
      setSidebarOpen(false)
      localStorage.setItem('sidebarOpen', 'false')
    }
  }, []) // Run only once on mount

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Skip Link for keyboard navigation */}
      <SkipLink href="#main-content" />
      
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        <Header toggleSidebar={toggleSidebar} />
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
