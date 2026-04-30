import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import { keyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                      <CommandLineIcon className="h-6 w-6 text-white" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                      Keyboard Shortcuts
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Shortcuts List */}
                <div className="space-y-3">
                  {keyboardShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <Fragment key={keyIndex}>
                            <kbd className="px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-gray-400 text-xs">+</span>
                            )}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Press <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">?</kbd> to toggle this help
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
