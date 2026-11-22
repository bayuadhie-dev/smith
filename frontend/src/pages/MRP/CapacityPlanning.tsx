import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Panel } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';
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
    if (utilization >= 95) return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
    if (utilization >= 85) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (utilization >= 70) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'idle': return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Memuat data kapasitas...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center space-x-4">
          <Link
            to="/app/mrp"
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-white dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Kembali ke Dashboard MRP
          </Link>
          <div>
            <div className="fn-label mb-1.5">MRP · KAPASITAS</div>
            <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">Perencanaan Kapasitas</h1>
            <p className="text-gray-600 mt-1 dark:text-gray-300">Kapasitas mesin dibanding beban yang sudah dijadwalkan</p>
          </div>
        </div>
      </div>

      <Panel title="Pemakaian kapasitas sepanjang waktu">
        <div className="px-4 pb-3 pt-1">
          {timeline.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data kapasitas.</p>
          ) : (
            <RunChart
              values={timeline.map((t: any) => Number(t.planned_load || 0))}
              axis={Array.from(new Set([0, Math.floor(timeline.length / 2), timeline.length - 1]))
                .map((i: number) => String((timeline[i] as any)?.date || '').slice(5))
                .filter(Boolean)}
              rows={[
                { label: 'Kapasitas tersedia', values: timeline.map((t: any) => Number(t.available_capacity || 0)) },
                { label: 'Beban rencana', values: timeline.map((t: any) => Number(t.planned_load || 0)) },
                { label: 'Beban nyata', values: timeline.map((t: any) => Number(t.actual_load || 0)) },
              ]}
              height={210}
              unit="jam"
            />
          )}
        </div>
      </Panel>

      {/* Resource Capacity Table */}
      <div className="fn-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kapasitas per sumber daya</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sumber daya</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Jenis</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tersedia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rencana</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pemakaian</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Efisiensi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hambatan</th>
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
