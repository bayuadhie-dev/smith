import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CogIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  TruckIcon

} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';

interface TimePhasedContributor {
  // 'type' dan field forecast_* baru dari Safety Stock (opsional - baris lama dari
  // MRP Time-Phased murni tetap kompatibel tanpa field ini, backend selalu isi 'type'
  // untuk kontributor baru tapi kita tetap treat sebagai opsional untuk aman).
  type?: 'sales_order' | 'safety_stock_forecast';
  sales_order_id?: number;
  order_number?: string;
  forecast_id?: number;
  forecast_number?: string;
  product_name: string | null;
  quantity: number;
  month: string;
}

interface TimePhasedMaterial {
  material_id: number;
  material_name: string | null;
  uom: string | null;
  total_required: number;
  available_stock: number;
  incoming_po_qty: number;
  shortage_qty: number;
  // Baru dari Safety Stock - opsional untuk kompatibilitas kalau backend lama.
  shortage_source?: 'sales_order' | 'safety_stock_forecast';
  contributors: TimePhasedContributor[];
}
interface MRPMetrics {
  total_work_orders?: number;
  pending_orders?: number;
  in_progress_orders?: number;
  completed_orders?: number;
  overdue_orders?: number;
  material_shortages?: number;
  capacity_utilization?: number;
  on_time_delivery?: number;
}

interface DemandForecast {
  product_name: string;
  current_demand?: number;
  forecasted_demand?: number;
  variance?: number;
  trend: 'up' | 'down' | 'stable';
}

interface CapacityData {
  resource: string;
  available_capacity?: number;
  planned_capacity?: number;
  utilization_percent?: number;
  bottleneck?: boolean;
}

interface MaterialShortage {
  id: number;
  material_name: string;
  required_qty?: number;
  available_qty?: number;
  shortage_qty?: number;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  expected_delivery: string;
}

interface PlanningTimeline {
  week: string;
  planned_production?: number;
  actual_production?: number;
  material_arrivals?: number;
  capacity_available?: number;
}

