import { useState } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { useAppSelector } from '../../hooks/redux'
import { getMotionPref, setMotionPref } from '../../utils/motion'

export default function InterfacePreferences() {
  const userId = useAppSelector((state: any) => state.auth?.user?.id)
  const [enabled, setEnabled] = useState(() => getMotionPref(userId) === 'on')

  const toggle = () => {
    const next = !enabled
    setMotionPref(next ? 'on' : 'off', userId)
    setEnabled(next)
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
      <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <SparklesIcon className="mr-2 h-5 w-5 text-primary-600 dark:text-primary-400" />
        Tampilan
      </h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900 dark:text-white" id="motion-label">Animasi antarmuka</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Efek ganti tema, buka tutup sidebar, dan dialog. Matikan bila perangkat terasa lambat atau Anda lebih nyaman tanpa gerakan.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="motion-label"
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
