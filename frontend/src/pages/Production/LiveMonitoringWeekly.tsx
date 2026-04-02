import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SignalIcon, ChevronLeftIcon, ChevronRightIcon,
  CalendarIcon, CheckCircleIcon, XCircleIcon,
  ArrowLeftIcon, PrinterIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface WeeklySummaryData {
  week_start: string;
  week_end: string;
  dates: string[];
  machines: Array<{ id: number; name: string; code: string }>;
  summary: Array<{
    machine_id: number;
    machine_name: string;
    days: {
      [date: string]: {
        [slot: number]: any;
      };
    };
  }>;
  slots: Array<{ slot: number; label: string }>;
}

const LiveMonitoringWeekly: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('shift_1');
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ date: selectedDate, shift });
      const res = await axiosInstance.get(`/api/live-monitoring/weekly-summary?${params}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, shift]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWeekChange = (weeks: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (weeks * 7));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToThisWeek = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
  };

  const getShiftLabel = () => {
    switch (shift) {
      case 'shift_1': return 'Shift 1 (07:00-15:00)';
      case 'shift_2': return 'Shift 2 (15:00-23:00)';
      case 'shift_3': return 'Shift 3 (23:00-07:00)';
      default: return shift;
    }
  };

  const calculateStats = () => {
    if (!data) return { totalChecks: 0, runningCount: 0, stoppedCount: 0, pendingCount: 0 };
    
    let totalChecks = 0;
    let runningCount = 0;
    let stoppedCount = 0;
    let pendingCount = 0;
    const totalPossible = (data.machines?.length || 0) * (data.dates?.length || 0) * (data.slots?.length || 0);
    
    data.summary?.forEach(machine => {
      Object.values(machine.days || {}).forEach(daySlots => {
        Object.values(daySlots || {}).forEach(check => {
          if (check) {
            totalChecks++;
            if (check.machine_status === 'running') runningCount++;
            else if (check.machine_status === 'stopped') stoppedCount++;
          }
        });
      });
    });
    
    pendingCount = totalPossible - totalChecks;
    
    return { totalChecks, runningCount, stoppedCount, pendingCount, totalPossible };
  };

  const stats = calculateStats();

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-4 print:p-2 print:bg-white">
      <div className="max-w-full mx-auto space-y-4 print:space-y-2">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden print:shadow-none print:border">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 print:py-2 print:bg-emerald-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => navigate('/app/production/live-monitoring')}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors print:hidden"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-white" />
                </button>
                <div className="p-2 bg-white/20 rounded-lg print:hidden">
                  <SignalIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white print:text-lg">Summary Mingguan - Live Monitoring</h1>
                  <p className="text-emerald-100 text-sm print:text-xs">{getShiftLabel()}</p>
                </div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center space-x-3 print:hidden">
                <select 
                  value={shift} 
                  onChange={e => setShift(e.target.value)}
                  className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none"
                >
                  <option value="shift_1" className="text-gray-900">Shift 1</option>
                  <option value="shift_2" className="text-gray-900">Shift 2</option>
                  <option value="shift_3" className="text-gray-900">Shift 3</option>
                </select>
                <button
                  onClick={() => handleWeekChange(-1)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-white" />
                </button>
                <div className="text-center px-4">
                  <p className="text-white font-semibold text-sm">
                    {data?.week_start && formatDate(data.week_start)} - {data?.week_end && formatDate(data.week_end)}
                  </p>
                </div>
                <button
                  onClick={() => handleWeekChange(1)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ChevronRightIcon className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={goToThisWeek}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  Minggu Ini
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  <PrinterIcon className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Print Header */}
          <div className="hidden print:block px-4 py-2 border-b">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">Periode: {data?.week_start && formatDate(data.week_start)} - {data?.week_end && formatDate(data.week_end)}</p>
                <p className="text-xs text-gray-500">{getShiftLabel()}</p>
              </div>
              <p className="text-xs text-gray-400">Dicetak: {new Date().toLocaleString('id-ID')}</p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="px-6 py-3 print:py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-6 text-sm print:text-xs">
              <div className="flex items-center space-x-2">
                <CheckCircleSolid className="w-5 h-5 text-green-600 print:w-4 print:h-4" />
                <span className="text-gray-700"><strong>{stats.runningCount}</strong> Running</span>
              </div>
              <div className="flex items-center space-x-2">
                <XCircleIcon className="w-5 h-5 text-red-500 print:w-4 print:h-4" />
                <span className="text-gray-700"><strong>{stats.stoppedCount}</strong> Stopped</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-gray-200 rounded print:w-4 print:h-4"></div>
                <span className="text-gray-700"><strong>{stats.pendingCount}</strong> Belum dicek</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 print:text-xs">
              Total: <strong>{stats.totalChecks}</strong> / {stats.totalPossible} checks
            </div>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden print:shadow-none print:border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[100px] print:min-w-[80px]">
                    Mesin
                  </th>
                  {data?.dates?.map((dateStr: string) => (
                    <th key={dateStr} colSpan={data?.slots?.length || 4} className="px-1 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">
                      <div className="text-[10px]">{getDayName(dateStr)}</div>
                      <div className="text-gray-500 font-normal text-[10px]">{formatDate(dateStr)}</div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-100 px-3 py-1 text-left text-gray-500 border-r border-gray-200 text-[10px]">
                    Slot →
                  </th>
                  {data?.dates?.map((dateStr: string) => (
                    <React.Fragment key={`slots-${dateStr}`}>
                      {data?.slots?.map((slot, idx) => (
                        <th 
                          key={`${dateStr}-${slot.slot}`} 
                          className={`px-1 py-1 text-center text-[9px] font-medium text-gray-600 ${
                            idx === (data?.slots?.length || 0) - 1 ? 'border-r border-gray-200' : ''
                          }`}
                        >
                          {slot.label}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.summary?.map((machineData) => (
                  <tr key={machineData.machine_id} className="border-b border-gray-100 hover:bg-gray-50 print:hover:bg-white">
                    <td className="sticky left-0 bg-white px-2 py-1.5 font-medium text-gray-900 border-r border-gray-200 text-[10px] print:text-[9px]">
                      {machineData.machine_name}
                    </td>
                    {data?.dates?.map((dateStr: string) => (
                      <React.Fragment key={`${machineData.machine_id}-${dateStr}`}>
                        {data?.slots?.map((slot, idx) => {
                          const check = machineData.days?.[dateStr]?.[slot.slot];
                          const isLastSlot = idx === (data?.slots?.length || 0) - 1;
                          
                          return (
                            <td 
                              key={`${dateStr}-${slot.slot}`} 
                              className={`px-0.5 py-0.5 text-center ${isLastSlot ? 'border-r border-gray-200' : ''}`}
                            >
                              {check ? (
                                <button
                                  onClick={() => navigate(`/app/production/live-monitoring/view/${check.id}`)}
                                  className={`w-full h-6 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition ${
                                    check.machine_status === 'running' 
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                                  }`}
                                >
                                  {check.machine_status === 'running' ? (
                                    <CheckCircleSolid className="w-3.5 h-3.5" />
                                  ) : (
                                    <XCircleIcon className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-full h-6 rounded bg-gray-100 flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl shadow border border-gray-100 px-4 py-3 print:shadow-none print:py-2">
          <div className="flex items-center justify-center space-x-6 text-xs print:text-[10px]">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center print:w-5 print:h-5">
                <CheckCircleSolid className="w-4 h-4 text-green-600 print:w-3 print:h-3" />
              </div>
              <span className="text-gray-600">Running</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center print:w-5 print:h-5">
                <XCircleIcon className="w-4 h-4 text-red-600 print:w-3 print:h-3" />
              </div>
              <span className="text-gray-600">Stopped</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center print:w-5 print:h-5">
                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
              </div>
              <span className="text-gray-600">Belum dicek</span>
            </div>
          </div>
        </div>
        
        {/* Print Footer */}
        <div className="hidden print:block text-center text-[10px] text-gray-400 mt-4">
          Live Production Monitoring - Weekly Summary Report
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoringWeekly;