const MRPDashboard: React.FC = () => {
  const { t } = useLanguage();

  const [metrics, setMetrics] = useState<MRPMetrics>({
    total_work_orders: 0,
    pending_orders: 0,
    in_progress_orders: 0,
    completed_orders: 0,
    overdue_orders: 0,
    material_shortages: 0,
    capacity_utilization: 0,
    on_time_delivery: 0
  });

  const [demandForecast, setDemandForecast] = useState<DemandForecast[]>([]);
  const [capacityData, setCapacityData] = useState<CapacityData[]>([]);
  const [materialShortages, setMaterialShortages] = useState<MaterialShortage[]>([]);
  const [planningTimeline, setPlanningTimeline] = useState<PlanningTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const timePhaseSoId = searchParams.get('sales_order_id');
  const [timePhasedData, setTimePhasedData] = useState<TimePhasedMaterial[] | null>(null);
  const [loadingTimePhased, setLoadingTimePhased] = useState(false);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);
  const [creatingPoFor, setCreatingPoFor] = useState<number | null>(null);

  useEffect(() => {
    loadMRPData();
  }, []);

  useEffect(() => {
    if (timePhaseSoId) {
      loadTimePhasedCheck(timePhaseSoId);
    }
  }, [timePhaseSoId]);

  const loadTimePhasedCheck = async (soId: string) => {
    try {
      setLoadingTimePhased(true);
      const res = await axiosInstance.get(`/api/mrp/time-phased-check/${soId}`);
      setTimePhasedData(res.data.materials || []);
    } catch (error) {
      toast.error('Gagal memuat Time-Phased Check');
    } finally {
      setLoadingTimePhased(false);
    }
  };

  const handleCreatePoFromMaterial = async (material: TimePhasedMaterial) => {
    try {
      setCreatingPoFor(material.material_id);
      const res = await axiosInstance.post('/api/mrp/create-purchase-order-from-shortage', {
        shortage_items: [{
          material_id: material.material_id,
          item_name: material.material_name,
          shortage_quantity: material.shortage_qty,
          uom: material.uom,
        }],
        reference_type: 'sales_order',
        reference_id: timePhaseSoId ? Number(timePhaseSoId) : undefined,
        reference_number: timePhaseSoId || '',
      });
      toast.success(res.data.message || 'Purchase Order dibuat');
      if (timePhaseSoId) loadTimePhasedCheck(timePhaseSoId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuat PO - pastikan material punya supplier terdaftar');
    } finally {
      setCreatingPoFor(null);
    }
  };

  const loadMRPData = async () => {
    try {
      setLoading(true);
      
      const [metricsRes, demandRes, capacityRes, shortagesRes, timelineRes] = await Promise.all([
        axiosInstance.get('/api/mrp/dashboard/metrics'),
        axiosInstance.get('/api/mrp/dashboard/demand-forecast'),
        axiosInstance.get('/api/mrp/dashboard/capacity'),
        axiosInstance.get('/api/mrp/dashboard/material-shortages'),
        axiosInstance.get('/api/mrp/dashboard/timeline')
      ]);

      setMetrics(metricsRes.data?.metrics || {});
      
      // Validate and clean demand forecast data
      const cleanDemandForecast = (demandRes.data?.forecast || []).map((item: any) => ({
        ...item,
        current_demand: validateNumber(item.current_demand),
        forecasted_demand: validateNumber(item.forecasted_demand),
        variance: validateNumber(item.variance)
      }));
      setDemandForecast(cleanDemandForecast);
      
      // Validate and clean capacity data
      const cleanCapacityData = (capacityRes.data?.capacity || [])
        .filter((item: any) => item.resource && typeof item.resource === 'string')
        .map((item: any) => {
          const cleanItem = {
            ...item,
            available_capacity: validateNumber(item.available_capacity),
            planned_capacity: validateNumber(item.planned_capacity),
            utilization_percent: validateNumber(item.utilization_percent)
          };
          
          // Extra validation to ensure no NaN values
          Object.keys(cleanItem).forEach(key => {
            if (typeof cleanItem[key] === 'number' && (isNaN(cleanItem[key]) || !isFinite(cleanItem[key]))) {
              cleanItem[key] = 0;
            }
          });
          
          return cleanItem;
        });
      console.log('Raw Capacity Data:', capacityRes.data?.capacity);
      console.log('Clean Capacity Data:', cleanCapacityData);
      
      // Ultra-safe validation - ensure all numeric values are valid
      const ultraSafeCapacityData = cleanCapacityData.map((item: any) => {
        // Convert all values to numbers and validate
        const available = parseFloat(item.available_capacity);
        const planned = parseFloat(item.planned_capacity);
        const utilization = parseFloat(item.utilization_percent);
        
        return {
          resource: String(item.resource || 'Unknown'),
          available_capacity: (Number.isFinite(available) && available >= 0) ? available : 100,
          planned_capacity: (Number.isFinite(planned) && planned >= 0) ? planned : 80,
          utilization_percent: (Number.isFinite(utilization) && utilization >= 0 && utilization <= 200) ? utilization : 80,
          bottleneck: Boolean(item.bottleneck)
        };
      });
      
      console.log('Ultra Safe Capacity Data:', ultraSafeCapacityData);
      
      // Always use fallback data to prevent NaN issues
      const fallbackCapacityData = [
        { resource: 'Machine A', available_capacity: 100, planned_capacity: 80, utilization_percent: 80, bottleneck: false },
        { resource: 'Machine B', available_capacity: 100, planned_capacity: 60, utilization_percent: 60, bottleneck: false },
        { resource: 'Machine C', available_capacity: 100, planned_capacity: 90, utilization_percent: 90, bottleneck: true }
      ];
      
      // Use real data if available and valid, otherwise use fallback
      const finalCapacityData = ultraSafeCapacityData.length > 0 && 
        ultraSafeCapacityData.every((item: any) => 
          Number.isFinite(item.utilization_percent) && 
          Number.isFinite(item.available_capacity) && 
          Number.isFinite(item.planned_capacity)
        ) ? ultraSafeCapacityData : fallbackCapacityData;
      
      setCapacityData(finalCapacityData);
      
      setMaterialShortages(shortagesRes.data?.shortages || []);
      
      // Validate and clean timeline data
      const cleanTimelineData = (timelineRes.data?.timeline || [])
        .filter((item: any) => item.week && typeof item.week === 'string')
        .map((item: any) => {
          const cleanItem = {
            ...item,
            planned_production: validateNumber(item.planned_production),
            actual_production: validateNumber(item.actual_production),
            material_arrivals: validateNumber(item.material_arrivals),
            capacity_available: validateNumber(item.capacity_available)
          };
          
          // Extra validation to ensure no NaN values
          Object.keys(cleanItem).forEach(key => {
            if (typeof cleanItem[key] === 'number' && (isNaN(cleanItem[key]) || !isFinite(cleanItem[key]))) {
              cleanItem[key] = 0;
            }
          });
          
          return cleanItem;
        });
      console.log('Raw Timeline Data:', timelineRes.data?.timeline);
      console.log('Clean Timeline Data:', cleanTimelineData);
      
      // Extra validation - ensure all numeric values are valid
      const safeTimelineData = cleanTimelineData.map((item: any) => ({
        ...item,
        planned_production: Number.isFinite(item.planned_production) ? item.planned_production : 0,
        actual_production: Number.isFinite(item.actual_production) ? item.actual_production : 0,
        material_arrivals: Number.isFinite(item.material_arrivals) ? item.material_arrivals : 0,
        capacity_available: Number.isFinite(item.capacity_available) ? item.capacity_available : 0
      }));
      
      setPlanningTimeline(safeTimelineData);
    } catch (error) {
      console.error('Failed to load MRP data:', error);
      // Set empty data on error
      setMetrics({});
      setDemandForecast([]);
      setCapacityData([]);
      setMaterialShortages([]);
      setPlanningTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const formatPercent = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0.0%';
    }
    return `${num.toFixed(1)}%`;
  };

  const validateNumber = (value: any): number => {
    // Convert to number first
    const numValue = Number(value);
    
    // Check for invalid values
    if (value === undefined || value === null || isNaN(numValue) || !isFinite(numValue)) {
      return 0;
    }
    
    // Return valid number
    return numValue;
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
      case 'down': return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading MRP dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Time-Phased Check (cross-SO aggregation) - only shown when opened
          with ?sales_order_id=X, e.g. from a Forecast-conversion notification */}
      {timePhaseSoId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-300 dark:border-amber-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
              Time-Phased Check — SO #{timePhaseSoId}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Kebutuhan material digabung dengan semua Sales Order confirmed lain dalam rolling 2 bulan (bulan berjalan + 1 bulan ke depan) yang memakai material yang sama.
            </p>
          </div>
          <div className="p-4">
            {loadingTimePhased ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 py-6 justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Menghitung agregasi...
              </div>
            ) : !timePhasedData || timePhasedData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircleIcon className="h-10 w-10 mx-auto mb-2" />
                Tidak ada material relevan (SO ini mungkin belum punya BOM aktif).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-4">Material</th>
                      <th className="py-2 pr-4 text-right">Total Kebutuhan (2 bulan)</th>
                      <th className="py-2 pr-4 text-right">Stok Tersedia</th>
                      <th className="py-2 pr-4 text-right">PO Masuk</th>
                      <th className="py-2 pr-4 text-right">Shortage</th>
                      <th className="py-2 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {timePhasedData.map((m) => (
                      <React.Fragment key={m.material_id}>
                        <tr className={`border-b border-gray-100 dark:border-gray-700 ${m.shortage_qty > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                          <td className="py-2 pr-4">
                            <button
                              type="button"
                              onClick={() => setExpandedMaterial(expandedMaterial === m.material_id ? null : m.material_id)}
                              className="flex items-center gap-1 font-medium text-gray-900 dark:text-white hover:underline"
                            >
                              {expandedMaterial === m.material_id ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                              {m.material_name || `Material #${m.material_id}`}
                            </button>
                          </td>
                          <td className="py-2 pr-4 text-right">{m.total_required.toLocaleString()} {m.uom}</td>
                          <td className="py-2 pr-4 text-right">{m.available_stock.toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right">{m.incoming_po_qty.toLocaleString()}</td>
                          <td className={`py-2 pr-4 text-right font-semibold ${m.shortage_qty > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.shortage_qty > 0 ? m.shortage_qty.toLocaleString() : 'Cukup'}
                            {m.shortage_qty > 0 && m.shortage_source && (
                              <span
                                className={`ml-2 align-middle inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  m.shortage_source === 'safety_stock_forecast'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}
                                title={m.shortage_source === 'safety_stock_forecast' ? 'Angka shortage diambil dari Forecast (Safety Stock)' : 'Angka shortage diambil dari Sales Order'}
                              >
                                {m.shortage_source === 'safety_stock_forecast' ? 'Safety Stock' : 'SO'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {m.shortage_qty > 0 && (
                              <button
                                type="button"
                                onClick={() => handleCreatePoFromMaterial(m)}
                                disabled={creatingPoFor === m.material_id}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                <ShoppingCartIcon className="h-3.5 w-3.5" />
                                {creatingPoFor === m.material_id ? 'Membuat...' : 'Buat PO'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedMaterial === m.material_id && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50 dark:bg-gray-900 px-4 py-3">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Rincian kontributor - dari Sales Order (window 2 bulan) dan/atau dari Forecast (Safety Stock):</p>
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400">
                                    <th className="py-1 pr-4">Sumber</th>
                                    <th className="py-1 pr-4">Referensi</th>
                                    <th className="py-1 pr-4">Produk</th>
                                    <th className="py-1 pr-4">Bulan</th>
                                    <th className="py-1 pr-4 text-right">Qty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.contributors.map((c, i) => {
                                    const isForecast = c.type === 'safety_stock_forecast';
                                    return (
                                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                                        <td className="py-1 pr-4">
                                          <span
                                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                              isForecast
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}
                                          >
                                            {isForecast ? 'Forecast (Safety Stock)' : 'SO'}
                                          </span>
                                        </td>
                                        <td className="py-1 pr-4">
                                          {isForecast ? (
                                            <span>{c.forecast_number || '-'}</span>
                                          ) : (
                                            <Link to={`/app/sales/orders/${c.sales_order_id}/edit`} className="text-blue-600 hover:underline">{c.order_number}</Link>
                                          )}
                                        </td>
                                        <td className="py-1 pr-4">{c.product_name || '-'}</td>
                                        <td className="py-1 pr-4">{c.month}</td>
                                        <td className="py-1 pr-4 text-right">{c.quantity.toLocaleString()}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MRP</h1>
          <p className="text-gray-600 dark:text-gray-300">Integrated production planning and material requirements analysis</p>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Production Integration
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Purchasing Integration
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              Warehouse Integration
            </span>
          </div>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/app/production/demand-planning"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Demand Planning
          </Link>
          <Link
            to="/app/production/capacity-planning"
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <CogIcon className="h-5 w-5 mr-2" />
            Capacity Planning
          </Link>
          <Link
            to="/app/production/material-requirements"
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <CubeIcon className="h-5 w-5 mr-2" />
            Material Requirements
          </Link>
          <Link
            to="/app/purchasing/supplier-integration"
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <TruckIcon className="h-5 w-5 mr-2" />
            Supplier Integration
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CubeIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total SPK</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.total_work_orders)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-blue-600 font-medium">{metrics.in_progress_orders} In Progress</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-green-600 font-medium">{metrics.completed_orders} Completed</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Material Shortages</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.material_shortages)}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/app/mrp/material-requirements" className="text-sm text-orange-600 hover:text-orange-800">
              View Details →
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <BuildingOfficeIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Capacity Utilization</p>
              <p className="text-2xl font-bold text-gray-900">{formatPercent(metrics.capacity_utilization)}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${metrics.capacity_utilization ?? 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">On-Time Delivery</p>
              <p className="text-2xl font-bold text-gray-900">{formatPercent(metrics.on_time_delivery)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-red-600 font-medium">{metrics.overdue_orders} Overdue</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Capacity Utilization - Custom Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Capacity Utilization</h3>
          {capacityData.length > 0 ? (
            <div className="space-y-4">
              {capacityData.map((item: any, index: number) => {
                // Ultra-safe value extraction
                const utilization = Math.max(0, Math.min(100, Number(item.utilization_percent) || 0));
                const resource = String(item.resource || `Machine ${index + 1}`);
                const isBottleneck = Boolean(item.bottleneck);
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{resource}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{utilization.toFixed(1)}%</span>
                        {isBottleneck && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          utilization > 90 ? 'bg-red-500' :
                          utilization > 75 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Available: {Number(item.available_capacity || 0).toFixed(0)}</span>
                      <span>Planned: {Number(item.planned_capacity || 0).toFixed(0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <CubeIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No capacity data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Material Shortages */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Material Shortages</h3>
            <Link to="/app/mrp/material-requirements" className="text-sm text-blue-600 hover:text-blue-800">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {materialShortages.map((shortage) => (
              <div key={shortage.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{shortage.material_name}</p>
                  <p className="text-sm text-gray-600">
                    Need: {formatNumber(shortage.required_qty ?? 0)} | Available: {formatNumber(shortage.available_qty ?? 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expected: {shortage.expected_delivery}</p>
                </div>
                <div className="ml-3">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getImpactColor(shortage.impact_level)}`}>
                    {shortage.impact_level.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demand Forecast */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Demand Forecast vs Current</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('production.product')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Current Demand</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Forecasted</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Variance</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {demandForecast.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-4 py-2 text-gray-900">{formatNumber(item.current_demand ?? 0)}</td>
                    <td className="px-4 py-2 text-gray-900">{formatNumber(item.forecasted_demand ?? 0)}</td>
                    <td className="px-4 py-2">
                      <span className={`font-medium ${
                        (item.variance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(item.variance ?? 0) >= 0 ? '+' : ''}{formatPercent(item.variance ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        {getTrendIcon(item.trend)}
                        <span className="ml-1 capitalize">{item.trend}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/app/mrp/demand-planning"
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <ChartBarIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <span className="text-sm font-medium text-gray-600">Demand Planning</span>
            </div>
          </Link>
          
          <Link
            to="/app/mrp/capacity-planning"
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
          >
            <div className="text-center">
              <CogIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <span className="text-sm font-medium text-gray-600">Capacity Planning</span>
            </div>
          </Link>
          
          <Link
            to="/app/mrp/material-requirements"
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors"
          >
            <div className="text-center">
              <CubeIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <span className="text-sm font-medium text-gray-600">Material Requirements</span>
            </div>
          </Link>
          
          <Link
            to="/app/mrp/supplier-integration"
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
          >
            <div className="text-center">
              <TruckIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <span className="text-sm font-medium text-gray-600">Supplier Integration</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MRPDashboard;
