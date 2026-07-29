import React, { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import {
  useGetEWSPredictionsQuery,
  useGetEWSPredictionDetailQuery,
  useGetEWSSummaryQuery,
  useRescoreEWSShiftMutation,
} from '../../services/api'
import { format, subDays } from 'date-fns'

export default function EWSDashboard() {
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [machineFilter, setMachineFilter] = useState<string>('')
  const [periodDays, setPeriodDays] = useState<number>(7)
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)

  const dateFrom = format(subDays(new Date(), periodDays), 'yyyy-MM-dd')

  const { data: summary, isLoading: summaryLoading } = useGetEWSSummaryQuery({ days: periodDays })
  const { data: predictions, isLoading: predictionsLoading } = useGetEWSPredictionsQuery({
    status: statusFilter || undefined,
    machine_id: machineFilter ? Number(machineFilter) : undefined,
    date_from: dateFrom,
    limit: 200,
  })
  const [rescoreShift, { isLoading: isRescoring }] = useRescoreEWSShiftMutation()

  const summaryData = summary?.data
  const items = predictions?.data || []

  const handleRescore = async (e: React.MouseEvent, shiftProductionId: number) => {
    e.stopPropagation()
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
        <select
          className="input"
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
        >
          <option value={7}>7 hari terakhir</option>
          <option value={30}>30 hari terakhir</option>
          <option value={90}>90 hari terakhir</option>
          <option value={365}>1 tahun terakhir</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Discore ({periodDays} hari)</h3>
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
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Breakdown per Mesin ({periodDays} hari)</h3>
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
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setSelectedShiftId(item.shift_production_id)}
                  >
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
                        onClick={(e) => handleRescore(e, item.shift_production_id)}
                      >
                        Re-score
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Belum ada data prediksi untuk periode ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedShiftId !== null && (
        <EWSDetailModal shiftProductionId={selectedShiftId} onClose={() => setSelectedShiftId(null)} />
      )}
    </div>
  )
}

function EWSDetailModal({ shiftProductionId, onClose }: { shiftProductionId: number; onClose: () => void }) {
  const { data, isLoading } = useGetEWSPredictionDetailQuery(shiftProductionId)
  const detail = data?.data

  const getStatusBadge = (status: string) => {
    if (status === 'BAHAYA') {
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
    return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detail Prediksi EWS</h2>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Memuat...</div>
        ) : !detail ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Data tidak ditemukan</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              <span className={getStatusBadge(detail.status_ews)}>{detail.status_ews}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal Produksi</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {detail.production_date ? format(new Date(detail.production_date), 'dd MMM yyyy') : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Shift</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{detail.shift || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mesin</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {detail.machine_name || `Mesin ${detail.machine_id}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Probabilitas Bahaya</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {(detail.prob_bahaya * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">OEE Score</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {detail.oee_score != null ? `${detail.oee_score.toFixed(1)}%` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Threshold Dipakai</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {(detail.prob_threshold_used * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Breakdown Downtime (menit)</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Mesin</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{detail.downtime_mesin ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Operator</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{detail.downtime_operator ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Design</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{detail.downtime_design ?? '-'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-xs text-gray-500 dark:text-gray-400">
              Discore pada {detail.scored_at ? format(new Date(detail.scored_at), 'dd MMM yyyy HH:mm') : '-'}
              {detail.model_version ? ` · model ${detail.model_version}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
