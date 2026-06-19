import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ChartBarIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface CycleCount {
  id: number;
  schedule_number: string;
  zone: string;
  location: string;
  abc_category: string | null;
  frequency: string;
  next_count_date: string;
  last_count_date: string | null;
  assigned_to: string | null;
  status: string;
  total_items_counted: number;
  discrepancies_found: number;
  accuracy_percentage: number;
  notes: string | null;
  created_at: string;
}

const freqLabels: Record<string, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  quarterly: 'Per Kuartal',
};

const CycleCountPage: React.FC = () => {
  const [data, setData] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/wms/cycle-counts', { params });
      setData(res.data.schedules);
    } catch (err: any) {
      toast.error('Gagal memuat cycle count');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ChartBarIcon className="h-7 w-7 text-teal-600" />
          Cycle Count
        </h1>
        <p className="text-gray-500 mt-1">Jadwal penghitungan stok berkala untuk menjaga akurasi inventori</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Semua Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <ChartBarIcon className="h-12 w-12 mx-auto mb-3" />
          <p>Belum ada jadwal cycle count</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((cc) => {
            const overdue = cc.status === 'active' && isOverdue(cc.next_count_date);
            return (
              <div
                key={cc.id}
                className={`bg-white rounded-xl shadow-sm border p-5 ${overdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-gray-700">{cc.schedule_number}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    cc.status === 'active' ? (overdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700') :
                    cc.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {overdue ? 'Overdue' : cc.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20">Zona:</span>
                    <span className="font-medium">{cc.zone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20">Lokasi:</span>
                    <span>{cc.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20">Frekuensi:</span>
                    <span>{freqLabels[cc.frequency] || cc.frequency}</span>
                  </div>
                  {cc.abc_category && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-20">ABC:</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">{cc.abc_category}</span>
                    </div>
                  )}
                </div>

                {/* Next count */}
                <div className={`mt-3 p-3 rounded-lg ${overdue ? 'bg-red-100' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Counting berikutnya:</span>
                    <span className={`font-medium ${overdue ? 'text-red-700' : 'text-gray-900'}`}>
                      {new Date(cc.next_count_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                {cc.total_items_counted > 0 && (
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>{cc.accuracy_percentage}% akurasi</span>
                    </div>
                    {cc.discrepancies_found > 0 && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <ExclamationCircleIcon className="h-4 w-4" />
                        <span>{cc.discrepancies_found} selisih</span>
                      </div>
                    )}
                  </div>
                )}

                {cc.assigned_to && (
                  <p className="mt-2 text-xs text-gray-400">Ditugaskan: {cc.assigned_to}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CycleCountPage;
