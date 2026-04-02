import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  SignalIcon, ArrowLeftIcon, PrinterIcon, PencilSquareIcon,
  CheckCircleIcon, XCircleIcon, MinusCircleIcon,
  CogIcon, UserGroupIcon, ClockIcon, PlayIcon, StopIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

interface CheckDetail {
  id: number;
  check_date: string;
  shift: string;
  time_slot: number;
  slot_label: string;
  machine_id: number;
  machine_name: string;
  machine_code: string;
  machine_status: string;
  product_name?: string;
  wo_number?: string;
  stop_from?: string;
  stop_to?: string;
  stop_duration_minutes?: number;
  stop_reason?: string;
  stop_category?: string;
  actual_start_time?: string;
  start_delayed?: boolean;
  notes?: string;
  checked_by?: string;
  checked_at?: string;
  checklist_answers?: Array<{
    id: number;
    item_id: number;
    item_code: string;
    item_name: string;
    category: string;
    status: string;
    catatan: string;
  }>;
}

const LiveMonitoringView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CheckDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/live-monitoring/check/${id}`);
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const getShiftLabel = (shift: string) => {
    switch (shift) {
      case 'shift_1': return 'Shift 1 (07:00 - 15:00)';
      case 'shift_2': return 'Shift 2 (15:00 - 23:00)';
      case 'shift_3': return 'Shift 3 (23:00 - 07:00)';
      default: return shift;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Data tidak ditemukan</p>
      </div>
    );
  }

  const kondisiMesinItems = data.checklist_answers?.filter(a => a.category === 'KONDISI_MESIN') || [];
  const manpowerItems = data.checklist_answers?.filter(a => a.category === 'MANPOWER') || [];
  
  const okCount = data.checklist_answers?.filter(a => a.status === 'OK').length || 0;
  const ngCount = data.checklist_answers?.filter(a => a.status === 'NG').length || 0;
  const naCount = data.checklist_answers?.filter(a => a.status === 'NA').length || 0;
  const totalCount = data.checklist_answers?.length || 0;
  const ngItems = data.checklist_answers?.filter(a => a.status === 'NG') || [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 print:p-2 print:bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border mb-4 print:shadow-none print:mb-2">
          <div className="flex items-center justify-between p-4 border-b print:p-2">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg print:hidden"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <SignalIcon className="w-6 h-6 text-emerald-600 print:w-5 print:h-5" />
              <h1 className="text-lg font-bold text-gray-900 print:text-base">Live Monitoring Check</h1>
            </div>
            <div className="flex items-center space-x-2 print:hidden">
              <button 
                onClick={handlePrint}
                className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                <PrinterIcon className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button 
                onClick={() => navigate(`/app/production/live-monitoring`)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
              >
                <PencilSquareIcon className="w-4 h-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>
          
          {/* Info Bar */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 text-sm print:text-xs print:py-2 print:gap-2">
            <div className="flex items-center space-x-2">
              <CogIcon className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-900">{data.machine_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">📅</span>
              <span>{formatDate(data.check_date)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-4 h-4 text-gray-500" />
              <span>{getShiftLabel(data.shift)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">⏰</span>
              <span>Slot {data.slot_label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                data.machine_status === 'running' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {data.machine_status === 'running' ? '🟢 Running' : '🔴 Stopped'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-gray-500">
              <span>✅</span>
              <span>{formatTime(data.checked_at)}</span>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex items-center justify-center gap-6 py-3 bg-white rounded-xl shadow-sm border mb-4 print:shadow-none print:mb-2 print:py-2">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <span className="text-xl font-bold text-green-600 print:text-lg">{okCount}</span>
            <span className="text-sm text-gray-500">OK</span>
          </div>
          <div className="flex items-center space-x-2">
            <XCircleIcon className="w-5 h-5 text-red-600" />
            <span className="text-xl font-bold text-red-600 print:text-lg">{ngCount}</span>
            <span className="text-sm text-gray-500">NG</span>
          </div>
          <div className="flex items-center space-x-2">
            <MinusCircleIcon className="w-5 h-5 text-gray-400" />
            <span className="text-xl font-bold text-gray-400 print:text-lg">{naCount}</span>
            <span className="text-sm text-gray-500">N/A</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-gray-700 print:text-lg">{totalCount}</span>
            <span className="text-sm text-gray-500">Total</span>
          </div>
        </div>

        {/* Stop Info */}
        {data.machine_status === 'stopped' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 print:p-2 print:mb-2">
            <div className="flex items-center space-x-2 mb-2">
              <StopIcon className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-800">Mesin Berhenti</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm print:text-xs">
              <div>
                <span className="text-red-600">Dari:</span>
                <span className="ml-2 font-medium">{data.stop_from || '-'}</span>
              </div>
              <div>
                <span className="text-red-600">Sampai:</span>
                <span className="ml-2 font-medium">{data.stop_to || '-'}</span>
              </div>
              <div>
                <span className="text-red-600">Durasi:</span>
                <span className="ml-2 font-medium">{data.stop_duration_minutes || 0} menit</span>
              </div>
              <div>
                <span className="text-red-600">Kategori:</span>
                <span className="ml-2 font-medium capitalize">{data.stop_category || '-'}</span>
              </div>
            </div>
            {data.stop_reason && (
              <div className="mt-2 text-sm print:text-xs">
                <span className="text-red-600">Alasan:</span>
                <span className="ml-2">{data.stop_reason}</span>
              </div>
            )}
          </div>
        )}

        {/* NG Items Alert */}
        {ngItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 print:p-2 print:mb-2">
            <h3 className="font-semibold text-red-800 mb-2 flex items-center">
              <XCircleIcon className="w-5 h-5 mr-2" />
              Item NG - Perlu Tindakan:
            </h3>
            <ul className="space-y-1">
              {ngItems.map(item => (
                <li key={item.id} className="text-sm text-red-700 print:text-xs">
                  • {item.item_name}{item.catatan && `: ${item.catatan}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Checklist Grid */}
        <div className="bg-white rounded-xl shadow-sm border print:shadow-none">
          {/* Kondisi Mesin */}
          {kondisiMesinItems.length > 0 && (
            <div className="p-4 print:p-2">
              <div className="flex items-center space-x-2 mb-3 print:mb-2">
                <CogIcon className="w-5 h-5 text-blue-600 print:w-4 print:h-4" />
                <h3 className="font-semibold text-gray-800">Kondisi Mesin</h3>
                <span className="text-xs text-gray-500">({kondisiMesinItems.length} item)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 print:gap-1">
                {kondisiMesinItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border print:p-1 ${
                    item.status === 'NG' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 font-medium print:text-[10px]">{idx + 1}</span>
                      <span className="text-xs text-gray-700 print:text-[10px]">{item.item_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold print:text-[10px] print:px-1 ${
                      item.status === 'OK' ? 'bg-green-500 text-white' :
                      item.status === 'NG' ? 'bg-red-500 text-white' :
                      'bg-gray-400 text-white'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Man Power */}
          {manpowerItems.length > 0 && (
            <div className="p-4 border-t print:p-2">
              <div className="flex items-center space-x-2 mb-3 print:mb-2">
                <UserGroupIcon className="w-5 h-5 text-purple-600 print:w-4 print:h-4" />
                <h3 className="font-semibold text-gray-800">Man Power</h3>
                <span className="text-xs text-gray-500">({manpowerItems.length} item)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 print:gap-1">
                {manpowerItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border print:p-1 ${
                    item.status === 'NG' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 font-medium print:text-[10px]">{idx + 1}</span>
                      <span className="text-xs text-gray-700 print:text-[10px]">{item.item_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold print:text-[10px] print:px-1 ${
                      item.status === 'OK' ? 'bg-green-500 text-white' :
                      item.status === 'NG' ? 'bg-red-500 text-white' :
                      'bg-gray-400 text-white'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {data.notes && (
            <div className="p-4 border-t bg-amber-50 print:p-2">
              <p className="text-sm print:text-xs">
                <span className="font-semibold text-amber-800">Catatan:</span>
                <span className="text-amber-700 ml-2">{data.notes}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoringView;
