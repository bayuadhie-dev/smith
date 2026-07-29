import React, { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useGetEWSPredictionsQuery, useGetEWSSummaryQuery, useRescoreEWSShiftMutation } from '../../services/api'
import { format } from 'date-fns'

export default function EWSDashboard() {
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [machineFilter, setMachineFilter] = useState<string>('')

  const { data: summary, isLoading: summaryLoading } = useGetEWSSummaryQuery({ days: 7 })
  const { data: predictions, isLoading: predictionsLoading } = useGetEWSPredictionsQuery({
    status: statusFilter || undefined,
    machine_id: machineFilter ? Number(machineFilter) : undefined,
    limit: 100,
  })
  const [rescoreShift, { isLoading: isRescoring }] = useRescoreEWSShiftMutation()

  const summaryData = summary?.data
  const items = predictions?.data || []

  const handleRescore = async (shiftProductionId: number) => {
    try {
      await rescoreShift(shiftProductionId).unwrap()
    } catch (err) {
      console.error('Gagal rescore shift:', err)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'BAHAYA') {
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
    return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }

  const getProbColor = (prob: number) => {
    if (prob >= 0.7) return 'text-red-600 font-semibold'
    if (prob >= 0.4) return 'text-orange-500 font-semibold'
    return 'text-green-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Early Warning System — Risiko Downtime
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Discore (7 hari)</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {summaryLoading ? '...' : summaryData?.total_scored ?? 0}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status BAHAYA</h3>
          <p className="mt-2 text-3xl font-semibold text-red-600">
            {summaryLoading ? '...' : summaryData?.bahaya ?? 0}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status AMAN</h3>
          <p className="mt-2 text-3xl font-semibold text-green-600">
            {summaryLoading ? '...' : summaryData?.aman ?? 0}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Rasio Bahaya</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {summaryLoading ? '...' : `${summaryData?.bahaya_rate ?? 0}%`}
          </p>
        </div>
      </div>

      {/* Per-machine breakdown */}
      {summaryData?.per_machine && summaryData.per_machine.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Breakdown per Mesin (7 hari)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {summaryData.per_machine.map((m: any) => (
              <div key={m.machine_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Mesin {m.machine_id}</p>
                <p className="text-sm">
                  <span className="text-red-600 font-semibold">{m.bahaya}</span>
                  {' / '}
                  <span className="text-green-600">{m.aman}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="BAHAYA">BAHAYA</option>
          <option value="AMAN">AMAN</option>
        </select>
        <input
          type="number"
          className="input"
          placeholder="Filter Machine ID"
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
        />
      </div>

      {/* Predictions table */}
      {predictionsLoading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('production.shift')}</th>
                  <th>{t('production.machine')}</th>
                  <th>Probabilitas Bahaya</th>
                  <th>Status</th>
                  <th>Discore Pada</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.production_date ? format(new Date(item.production_date), 'dd MMM yyyy') : '-'}</td>
                    <td>{item.shift || '-'}</td>
                    <td>{item.machine_name || `Mesin ${item.machine_id}`}</td>
                    <td className={getProbColor(item.prob_bahaya)}>
                      {(item.prob_bahaya * 100).toFixed(1)}%
                    </td>
                    <td>
                      <span className={getStatusBadge(item.status_ews)}>{item.status_ews}</span>
                    </td>
                    <td className="text-xs text-gray-500 dark:text-gray-400">
                      {item.scored_at ? format(new Date(item.scored_at), 'dd MMM yyyy HH:mm') : '-'}
                    </td>
                    <td>
                      <button
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        disabled={isRescoring}
                        onClick={() => handleRescore(item.shift_production_id)}
                      >
                        Re-score
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Belum ada data prediksi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
