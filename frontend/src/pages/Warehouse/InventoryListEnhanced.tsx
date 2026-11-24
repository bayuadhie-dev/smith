import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  CubeIcon,
  BeakerIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import { showError } from '../../components/ui'
import { useUrlFilter, useUrlPage } from '../../hooks/useUrlState'
import ItemStockModal from '../../components/Warehouse/ItemStockModal'
import { KpiStrip, PageHeader } from '../../components/ui/PageKit'
import { PILIHAN_KELOMPOK, namaKategoriBarang, namaKelompokBarang, warnaKelompokBarang } from './kategoriBarang'

interface InventoryItem {
  id: number
  item_type: 'product' | 'material'
  product_id: number | null
  material_id: number | null
  item_code: string
  item_name: string
  material_type: string | null
  category: string | null
  location_id: number
  location_code: string
  zone_name: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  min_stock_level: number
  max_stock_level: number
  batch_number: string
  lot_number: string
  production_date: string | null
  expiry_date: string | null
  stock_status: string
  uom: string
  updated_at: string | null
}

interface Zone {
  id: number
  code: string
  name: string
  material_type: string
}

interface InventoryListEnhancedProps {
  mode?: 'per-gudang' | 'bahan-baku'
}

export default function InventoryListEnhanced({ mode = 'per-gudang' }: InventoryListEnhancedProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [detail, setDetail] = useState<{ kind: 'material' | 'product'; id: number; name: string } | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useUrlPage()
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [search, setSearch] = useUrlFilter<string>('cari', '')
  const [itemType, setItemType] = useState<string>(mode === 'bahan-baku' ? 'material' : '')
  const [zoneId, setZoneId] = useState<string>('')
  const [stockStatus, setStockStatus] = useUrlFilter<string>('status', '')
  const [categoryGroup, setCategoryGroup] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Summary
  const [summary, setSummary] = useState({
    total_products: 0,
    total_materials: 0,
    total_quantity: 0,
    low_stock_count: 0
  })

  useEffect(() => {
    fetchZones()
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [currentPage, search, itemType, zoneId, stockStatus, categoryGroup])

  const fetchZones = async () => {
    try {
      const response = await axiosInstance.get('/api/warehouse/zones')
      setZones(response.data.zones || [])
    } catch (error) {
      console.error('Error fetching zones:', error)
    }
  }

  const fetchInventory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20'
      })
      
      if (search) params.append('search', search)
      if (itemType) params.append('item_type', itemType)
      if (zoneId) params.append('zone_id', zoneId)
      if (stockStatus) params.append('stock_status', stockStatus)
      if (categoryGroup) params.append('category_group', categoryGroup)

      const response = await axiosInstance.get(`/api/warehouse/inventory?${params}`)
      setInventory(response.data.inventory || [])
      setTotalItems(response.data.total || 0)
      setTotalPages(response.data.pages || 1)

      // Calculate summary
      const items = response.data.inventory || []
      const products = items.filter((i: InventoryItem) => i.item_type === 'product')
      const materials = items.filter((i: InventoryItem) => i.item_type === 'material')
      const totalQty = items.reduce((sum: number, i: InventoryItem) => sum + i.quantity_on_hand, 0)
      const lowStock = items.filter((i: InventoryItem) => i.quantity_on_hand <= i.min_stock_level && i.min_stock_level > 0)

      setSummary({
        total_products: products.length,
        total_materials: materials.length,
        total_quantity: totalQty,
        low_stock_count: lowStock.length
      })
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Satu barang bisa punya belasan baris stok karena batch-nya banyak - daftar
   * ini menggabungkannya jadi satu baris per barang per gudang. Rincian tiap
   * batch dibuka lewat popup, bukan dengan membanjiri daftar.
   */
  const groupedInventory = React.useMemo(() => {
    const map = new Map<string, InventoryItem & { batch_count: number; batch_list: string[]; expiry_nearest: string | null }>()
    inventory.forEach((it) => {
      const key = `${it.item_type}-${it.material_id ?? it.product_id}-${it.location_id}`
      const cur = map.get(key)
      if (!cur) {
        map.set(key, {
          ...it,
          batch_count: it.batch_number ? 1 : 0,
          batch_list: it.batch_number ? [it.batch_number] : [],
          expiry_nearest: it.expiry_date || null,
        })
        return
      }
      cur.quantity_on_hand += it.quantity_on_hand
      cur.quantity_available += it.quantity_available
      cur.quantity_reserved += it.quantity_reserved
      if (it.batch_number && !cur.batch_list.includes(it.batch_number)) {
        cur.batch_list.push(it.batch_number)
        cur.batch_count += 1
      }
      if (it.expiry_date && (!cur.expiry_nearest || it.expiry_date < cur.expiry_nearest)) cur.expiry_nearest = it.expiry_date
    })
    return Array.from(map.values())
  }, [inventory])

  const getStockStatusBadge = (item: InventoryItem) => {
    const qty = item.quantity_on_hand
    const minStock = item.min_stock_level
    
    if (qty <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <XCircleIcon className="h-3 w-3" />
          Habis
        </span>
      )
    }
    
    if (minStock > 0 && qty <= minStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          <ExclamationTriangleIcon className="h-3 w-3" />
          Stok Rendah
        </span>
      )
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircleIcon className="h-3 w-3" />
        Tersedia
      </span>
    )
  }

  // fix_report_3.md Fase 16 (2026-10-02): getStockStatusBadge() above only
  // ever showed a QUANTITY-based badge (Habis/Stok Rendah/Tersedia) - a
  // reject/quarantine batch with quantity_on_hand > 0 showed as green
  // "Tersedia" with nothing indicating it's actually reject/quarantine
  // stock. This shows the REAL Inventory.stock_status as a second badge.
  const getPhysicalStatusBadge = (stockStatusValue: string) => {
    const normalized = (stockStatusValue || '').toLowerCase()
    if (normalized === 'quarantine') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          Quarantine
        </span>
      )
    }
    if (normalized === 'reject' || normalized === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          Reject
        </span>
      )
    }
    return null
  }

  const getItemTypeBadge = (type: string) => {
    if (type === 'product') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <CubeIcon className="h-3 w-3" />
          Produk
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
        <BeakerIcon className="h-3 w-3" />
        Material
      </span>
    )
  }

  const handleExport = async () => {
    try {
      const response = await axiosInstance.get('/api/warehouse/inventory/export', {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error exporting:', error)
      showError('Gagal export data')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={mode === 'bahan-baku' ? 'GUDANG · BAHAN BAKU' : 'GUDANG · BARANG PER GUDANG'}
        title={mode === 'bahan-baku' ? 'Penambahan Bahan Baku' : 'Barang per Gudang'}
        subtitle={mode === 'bahan-baku' ? 'Kelola stok bahan baku' : 'Kelola stok produk dan bahan baku per lokasi gudang'}
        actions={
          <>
            <button onClick={handleExport} className="btn-secondary">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Ekspor
            </button>
            <Link to="/app/warehouse/stock-input" className="btn-secondary">
              <BeakerIcon className="h-4 w-4" />
              Input material
            </Link>
            <Link to="/app/warehouse/inventory/add-product" className="btn-primary">
              <PlusIcon className="h-4 w-4" />
              Tambah produk
            </Link>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'Produk', value: summary.total_products, hint: 'punya baris stok' },
          { label: 'Material', value: summary.total_materials, hint: 'punya baris stok' },
          { label: 'Jumlah stok', value: Math.round(summary.total_quantity).toLocaleString('id-ID'), hint: 'seluruh satuan digabung' },
          {
            label: 'Stok rendah',
            value: summary.low_stock_count,
            tone: summary.low_stock_count > 0 ? 'warn' : null,
            hint: 'di bawah stok minimum',
          },
        ]}
      />

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kode, nama produk/material, atau batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary inline-flex items-center gap-2 ${showFilters ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
          >
            <FunnelIcon className="h-5 w-5" />
            Filter
          </button>
          <button onClick={fetchInventory} className="btn-secondary inline-flex items-center gap-2">
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tipe Item</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="input w-full"
              >
                <option value="">Semua</option>
                <option value="product">Produk</option>
                <option value="material">Material</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Kategori</label>
              <select
                value={categoryGroup}
                onChange={(e) => setCategoryGroup(e.target.value)}
                className="input w-full"
              >
                <option value="">Semua Kategori</option>
                {PILIHAN_KELOMPOK.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Zona Gudang</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="input w-full"
              >
                <option value="">Semua Zona</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} ({zone.material_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status Stok</label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className="input w-full"
              >
                <option value="">Semua Status</option>
                <option value="available">Tersedia (Stok &gt; 0)</option>
                <option value="low_stock">Stok Rendah</option>
                <option value="out_of_stock">Habis (Stok = 0)</option>
                <option disabled>──────────</option>
                {/* fix_report_3.md Fase 16 (2026-10-02): status fisik asli
                    (Inventory.stock_status) - sebelumnya param ini diam-diam
                    cuma menangani 3 opsi di atas (berbasis kuantitas), jadi
                    tidak ada cara sama sekali untuk lihat stok quarantine/
                    reject dari halaman ini. */}
                <option value="released">🟢 Released</option>
                <option value="quarantine">🟡 Quarantine</option>
                <option value="reject">🔴 Reject</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Memuat data...</p>
          </div>
        ) : inventory.length === 0 ? (
          <div className="p-8 text-center">
            <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Tidak ada data inventori</p>
            <Link to="/app/warehouse/stock-input" className="btn-primary mt-4 inline-flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Input Stok Pertama
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kategori</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokasi</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stok</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tersedia</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reserved</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expired</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {groupedInventory.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => (item.material_id || item.product_id) && setDetail({ kind: item.material_id ? 'material' : 'product', id: (item.material_id || item.product_id) as number, name: item.item_name })}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                      title="Klik untuk melihat rincian stok per batch dan mutasinya"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getItemTypeBadge(item.item_type)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {item.item_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {(item.material_id || item.product_id) ? (
                            <button
                              type="button"
                              onClick={() => setDetail({ kind: item.material_id ? 'material' : 'product', id: (item.material_id || item.product_id) as number, name: item.item_name })}
                              className="text-left hover:text-emerald-700 hover:underline"
                              title="Lihat rincian: stok per batch, kedaluwarsa, dan mutasinya"
                            >
                              {item.item_name}
                            </button>
                          ) : item.item_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.uom}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.category ? (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${warnaKelompokBarang(item.category, item.material_type)}`}>
                              {namaKelompokBarang(item.category, item.material_type)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{namaKategoriBarang(item.category)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{item.location_code}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.zone_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                        {item.quantity_on_hand.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-green-600 font-medium dark:text-green-400">
                        {item.quantity_available.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-orange-600 dark:text-orange-400">
                        {item.quantity_reserved.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {(item as any).batch_count > 1
                          ? <span title={(item as any).batch_list.join(', ')}>{(item as any).batch_count} batch</span>
                          : (item.batch_number || '-')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {getStockStatusBadge(item)}
                          {getPhysicalStatusBadge(item.stock_status)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {(item as any).expiry_nearest ? (
                          <span className={new Date((item as any).expiry_nearest) < new Date() ? 'text-red-600 font-medium dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}>
                            {new Date((item as any).expiry_nearest).toLocaleDateString('id-ID')}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Menampilkan {groupedInventory.length} baris ({inventory.length} dari {totalItems} baris stok)
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <ItemStockModal kind={detail.kind} itemId={detail.id} name={detail.name} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
