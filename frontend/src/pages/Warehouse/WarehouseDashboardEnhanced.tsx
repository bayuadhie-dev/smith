import { PageHeader, KpiStrip, QuickLinks } from '../../components/ui/PageKit'
import { formatRupiah } from '../../utils/currencyUtils'
import React, { useState } from 'react'
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BuildingStorefrontIcon,
  ChartBarIcon,
  ClockIcon,
  Cog6ToothIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import {
  useGetWarehouseDashboardQuery,
  useGetWarehouseAlertsQuery,
  useAcknowledgeWarehouseAlertMutation,
  useResolveWarehouseAlertMutation,
  useGetWarehouseZonesQuery,
  useGetWarehouseLocationsQuery,
  useGetInventoryQuery
} from '../../services/api';
export default function WarehouseDashboardEnhanced() {
    const { t } = useLanguage();

const [alertFilter, setAlertFilter] = useState('active')
  
  const { data: dashboardData, isLoading: dashboardLoading } = useGetWarehouseDashboardQuery(undefined)
  const { data: alertsData, isLoading: alertsLoading } = useGetWarehouseAlertsQuery({ status: alertFilter })
  
  // Traditional warehouse data
  const { data: zonesData } = useGetWarehouseZonesQuery({})
  const { data: locationsData } = useGetWarehouseLocationsQuery({})
  const { data: inventoryData } = useGetInventoryQuery({})
  
  const [acknowledgeAlert] = useAcknowledgeWarehouseAlertMutation()
  const [resolveAlert] = useResolveWarehouseAlertMutation()

  const summary = dashboardData?.summary || {}
  const movements = dashboardData?.movements || {}
  const abcAnalysis = dashboardData?.abc_analysis || {}
  const recentMovements = dashboardData?.recent_movements || []
  const topProducts = dashboardData?.top_products || []
  const alerts = alertsData?.alerts || []

  // Traditional warehouse data
  const zones = zonesData?.zones || []
  const locations = locationsData?.locations || []
  const inventory = inventoryData?.inventory || []

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await acknowledgeAlert(alertId).unwrap()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const handleResolveAlert = async (alertId: number, notes: string) => {
    try {
      await resolveAlert({ alertId, resolution_notes: notes }).unwrap()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-700'
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'receive': return '#10B981'
      case 'issue': return '#EF4444'
      case 'transfer': return '#3B82F6'
      case 'adjust': return '#F59E0B'
      default: return '#6B7280'
    }
  }

  // Chart data preparation
  const movementChartData = [
    { name: 'Receipts', value: movements?.receipts || 0, color: '#10B981' },
    { name: 'Issues', value: movements?.issues || 0, color: '#EF4444' },
    { name: 'Transfers', value: movements?.transfers || 0, color: '#3B82F6' },
    { name: 'Adjustments', value: movements?.adjustments || 0, color: '#F59E0B' }
  ]

  const abcChartData = [
    { name: 'Category A', count: abcAnalysis.A?.count || 0, value: abcAnalysis.A?.value || 0, color: '#EF4444' },
    { name: 'Category B', count: abcAnalysis.B?.count || 0, value: abcAnalysis.B?.value || 0, color: '#F59E0B' },
    { name: 'Category C', count: abcAnalysis.C?.count || 0, value: abcAnalysis.C?.value || 0, color: '#10B981' }
  ]

  if (dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #3 of 4). See Dashboard/DashboardEnhanced.tsx for the reference
  // pattern. Sub-pages (Inventory list, Zones, Locations, etc) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader
        title="Dashboard Gudang"
        subtitle="Stok, lokasi, dan peringatan gudang"
        actions={
          <>
            <Link to="/app/warehouse/inventory" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Inventori</Link>
            <Link to="/app/warehouse/stock-input" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Input Material</Link>
            <Link to="/app/warehouse/inventory/add-product" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Tambah Produk</Link>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total produk', value: (summary.total_products || 0).toLocaleString('id-ID'), hint: 'di semua lokasi' },
          { label: 'Nilai stok fisik', value: formatRupiah(summary.total_value || 0), hint: 'jumlah stok × harga master' },
          { label: 'Pemakaian lokasi', value: `${summary.location_utilization || 0}%`, hint: 'kapasitas terpakai' },
          { label: 'Peringatan aktif', value: summary.active_alerts || 0, tone: summary.active_alerts > 0 ? 'bad' : null, hint: summary.critical_alerts > 0 ? `${summary.critical_alerts} kritis` : 'perlu perhatian' },
        ]}
      />

      <KpiStrip
        items={[
          { label: 'Barang di bawah minimum', value: summary.low_stock_items || 0, tone: summary.low_stock_items > 0 ? 'warn' : null, hint: 'di bawah titik pesan ulang' },
          { label: 'Hampir kedaluwarsa', value: summary.expiring_soon || 0, tone: summary.expiring_soon > 0 ? 'warn' : null, hint: '30 hari ke depan' },
          { label: 'Total lokasi', value: summary.total_locations || locations.length || 0, hint: `${locations.filter(l => l.is_available !== false).length} tersedia` },
        ]}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movement Analysis */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Mutasi stok 7 hari terakhir</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={movementChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {movementChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value.toLocaleString(), t('common.quantity')]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ABC Analysis */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Analisis ABC</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={abcChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toLocaleString(), '']} />
                <Bar dataKey="count" fill="#3B82F6" name="Product Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Warehouse Management Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Pengelolaan gudang</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Zones Management */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Zona</h4>
              <Link to="/app/warehouse/zones" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm">
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Total Zones:</span>
                <span className="font-medium">{zones.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Active:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {zones.filter(z => z.is_active !== false).length}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {zones.slice(0, 3).map((zone, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 truncate">{zone.name}</span>
                  <span className="text-gray-400">{zone.material_type}</span>
                </div>
              ))}
              {zones.length > 3 && (
                <div className="text-xs text-gray-400">+{zones.length - 3} more</div>
              )}
            </div>
          </div>

          {/* Locations Management */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Lokasi</h4>
              <Link to="/app/warehouse/locations" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm">
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Total Locations:</span>
                <span className="font-medium">{locations.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Available:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {locations.filter(l => l.is_available !== false).length}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {locations.slice(0, 3).map((location, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 truncate">{location.location_code}</span>
                  <span className="text-gray-400">
                    {location.occupied || 0}/{location.capacity || 0}
                  </span>
                </div>
              ))}
              {locations.length > 3 && (
                <div className="text-xs text-gray-400">+{locations.length - 3} more</div>
              )}
            </div>
          </div>

          {/* Inventory Management */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Inventori</h4>
              <Link to="/app/warehouse/inventory" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm">
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">SKUs:</span>
                <span className="font-medium">{inventory.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Low Stock:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {inventory.filter(i => (i.available_quantity || 0) < 10).length}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {inventory.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 truncate">
                    {item.product?.name || `Product ${item.product_id}`}
                  </span>
                  <span className="text-gray-400">{item.quantity || 0}</span>
                </div>
              ))}
              {inventory.length > 3 && (
                <div className="text-xs text-gray-400">+{inventory.length - 3} more</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Movements */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mutasi terbaru</h3>
            <Link to="/app/warehouse/movements" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentMovements.slice(0, 5).map((movement, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: getMovementTypeColor(movement.type) }}
                  ></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{movement.product}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {movement.type} • {movement.quantity} units • {movement.location}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(movement.date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Peringatan aktif</h3>
            <Link to="/app/warehouse/alerts" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm mt-1">{alert.message}</p>
                    {alert.product_name && (
                      <p className="text-xs mt-1">Product: {alert.product_name}</p>
                    )}
                  </div>
                  <div className="flex space-x-1 ml-2">
                    {alert.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-xs"
                          title="Acknowledge"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleResolveAlert(alert.id, 'Resolved from dashboard')}
                          className="text-green-600 hover:text-green-800 text-xs dark:text-green-400"
                          title="Resolve"
                        >
                          ✓
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products by Value */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk dengan nilai tertinggi</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('production.product')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.quantity')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {topProducts.map((product, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {product.quantity.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${product.value.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {summary.total_value > 0 ? ((product.value / summary.total_value) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <QuickLinks
        title="Pintasan"
        links={[
          { to: '/app/warehouse/analytics', label: 'Analitik gudang' },
          { to: '/app/warehouse/abc-analysis', label: 'Analisis ABC' },
          { to: '/app/production/mrp-run', label: 'MRP Run (titik pesan ulang)' },
          { to: '/app/warehouse/zones', label: 'Zona' },
          { to: '/app/warehouse/locations', label: 'Lokasi' },
          { to: '/app/warehouse/inventory', label: 'Inventori' },
        ]}
      />
    </div>
  )
}
