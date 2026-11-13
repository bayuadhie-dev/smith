import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  BuildingStorefrontIcon,
  ArrowLeftIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

interface PendingTransfer {
  id: number
  inspection_number: string
  inspection_date: string | null
  product_id: number
  product_name: string | null
  product_code: string | null
  work_order_id: number | null
  work_order_number: string | null
  batch_number: string | null
  quantity_passed: number
  disposition: string
  disposition_date: string | null
  total_checklist_items: number
  passed_checklist_items: number
  failed_checklist_items: number
}

interface WarehouseLocation {
  id: number
  location_code: string
  zone_name: string
  zone_material_type: string
  available: number
  capacity: number
  occupied: number
}

interface InventorySummary {
  released: number
  quarantine: number
  reject: number
}

const DISP_LABEL: Record<string, string> = { released: 'Dilepas', quarantine: 'Karantina', reject: 'Ditolak' }
const COLUMNS: ListColumn<PendingTransfer>[] = [
  { key: 'inspection_number', label: 'No. Inspeksi', value: (i) => i.inspection_number },
  { key: 'product_name', label: 'Produk', value: (i) => i.product_name },
  { key: 'product_code', label: 'Kode Produk', value: (i) => i.product_code },
  { key: 'work_order_number', label: 'SPK', value: (i) => i.work_order_number },
  { key: 'batch_number', label: 'Batch', value: (i) => i.batch_number },
  { key: 'quantity_passed', label: 'Qty Lulus', value: (i) => i.quantity_passed, type: 'number' },
  { key: 'checklist', label: 'Checklist Lulus', value: (i) => i.passed_checklist_items, type: 'number' },
  { key: 'total_checklist_items', label: 'Total Checklist', value: (i) => i.total_checklist_items, type: 'number' },
  { key: 'failed_checklist_items', label: 'Checklist Gagal', value: (i) => i.failed_checklist_items, type: 'number' },
  { key: 'disposition', label: 'Disposisi', value: (i) => i.disposition, exportValue: (i) => DISP_LABEL[i.disposition] || i.disposition },
  { key: 'disposition_date', label: 'Tanggal', value: (i) => i.disposition_date, type: 'date' },
]

