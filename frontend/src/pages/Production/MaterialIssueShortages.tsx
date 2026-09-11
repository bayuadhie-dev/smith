import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface ShortageRow {
  material_issue_item_id: number
  material_issue_id: number
  issue_number: string
  trigger_source: string
  material_id: number
  material_code: string | null
  material_name: string | null
  required_quantity: number
  issued_quantity: number
  shortage_quantity: number
  uom: string
  reservation_status: string
  issue_status: string
  priority: string
  source_document: {
    type?: string
    id?: number
    number?: string
    product_name?: string
    customer_name?: string
  }
  created_at: string | null
}

const reservationStatusBadge = (status: string) => {
  switch (status) {
    case 'partial':
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Partial</span>
    case 'insufficient':
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Insufficient</span>
    default:
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{status}</span>
  }
}

const sourceTypeLabels: Record<string, string> = {
  work_order: 'SPK',
  sales_order: 'Sales Order',
  production_plan: 'Production Plan',
}

const MaterialIssueShortages: React.FC = () => {
  const [rows, setRows] = useState<ShortageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShortages()
  }, [])

  const fetchShortages = async () => {
    try {
      setLoading(true)
      const res = await axiosInstance.get('/api/production/material-issues/shortages', { params: { per_page: 100 } })
      setRows(res.data.shortages || [])
    } catch (error) {
      console.error('Error fetching shortages:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ExclamationTriangleIcon className="h-7 w-7 text-orange-600" />
            Laporan Kekurangan Material
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Material Issue yang gagal di-reserve penuh (partial/insufficient) dari BOM requirement
          </p>
        </div>
        <button onClick={fetchShortages} className="btn btn-secondary flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-3" />
            <p>Tidak ada kekurangan material saat ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Issue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dibutuhkan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kurang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reservasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sumber</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trigger</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr key={row.material_issue_item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/app/production/material-issues/${row.material_issue_id}`} className="font-medium text-blue-600 hover:underline">
                        {row.issue_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{row.material_name}</p>
                      <p className="text-xs text-gray-500">{row.material_code}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                      {row.required_quantity.toLocaleString()} {row.uom}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-red-600 font-medium">
                      {row.shortage_quantity.toLocaleString()} {row.uom}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {reservationStatusBadge(row.reservation_status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {row.source_document?.type ? (
                        <>
                          <span className="text-xs text-gray-400">{sourceTypeLabels[row.source_document.type] || row.source_document.type}</span>
                          <br />
                          {row.source_document.number}
                          {row.source_document.customer_name && (
                            <span className="block text-xs text-gray-400">{row.source_document.customer_name}</span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        {row.trigger_source === 'auto_reserve' ? 'Auto-Reserve' : 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default MaterialIssueShortages
