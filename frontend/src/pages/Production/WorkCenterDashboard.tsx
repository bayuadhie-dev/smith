import React, { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
  WrenchScrewdriverIcon,
  CogIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig'
import LoadingSpinner from '../../components/Common/LoadingSpinner'

interface DowntimeBreakdown {
  mesin: number
  operator: number
  material: number
  design: number
  others: number
  total: number
}

interface WorkCenterMachine {
  id: number
  code: string
  name: string
  department: string | null
  status: string
  capacity_per_hour: number | null
  capacity_uom: string | null
  today_shift_count: number
  oee_score: number | null
  downtime: DowntimeBreakdown
}

interface WorkCenterSummary {
  date: string
  machines: WorkCenterMachine[]
}

const statusConfig: Record<string, { label: string; badge: string; icon: any }> = {
  running: { label: 'Berjalan', badge: 'bg-green-100 text-green-800', icon: PlayIcon },
  active: { label: 'Aktif', badge: 'bg-green-100 text-green-800', icon: PlayIcon },
  idle: { label: 'Idle', badge: 'bg-yellow-100 text-yellow-800', icon: PauseIcon },
  maintenance: { label: 'Maintenance', badge: 'bg-blue-100 text-blue-800', icon: WrenchScrewdriverIcon },
  breakdown: { label: 'Breakdown', badge: 'bg-red-100 text-red-800', icon: ExclamationTriangleIcon },
}

const getOEEColor = (oee: number | null) => {
  if (oee === null) return 'text-gray-400'
  if (oee >= 70) return 'text-green-600'
  if (oee >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export default function WorkCenterDashboard() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<WorkCenterSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  useEffect(() => {
    loadSummary()
  }, [selectedDate])

  const loadSummary = async () => {
    try {
      setLoading(true)
      const response = await axiosInstance.get('/api/production/work-center-summary', {
        params: { date: selectedDate }
      })
      setSummary(response.data)
    } catch (error) {
      console.error('Error loading work center summary:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !summary) {
    return <LoadingSpinner />
  }

  const machines = summary?.machines || []
  const machinesWithData = machines.filter(m => m.oee_score !== null)
  const avgOEE = machinesWithData.length > 0
    ? machinesWithData.reduce((sum, m) => sum + (m.oee_score || 0), 0) / machinesWithData.length
    : 0
  const runningCount = machines.filter(m => m.status === 'running' || m.status === 'active').length
  const breakdownCount = machines.filter(m => m.status === 'breakdown').length
  const totalDowntime = machines.reduce((sum, m) => sum + m.downtime.total, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🏭 Work Center</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Ringkasan status mesin dan downtime harian
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('common.date')}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">OEE Rata-rata</h3>
          <p className={`mt-2 text-3xl font-semibold ${getOEEColor(machinesWithData.length ? avgOEE : null)}`}>
            {machinesWithData.length ? `${avgOEE.toFixed(1)}%` : '-'}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Mesin Berjalan</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {runningCount} / {machines.length}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Breakdown Aktif</h3>
          <p className={`mt-2 text-3xl font-semibold ${breakdownCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {breakdownCount}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Downtime</h3>
          <p className="mt-2 text-3xl font-semibold text-yellow-600">
            {totalDowntime} <span className="text-base font-normal">mnt</span>
          </p>
        </div>
      </div>

      {/* Machine list */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Daftar Mesin ({machines.length})
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12">{t('common.loading')}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {machines.map((m) => {
              const cfg = statusConfig[m.status] || statusConfig.idle
              const StatusIcon = cfg.icon
              const isExpanded = expandedId === m.id

              return (
                <div key={m.id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      <CogIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{m.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {m.code}{m.department ? ` · ${m.department}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-gray-500 dark:text-gray-400">OEE</div>
                        <div className={`text-sm font-semibold ${getOEEColor(m.oee_score)}`}>
                          {m.oee_score !== null ? `${m.oee_score.toFixed(1)}%` : '-'}
                        </div>
                      </div>

                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.badge} flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 pb-3">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Kapasitas</div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {m.capacity_per_hour ? `${m.capacity_per_hour} ${m.capacity_uom}` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Shift Tercatat</div>
                          <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                            <ClockIcon className="h-4 w-4 text-gray-400" />
                            {m.today_shift_count} shift
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total Downtime</div>
                          <div className={`text-sm font-medium ${m.downtime.total > 60 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                            {m.downtime.total} menit
                          </div>
                        </div>
                      </div>

                      {m.downtime.total > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Breakdown Downtime
                          </div>
                          {[
                            { label: 'Mesin', val: m.downtime.mesin },
                            { label: 'Operator', val: m.downtime.operator },
                            { label: 'Material', val: m.downtime.material },
                            { label: 'Design', val: m.downtime.design },
                            { label: 'Lainnya', val: m.downtime.others },
                          ].filter(d => d.val > 0).map((d, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className="w-16 text-gray-600 dark:text-gray-300">{d.label}</span>
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-red-500 rounded-full"
                                  style={{ width: `${Math.min(100, (d.val / m.downtime.total) * 100)}%` }}
                                />
                              </div>
                              <span className="w-14 text-right text-gray-900 dark:text-white">{d.val} mnt</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {machines.length === 0 && !loading && (
          <div className="text-center py-12">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Tidak ada mesin</h3>
          </div>
        )}
      </div>

      {breakdownCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
          {breakdownCount} mesin dalam status breakdown — cek shift production terbaru untuk detail penyebab.
        </div>
      )}
    </div>
  )
}
