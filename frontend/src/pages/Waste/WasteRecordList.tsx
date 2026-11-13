import React from 'react'
import { Link } from 'react-router-dom';
import { format } from 'date-fns'
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline';
import { useGetWasteRecordsQuery } from '../../services/api'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

const STATUS_LABEL: Record<string, string> = { recorded: 'Tercatat', collected: 'Dikumpulkan', disposed: 'Dimusnahkan' }
const HAZARD_LABEL: Record<string, string> = { none: 'Tidak ada', low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }
const STATUS_BADGE: Record<string, string> = { recorded: 'badge-warning', collected: 'badge-info', disposed: 'badge-success' }
const HAZARD_BADGE: Record<string, string> = { none: 'badge-success', low: 'badge-info', medium: 'badge-warning', high: 'badge-danger' }

const COLUMNS: ListColumn<any>[] = [
  { key: 'record_number', label: 'No. Catatan', value: (r) => r.record_number },
  { key: 'category_name', label: 'Kategori', value: (r) => r.category_name },
  { key: 'product_name', label: 'Produk', value: (r) => r.product_name, sortable: false },
  { key: 'waste_date', label: 'Tanggal', value: (r) => r.waste_date, type: 'date' },
  { key: 'source_department', label: 'Sumber', value: (r) => r.source_department },
  { key: 'machine_name', label: 'Mesin', value: (r) => r.machine_name, sortable: false },
  { key: 'quantity', label: 'Jumlah', value: (r) => r.quantity, type: 'number' },
  { key: 'uom', label: 'Satuan', value: (r) => r.uom, sortable: false },
  { key: 'weight_kg', label: 'Berat (kg)', value: (r) => r.weight_kg, type: 'number' },
  { key: 'hazard_level', label: 'Tingkat Bahaya', value: (r) => r.hazard_level, exportValue: (r) => HAZARD_LABEL[r.hazard_level] || r.hazard_level },
  { key: 'estimated_value', label: 'Perkiraan Nilai (Rp)', value: (r) => r.estimated_value, type: 'number' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS_LABEL[r.status] || r.status },
]

export default function WasteRecordList() {
  const { data, isLoading } = useGetWasteRecordsQuery({})
  const records = data?.records || []
  const tools = useListTools<any>(records, COLUMNS, { filename: 'Catatan_Limbah', initialSort: { key: 'waste_date', dir: 'desc' } })

  const totalQuantity = records.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)
  const highHazardCount = records.filter((r: any) => r.hazard_level === 'high').length
  const productionRejectCount = records.filter((r: any) => r.source === 'production').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Limbah</h1>
          <p className="text-gray-600 dark:text-gray-300">Catat dan kelola pembuangan limbah produksi</p>
        </div>
        <Link to="/app/waste/new" className="btn-primary">
          <PlusIcon className="mr-1.5 h-5 w-5" />
          Catat Limbah
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{records.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Catatan</div>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">{totalQuantity.toLocaleString('id-ID')}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Jumlah</div>
            </div>
            <TrashIcon className="h-8 w-8 text-primary-400" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{productionRejectCount}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Reject Produksi</div>
            </div>
            <BuildingOffice2Icon className="h-8 w-8 text-orange-400" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{highHazardCount}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Bahaya Tinggi</div>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Kategori Limbah</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
            <h4 className="font-medium text-green-900 dark:text-green-200">Limbah Produksi</h4>
            <p className="text-sm text-green-700 dark:text-green-400">Bahan yang bisa didaur ulang</p>
            <div className="mt-2"><span className="badge badge-success">Risiko Rendah</span></div>
          </div>
          <div className="p-4 bg-primary-50 rounded-lg dark:bg-primary-900/20">
            <h4 className="font-medium text-primary-900 dark:text-primary-200">Limbah Kemasan</h4>
            <p className="text-sm text-primary-700 dark:text-primary-400">Kardus, plastik</p>
            <div className="mt-2"><span className="badge badge-info">Tanpa Risiko</span></div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg dark:bg-red-900/20">
            <h4 className="font-medium text-red-900 dark:text-red-200">Limbah Kimia</h4>
            <p className="text-sm text-red-700 dark:text-red-400">Perlu pembuangan khusus</p>
            <div className="mt-2"><span className="badge badge-danger">Risiko Tinggi</span></div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white">Limbah Umum</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">Pembuangan biasa</p>
            <div className="mt-2"><span className="badge badge-gray">Tanpa Risiko</span></div>
          </div>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor, kategori, sumber, produk, mesin" />

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Memuat...</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh tools={tools} col="record_number">No. Catatan</SortTh>
                  <SortTh tools={tools} col="category_name">Kategori</SortTh>
                  <SortTh tools={tools} col="waste_date">Tanggal</SortTh>
                  <SortTh tools={tools} col="source_department">Sumber</SortTh>
                  <SortTh tools={tools} col="quantity">Jumlah</SortTh>
                  <SortTh tools={tools} col="weight_kg">Berat (kg)</SortTh>
                  <SortTh tools={tools} col="hazard_level">Tingkat Bahaya</SortTh>
                  <SortTh tools={tools} col="estimated_value">Perkiraan Nilai</SortTh>
                  <SortTh tools={tools} col="status">Status</SortTh>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((record: any) => (
                  <tr key={record.id} className={record.source === 'production' ? 'bg-orange-50 dark:bg-orange-900/20' : ''}>
                    <td className="font-medium">
                      {record.record_number}
                      {record.source === 'production' && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-300">
                          Produksi
                        </span>
                      )}
                    </td>
                    <td>
                      {record.category_name}
                      {record.product_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{record.product_name}</div>
                      )}
                    </td>
                    <td>{format(new Date(record.waste_date), 'dd MMM yyyy')}</td>
                    <td>
                      {record.source_department || '-'}
                      {record.machine_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{record.machine_name}</div>
                      )}
                    </td>
                    <td>
                      {record.quantity?.toLocaleString('id-ID')} {record.uom}
                      {record.reject_quantity !== undefined && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          Reject: {record.reject_quantity} | Rework: {record.rework_quantity}
                        </div>
                      )}
                    </td>
                    <td>{record.weight_kg ? record.weight_kg.toLocaleString('id-ID') : '-'}</td>
                    <td>
                      <span className={`badge ${HAZARD_BADGE[record.hazard_level] || 'badge-info'}`}>
                        {HAZARD_LABEL[record.hazard_level] || record.hazard_level}
                      </span>
                    </td>
                    <td>Rp {(record.estimated_value || 0).toLocaleString('id-ID')}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[record.status] || 'badge-info'}`}>
                        {STATUS_LABEL[record.status] || record.status}
                      </span>
                    </td>
                    <td>
                      {record.source !== 'production' && (
                        <Link
                          to={`/app/waste/${record.id}`}
                          className="text-primary-600 hover:text-primary-800 text-sm dark:text-primary-400"
                        >
                          Lihat
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && tools.rows.length === 0 && (
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada catatan limbah' : 'Tidak ada catatan yang cocok'}</h3>
          {tools.total === 0 && (
            <div className="mt-6">
              <Link to="/app/waste/new" className="btn-primary">
                <PlusIcon className="mr-1.5 h-5 w-5" />
                Catat Limbah
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
