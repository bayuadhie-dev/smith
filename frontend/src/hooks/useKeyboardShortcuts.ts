import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface ShortcutConfig {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const shortcuts: ShortcutConfig[] = [
      {
        key: 'k',
        ctrlKey: true,
        action: () => {
          // Focus search input or navigate to search
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          } else {
            navigate('/app/search')
          }
        },
        description: 'Quick search'
      },
      {
        key: 'd',
        ctrlKey: true,
        shiftKey: true,
        action: () => navigate('/desk'),
        description: 'Go to Desk'
      },
      {
        key: 'h',
        ctrlKey: true,
        shiftKey: true,
        action: () => navigate('/app'),
        description: 'Go to Dashboard'
      },
      {
        key: '/',
        action: () => {
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
          if (searchInput) searchInput.focus()
        },
        description: 'Focus search'
      }
    ]

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except for specific cases)
      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // Allow Ctrl+K even in inputs
          if (shortcut.key === 'k' && shortcut.ctrlKey) {
            event.preventDefault()
            shortcut.action()
            return
          }

          // For other shortcuts, skip if in input
          if (!isInput) {
            event.preventDefault()
            shortcut.action()
            return
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return null
}

// Keyboard shortcuts help modal data
export const keyboardShortcuts = [
  { keys: ['Ctrl', 'K'], description: 'Quick search' },
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Go to Desk' },
  { keys: ['Ctrl', 'Shift', 'H'], description: 'Go to Dashboard' },
  { keys: ['/'], description: 'Focus search' },
  { keys: ['Esc'], description: 'Close modals' },
]
