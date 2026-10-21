import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import { useGetShippingOrdersQuery } from '../../services/shippingApi'
import {
  CalculatorIcon,
  ChartBarIcon,
  ChartBarIcon as Calculator,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  MapPinIcon,
  PlusIcon,
  TruckIcon,
  CubeIcon,
  ArrowRightIcon

} from '@heroicons/react/24/outline';

interface ReadyForShippingItem {
  work_order_id: number
  work_order_number: string
  qc_inspection_id: number
  qc_number: string
  qc_date: string | null
  product_id: number
  product_code: string | null
  product_name: string
  quantity_produced: number
  quantity_passed: number
  uom: string
  batch_number: string | null
  sales_order_id: number | null
  sales_order_number: string | null
  customer_id: number | null
  customer_name: string
  delivery_address: string | null
  production_date: string | null
  notes: string | null
}

export default function ShippingDashboard() {
  const navigate = useNavigate()
  const { t } = useLanguage();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [readyForShipping, setReadyForShipping] = useState<ReadyForShippingItem[]>([])
  const [loadingReady, setLoadingReady] = useState(true)
  
  // Fetch shipping data
  const { data: shippingData, isLoading } = useGetShippingOrdersQuery({
    page: 1,
    per_page: 100
  })

  // Fetch ready for shipping items
  useEffect(() => {
    const fetchReadyItems = async () => {
      try {
        const response = await fetch('/api/shipping/ready-for-shipping', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setReadyForShipping(data.ready_for_shipping || [])
        }
      } catch (error) {
        console.error('Error fetching ready items:', error)
      } finally {
        setLoadingReady(false)
      }
    }
    fetchReadyItems()
  }, [])

  // Calculate metrics
  const totalShipments = shippingData?.shipping_orders?.length || 0
  const inTransit = shippingData?.shipping_orders?.filter((s: any) => s.status === 'in_transit').length || 0
  const delivered = shippingData?.shipping_orders?.filter((s: any) => s.status === 'delivered').length || 0
  const pending = shippingData?.shipping_orders?.filter((s: any) => s.status === 'preparing').length || 0

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      preparing: 'badge-warning',
      packed: 'badge-info',
      shipped: 'badge-primary',
      in_transit: 'badge-info',
      delivered: 'badge-success',
      cancelled: 'badge-danger'
    }
    return statusClasses[status as keyof typeof statusClasses] || 'badge-secondary'
  }

  const getStatusText = (status: string) => {
    const statusTexts = {
      preparing: 'Mempersiapkan',
      packed: 'Dikemas',
      shipped: 'Dikirim',
      in_transit: 'Dalam Perjalanan',
      delivered: 'Terkirim',
      cancelled: 'Dibatalkan'
    }
    return statusTexts[status as keyof typeof statusTexts] || status
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#059669]"></div>
      </div>
    )
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #10 of 17). Sub-pages (Orders, Tracking, Calculator, etc) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Dashboard Pengiriman</h1>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="input"
          />
          <button
            onClick={() => navigate('/app/shipping/orders/new')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Buat Pengiriman Baru
          </button>
        </div>
      </div>

      {/* Key Metrics - bento: Total Pengiriman spans 2 cols (primary metric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-2 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <TruckIcon className="w-5 h-5" />
            </div>
            <p className="text-sm opacity-90">Total Pengiriman</p>
          </div>
          <p className="text-3xl font-bold">{totalShipments}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <ClockIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Dalam Perjalanan</p>
          <p className="text-2xl font-bold">{inTransit}</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Terkirim</p>
          <p className="text-2xl font-bold">{delivered}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Menunggu</p>
          <p className="text-2xl font-bold">{pending}</p>
        </div>
      </div>

      {/* Ready for Shipping - From QC */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <div className="bg-gradient-to-br from-[#059669] to-[#047857] p-1.5 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-white" />
            </div>
            Siap Kirim dari QC ({readyForShipping.length})
          </h2>
          <button
            onClick={() => navigate('/app/shipping/orders/from-qc')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <TruckIcon className="h-5 w-5" />
            Buat Pengiriman dari QC
          </button>
        </div>
        
        {loadingReady ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : readyForShipping.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <CubeIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Tidak ada item siap kirim</p>
            <p className="text-sm">Pastikan ada SPK yang sudah lulus QC</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-green-200">
              <thead className="bg-green-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">SPK</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Qty Lulus QC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Sales Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Tanggal QC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-green-100">
                {readyForShipping.slice(0, 5).map((item) => (
                  <tr key={item.work_order_id} className="hover:bg-green-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                      {item.work_order_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.product_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.product_code}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.quantity_passed.toLocaleString()} {item.uom}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {item.customer_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.sales_order_number || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.qc_date ? new Date(item.qc_date).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => navigate('/app/shipping/orders/from-qc')}
                        className="text-green-600 hover:text-green-800 font-medium text-sm inline-flex items-center gap-1"
                      >
                        Kirim <ArrowRightIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {readyForShipping.length > 5 && (
              <div className="text-center py-3 border-t border-green-200">
                <button
                  onClick={() => navigate('/app/shipping/orders/from-qc')}
                  className="text-green-600 hover:text-green-800 font-medium text-sm"
                >
                  Lihat semua {readyForShipping.length} item siap kirim →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => navigate('/app/shipping/orders/from-qc')}
            className="btn-outline inline-flex items-center justify-center gap-2 p-4 border-green-300 text-green-700 hover:bg-green-50"
          >
            <CheckCircleIcon className="h-5 w-5" />
            Kirim dari QC
          </button>
          <button
            onClick={() => navigate('/app/shipping/orders/new')}
            className="btn-outline inline-flex items-center justify-center gap-2 p-4"
          >
            <PlusIcon className="h-5 w-5" />
            Buat Pengiriman
          </button>
          <button
            onClick={() => navigate('/app/shipping/tracking')}
            className="btn-outline inline-flex items-center justify-center gap-2 p-4"
          >
            <MapPinIcon className="h-5 w-5" />
            Lacak Pengiriman
          </button>
          <button
            onClick={() => navigate('/app/shipping/calculator')}
            className="btn-outline inline-flex items-center justify-center gap-2 p-4"
          >
            <CalculatorIcon className="h-5 w-5" />
            Kalkulator Biaya
          </button>
          <button
            onClick={() => navigate('/app/shipping/providers')}
            className="btn-outline inline-flex items-center justify-center gap-2 p-4"
          >
            <TruckIcon className="h-5 w-5" />
            Kelola Provider
          </button>
        </div>
      </div>

      {/* Recent Shipments */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Pengiriman Terbaru</h2>
          <button
            onClick={() => navigate('/app/shipping/orders')}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm font-medium"
          >
            Lihat Semua
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  No. Pengiriman
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Kirim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {shippingData?.shipping_orders?.slice(0, 5).map((shipment: any) => (
                <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {shipment.shipping_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {shipment.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(shipment.shipping_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${getStatusBadge(shipment.status)}`}>
                      {getStatusText(shipment.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {shipment.tracking_number || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Peringatan</h3>
          <div className="space-y-3">
            {pending > 0 && (
              <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-3" />
                <span className="text-sm text-yellow-800">
                  {pending} pengiriman menunggu untuk diproses
                </span>
              </div>
            )}
            {inTransit > 5 && (
              <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <TruckIcon className="h-5 w-5 text-blue-600 mr-3" />
                <span className="text-sm text-blue-800">
                  {inTransit} pengiriman sedang dalam perjalanan
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Statistik Hari Ini</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Pengiriman Baru</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {shippingData?.shipping_orders?.filter((s: any) => 
                  new Date(s.shipping_date).toDateString() === new Date().toDateString()
                ).length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Terkirim Hari Ini</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {delivered}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Rata-rata Waktu Kirim</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">2-3 hari</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
