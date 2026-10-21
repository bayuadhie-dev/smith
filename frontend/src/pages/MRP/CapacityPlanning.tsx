import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import axiosInstance from '../../utils/axiosConfig';
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  ExclamationTriangleIcon,
  UserGroupIcon

} from '@heroicons/react/24/outline';
interface CapacityResource {
  id: number;
  resource_name: string;
  resource_type: 'machine' | 'labor' | 'facility';
  available_capacity: number;
  planned_capacity: number;
  utilization_percent: number;
  bottleneck: boolean;
  efficiency: number;
  status: 'active' | 'maintenance' | 'idle';
}

interface CapacityTimeline {
  date: string;
  available_capacity: number;
  planned_load: number;
  actual_load: number;
  utilization: number;
}

const CapacityPlanning: React.FC = () => {
  const { t } = useLanguage();

  const [resources, setResources] = useState<CapacityResource[]>([]);
  const [timeline, setTimeline] = useState<CapacityTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCapacityData();
  }, []);

  const loadCapacityData = async () => {
    try {
      setLoading(true);
      
      const [resourcesRes, timelineRes] = await Promise.all([
        axiosInstance.get('/api/mrp/capacity/resources'),
        axiosInstance.get('/api/mrp/capacity/timeline')
      ]);

      setResources(resourcesRes.data?.resources || []);
      setTimeline(timelineRes.data?.timeline || []);
    } catch (error) {
      console.error('Failed to load capacity data:', error);
      // 2026-10-07: this used to fall back to 4 fake resources ("Production
      // Line A/B" at fixed 85%/98.3% utilization, etc) and a 4-week fake
      // timeline on ANY API error. A capacity-planning page showing a fake
      // bottleneck ("Production Line B" flagged bottleneck:true) could
      // drive a real scheduling decision. Honest empty state instead.
      setResources([]);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 95) return 'text-red-600 bg-red-100';
    if (utilization >= 85) return 'text-yellow-600 bg-yellow-100';
    if (utilization >= 70) return 'text-green-600 bg-green-100';
    return 'text-blue-600 bg-blue-100';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      case 'idle': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading capacity planning data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link
            to="/app/mrp"
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to MRP Dashboard
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Capacity Planning</h1>
            <p className="text-gray-600 mt-1">Manage production capacity and resource utilization</p>
          </div>
        </div>
      </div>

      {/* Capacity Timeline Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Capacity Utilization Timeline</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              formatNumber(value as number),
              name === 'available_capacity' ? 'Available' :
              name === 'planned_load' ? 'Planned Load' : 'Actual Load'
            ]} />
            <Area type="monotone" dataKey="available_capacity" stackId="1" stroke="#94A3B8" fill="#94A3B8" fillOpacity={0.3} />
            <Area type="monotone" dataKey="planned_load" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="actual_load" stackId="3" stroke="#10B981" fill="#10B981" fillOpacity={0.8} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Resource Capacity Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Capacity Overview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Available</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Planned</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Utilization</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Efficiency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bottleneck</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {resources.map((resource) => (
                <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      {resource.resource_type === 'machine' ? (
                        <CogIcon className="h-5 w-5 text-gray-400 mr-2" />
                      ) : resource.resource_type === 'labor' ? (
                        <UserGroupIcon className="h-5 w-5 text-gray-400 mr-2" />
                      ) : (
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{resource.resource_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white capitalize">{resource.resource_type}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{formatNumber(resource.available_capacity)}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{formatNumber(resource.planned_capacity)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getUtilizationColor(resource.utilization_percent)}`}>
                        {formatPercent(resource.utilization_percent)}
                      </span>
                      <div className="ml-2 w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.min(resource.utilization_percent, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{formatPercent(resource.efficiency)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(resource.status)}`}>
                      {resource.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {resource.bottleneck ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CapacityPlanning;