export default function QCToWarehouse() {
  const navigate = useNavigate()
  
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [inventorySummary, setInventorySummary] = useState<InventorySummary>({ released: 0, quarantine: 0, reject: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [filterDisposition, setFilterDisposition] = useState<string>('')
  const [isTransferring, setIsTransferring] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [pendingRes, locationsRes, summaryRes] = await Promise.all([
        fetch('/api/quality/inspections/pending-transfer', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/warehouse/locations?material_type=finished_goods', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/quality/warehouse/by-status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ])

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingTransfers(data.pending_transfers || [])
      }

      if (locationsRes.ok) {
        const data = await locationsRes.json()
        setLocations(data.locations || [])
      }

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setInventorySummary(data.summary || { released: 0, quarantine: 0, reject: 0 })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Gagal memuat data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectItem = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    const filteredItems = tools.rows
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItems.map(i => i.id))
    }
  }

  const handleTransfer = async (inspectionId: number) => {
    if (!selectedLocation) {
      toast.error('Pilih lokasi warehouse terlebih dahulu')
      return
    }

    setIsTransferring(true)
    try {
      const response = await fetch(`/api/quality/inspections/${inspectionId}/transfer-to-warehouse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ location_id: parseInt(selectedLocation) })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        fetchData()
        setSelectedItems(prev => prev.filter(i => i !== inspectionId))
      } else {
        const error = await response.json()
        toast.error(error.error || 'Gagal transfer')
      }
    } catch (error) {
      console.error('Error transferring:', error)
      toast.error('Terjadi kesalahan')
    } finally {
      setIsTransferring(false)
    }
  }

  const handleBulkTransfer = async () => {
    if (selectedItems.length === 0) {
      toast.error('Pilih item yang akan ditransfer')
      return
    }

    if (!selectedLocation) {
      toast.error('Pilih lokasi warehouse terlebih dahulu')
      return
    }

    setIsTransferring(true)
    let successCount = 0
    let failCount = 0

    for (const id of selectedItems) {
      try {
        const response = await fetch(`/api/quality/inspections/${id}/transfer-to-warehouse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ location_id: parseInt(selectedLocation) })
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} item berhasil ditransfer`)
    }
    if (failCount > 0) {
      toast.error(`${failCount} item gagal ditransfer`)
    }

    fetchData()
    setSelectedItems([])
    setIsTransferring(false)
  }

  const getFilteredItems = () => {
    if (!filterDisposition) return pendingTransfers
    return pendingTransfers.filter(i => i.disposition === filterDisposition)
  }

  const getDispositionBadge = (disposition: string) => {
    switch (disposition) {
      case 'released':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircleIcon className="h-3 w-3" />
            Released
          </span>
        )
      case 'quarantine':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <ExclamationTriangleIcon className="h-3 w-3" />
            Quarantine
          </span>
        )
      case 'reject':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <XCircleIcon className="h-3 w-3" />
            Reject
          </span>
        )
      default:
        return null
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const tools = useListTools<PendingTransfer>(getFilteredItems(), COLUMNS, { filename: 'QC_Menunggu_Transfer_Gudang', initialSort: { key: 'disposition_date', dir: 'desc' } })
  const filteredItems = tools.rows

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/quality')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transfer QC ke Warehouse</h1>
            <p className="text-gray-600 dark:text-gray-300">Transfer produk yang sudah lulus QC ke gudang barang jadi</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Pending Transfer</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{pendingTransfers.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Stok Released</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">{inventorySummary.released.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Stok Quarantine</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">{inventorySummary.quarantine.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
              <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-red-600 dark:text-red-400">Stok Reject</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-200">{inventorySummary.reject.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={filterDisposition}
                onChange={(e) => setFilterDisposition(e.target.value)}
                className="input w-40"
              >
                <option value="">Semua Status</option>
                <option value="released">Released</option>
                <option value="quarantine">Quarantine</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <BuildingStorefrontIcon className="h-5 w-5 text-gray-400" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input w-48"
              >
                <option value="">Pilih Lokasi Warehouse</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.location_code} ({loc.zone_name}) - Tersedia: {loc.available.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {selectedItems.length} item dipilih
              </span>
            )}
            <button
              onClick={handleBulkTransfer}
              disabled={selectedItems.length === 0 || !selectedLocation || isTransferring}
              className="btn-primary inline-flex items-center gap-2"
            >
              {isTransferring ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <ArrowRightIcon className="h-4 w-4" />
                  Transfer {selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pending Transfers Table */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="mb-3 text-lg font-semibold">Menunggu Transfer ke Gudang</h2>
          <ListToolbar tools={tools} placeholder="Cari inspeksi, produk, SPK, atau batch" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tools.total === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <CubeIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Tidak ada item pending</p>
            <p className="text-sm">Semua QC sudah ditransfer ke warehouse</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                  <SortTh tools={tools} col="inspection_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">No. Inspeksi</SortTh>
                  <SortTh tools={tools} col="product_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Produk</SortTh>
                  <SortTh tools={tools} col="work_order_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">SPK</SortTh>
                  <SortTh tools={tools} col="batch_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Batch</SortTh>
                  <SortTh tools={tools} col="quantity_passed" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Qty Lulus</SortTh>
                  <SortTh tools={tools} col="checklist" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Checklist</SortTh>
                  <SortTh tools={tools} col="disposition" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Disposisi</SortTh>
                  <SortTh tools={tools} col="disposition_date" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Tanggal</SortTh>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedItems.includes(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-blue-600 dark:text-blue-400">{item.inspection_number}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.product_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {item.work_order_number || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {item.batch_number || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.quantity_passed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-green-600 dark:text-green-400">{item.passed_checklist_items}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-600 dark:text-gray-300">{item.total_checklist_items}</span>
                        {item.failed_checklist_items > 0 && (
                          <span className="text-red-500 text-xs ml-1">({item.failed_checklist_items} gagal)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getDispositionBadge(item.disposition)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(item.disposition_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleTransfer(item.id)}
                        disabled={!selectedLocation || isTransferring}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed dark:text-blue-400"
                      >
                        Transfer <ArrowRightIcon className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4 bg-gray-50 dark:bg-gray-900">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">Keterangan Disposition:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">Released</p>
              <p className="text-gray-600 dark:text-gray-300">Semua checklist PASS. Produk siap dijual/kirim.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5 dark:text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">Quarantine</p>
              <p className="text-gray-600 dark:text-gray-300">Sebagian checklist FAIL. Perlu review sebelum release.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">Reject</p>
              <p className="text-gray-600 dark:text-gray-300">Semua checklist FAIL. Perlu rework, tidak bisa transfer.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
