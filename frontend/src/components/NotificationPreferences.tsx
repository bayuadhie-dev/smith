import { useEffect, useState } from 'react'
import axiosInstance from '../utils/axiosConfig'
import toast from 'react-hot-toast'

interface Pref { key: string; label: string; description: string; in_app_required: boolean; in_app: boolean; email: boolean }

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    axiosInstance.get('/api/notifications/preferences').then((r) => setPrefs(r.data.preferences || [])).catch(() => setPrefs([]))
  }, [])

  const toggle = async (key: string, field: 'in_app' | 'email', value: boolean) => {
    const prev = prefs
    setPrefs((ps) => ps.map((p) => (p.key === key ? { ...p, [field]: value } : p)))
    setSaving(key)
    try {
      await axiosInstance.put('/api/notifications/preferences', { preferences: [{ key, [field]: value }] })
    } catch {
      setPrefs(prev)
      toast.error('Gagal menyimpan preferensi')
    } finally { setSaving(null) }
  }

  if (prefs.length === 0) return null
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Preferensi Notifikasi</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Pilih kejadian yang ingin Anda terima di lonceng dan di email.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <th className="pb-2">Kejadian</th><th className="pb-2 text-center w-24">Lonceng</th><th className="pb-2 text-center w-24">Email</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {prefs.map((p) => (
            <tr key={p.key}>
              <td className="py-2.5 pr-3">
                <div className="font-medium text-gray-900 dark:text-white">{p.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{p.description}</div>
              </td>
              <td className="text-center">
                <input type="checkbox" checked={p.in_app} disabled={p.in_app_required || saving === p.key} onChange={(e) => toggle(p.key, 'in_app', e.target.checked)} title={p.in_app_required ? 'Wajib aktif' : undefined} />
              </td>
              <td className="text-center">
                {p.key === 'approval_request' || p.key === 'invoice_due' || p.key === 'approval_result' || p.key === 'grn_received'
                  ? <input type="checkbox" checked={p.email} disabled={saving === p.key} onChange={(e) => toggle(p.key, 'email', e.target.checked)} />
                  : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Permintaan persetujuan selalu muncul di lonceng. Saat ini email hanya dikirim untuk permintaan persetujuan; pilihan email untuk kejadian lain berlaku begitu fitur emailnya tersedia.</p>
    </div>
  )
}
