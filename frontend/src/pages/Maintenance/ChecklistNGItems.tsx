import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WrenchScrewdriverIcon, ExclamationTriangleIcon, CheckCircleIcon,
  ClockIcon, XCircleIcon, ArrowPathIcon, FunnelIcon,
  ChevronDownIcon, ChevronUpIcon, CogIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

interface CorrectiveAction {
  id: number;
  repair_status: string;
  repair_notes: string;
  reason_cannot_repair: string;
  deferred_reason: string;
  deferred_until: string;
  started_at: string;
  completed_at: string;
  handled_by_name: string;
  // Supervisor fields
  priority: string;
  supervisor_note: string;
  supervisor_name: string;
  supervisor_noted_at: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; sortOrder: number }> = {
  urgent: { label: 'URGENT', color: 'bg-red-600 text-white', sortOrder: 1 },
  high: { label: 'Tinggi', color: 'bg-orange-500 text-white', sortOrder: 2 },
  normal: { label: 'Normal', color: 'bg-blue-500 text-white', sortOrder: 3 },
  low: { label: 'Rendah', color: 'bg-gray-400 text-white', sortOrder: 4 },
};

interface NGItem {
  answer_id: number;
  item_id: number;
  item_name: string;
  item_category: string;
  catatan: string;
  machine_id: number;
  machine_name: string;
  tanggal: string;
  shift: number;
  operator_name: string;
  submission_id: number;
  corrective_action: CorrectiveAction | null;
}

const REPAIR_STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'in_progress', label: 'Sedang Dikerjakan', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Selesai', color: 'bg-green-100 text-green-800' },
  { value: 'cannot_repair', label: 'Tidak Bisa Diperbaiki', color: 'bg-red-100 text-red-800' },
  { value: 'deferred', label: 'Ditunda', color: 'bg-gray-100 text-gray-800' },
];

const ChecklistNGItems: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NGItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterMachine, setFilterMachine] = useState<number | ''>('');
  const [machines, setMachines] = useState<Array<{id: number; name: string}>>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (filterMachine) params.append('machine_id', String(filterMachine));
      if (filterStatus) params.append('repair_status', filterStatus);

      const res = await axiosInstance.get(`/api/pre-shift-checklist/ng-items?${params}`);
      // Sort by priority (urgent first) then by date
      const sortedItems = (res.data.ng_items || []).sort((a: NGItem, b: NGItem) => {
        const aPriority = PRIORITY_CONFIG[a.corrective_action?.priority || 'normal']?.sortOrder || 3;
        const bPriority = PRIORITY_CONFIG[b.corrective_action?.priority || 'normal']?.sortOrder || 3;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
      });
      setItems(sortedItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterMachine, filterStatus]);

  const fetchMachines = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/api/machines?is_active=true');
      setMachines(res.data.machines || res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateCorrectiveAction = async (answerId: number, data: any) => {
    try {
      setSaving(true);
      await axiosInstance.post(`/api/pre-shift-checklist/answers/${answerId}/corrective-action`, data);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const opt = REPAIR_STATUS_OPTIONS.find(o => o.value === status) || REPAIR_STATUS_OPTIONS[0];
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${opt.color}`}>{opt.label}</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => !i.corrective_action || i.corrective_action.repair_status === 'pending').length,
    inProgress: items.filter(i => i.corrective_action?.repair_status === 'in_progress').length,
    completed: items.filter(i => i.corrective_action?.repair_status === 'completed').length,
    cannotRepair: items.filter(i => i.corrective_action?.repair_status === 'cannot_repair').length,
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <WrenchScrewdriverIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Checklist NG Items</h1>
                  <p className="text-orange-100 text-sm">Item yang perlu diperbaiki dari Pre-Shift Checklist</p>
                </div>
              </div>
              <button onClick={fetchData} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition">
                <ArrowPathIcon className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 bg-orange-50 border-b flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Filter:</span>
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1 border rounded text-sm" />
            <span className="text-gray-400">-</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1 border rounded text-sm" />
            <select value={filterMachine} onChange={e => setFilterMachine(e.target.value ? Number(e.target.value) : '')}
              className="px-2 py-1 border rounded text-sm">
              <option value="">Semua Mesin</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-1 border rounded text-sm">
              <option value="">Semua Status</option>
              {REPAIR_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Stats */}
          <div className="px-6 py-3 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
              <span><strong>{stats.total}</strong> Total NG</span>
            </div>
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-5 h-5 text-yellow-500" />
              <span><strong>{stats.pending}</strong> Menunggu</span>
            </div>
            <div className="flex items-center space-x-2">
              <CogIcon className="w-5 h-5 text-blue-500" />
              <span><strong>{stats.inProgress}</strong> Dikerjakan</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
              <span><strong>{stats.completed}</strong> Selesai</span>
            </div>
            <div className="flex items-center space-x-2">
              <XCircleIcon className="w-5 h-5 text-red-500" />
              <span><strong>{stats.cannotRepair}</strong> Tidak Bisa</span>
            </div>
          </div>
        </div>

        {/* NG Items List */}
        <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">Tidak ada item NG dalam periode ini</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map(item => (
                <div key={item.answer_id} className="hover:bg-gray-50">
                  {/* Summary Row */}
                  <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedItem(expandedItem === item.answer_id ? null : item.answer_id)}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex-shrink-0">
                        {expandedItem === item.answer_id ? (
                          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{item.item_name}</span>
                          <span className="text-xs text-gray-400">[{item.item_category}]</span>
                          {/* Priority Badge */}
                          {item.corrective_action?.priority && item.corrective_action.priority !== 'normal' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_CONFIG[item.corrective_action.priority]?.color || 'bg-gray-400 text-white'}`}>
                              {PRIORITY_CONFIG[item.corrective_action.priority]?.label || item.corrective_action.priority}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.machine_name} • {formatDate(item.tanggal)} • Shift {item.shift}
                        </div>
                        {item.catatan && (
                          <div className="text-sm text-red-600 mt-1">
                            Catatan Operator: {item.catatan}
                          </div>
                        )}
                        {/* Supervisor Note - Important highlight */}
                        {item.corrective_action?.supervisor_note && (
                          <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                            <div className="flex items-start space-x-2">
                              <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-amber-800">Catatan Supervisor:</span>
                                <span className="text-amber-700 ml-1">{item.corrective_action.supervisor_note}</span>
                                {item.corrective_action.supervisor_name && (
                                  <span className="text-gray-500 text-xs ml-2">- {item.corrective_action.supervisor_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Priority indicator for sorting visibility */}
                      {item.corrective_action?.priority === 'urgent' && (
                        <span className="animate-pulse text-red-600 text-xs font-bold">⚠</span>
                      )}
                      {getStatusBadge(item.corrective_action?.repair_status || 'pending')}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {expandedItem === item.answer_id && (
                    <div className="px-4 py-4 bg-gray-50 border-t">
                      <CorrectiveActionForm 
                        item={item} 
                        onSave={(data) => handleUpdateCorrectiveAction(item.answer_id, data)}
                        saving={saving}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CorrectiveActionFormProps {
  item: NGItem;
  onSave: (data: any) => void;
  saving: boolean;
}

const CorrectiveActionForm: React.FC<CorrectiveActionFormProps> = ({ item, onSave, saving }) => {
  const existing = item.corrective_action;
  const [status, setStatus] = useState(existing?.repair_status || 'pending');
  const [notes, setNotes] = useState(existing?.repair_notes || '');
  const [cannotRepairReason, setCannotRepairReason] = useState(existing?.reason_cannot_repair || '');
  const [deferredReason, setDeferredReason] = useState(existing?.deferred_reason || '');
  const [deferredUntil, setDeferredUntil] = useState(existing?.deferred_until || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      repair_status: status,
      repair_notes: notes,
      reason_cannot_repair: status === 'cannot_repair' ? cannotRepairReason : null,
      deferred_reason: status === 'deferred' ? deferredReason : null,
      deferred_until: status === 'deferred' ? deferredUntil : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status Perbaikan</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500">
            {REPAIR_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Conditional: Deferred Until */}
        {status === 'deferred' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ditunda Sampai</label>
            <input type="date" value={deferredUntil} onChange={e => setDeferredUntil(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Perbaikan</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          placeholder="Jelaskan tindakan perbaikan yang dilakukan..." />
      </div>

      {/* Cannot Repair Reason */}
      {status === 'cannot_repair' && (
        <div>
          <label className="block text-sm font-medium text-red-700 mb-1">Alasan Tidak Bisa Diperbaiki *</label>
          <textarea value={cannotRepairReason} onChange={e => setCannotRepairReason(e.target.value)} rows={2} required
            className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 bg-red-50"
            placeholder="Jelaskan alasan mengapa tidak bisa diperbaiki..." />
        </div>
      )}

      {/* Deferred Reason */}
      {status === 'deferred' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Ditunda *</label>
          <textarea value={deferredReason} onChange={e => setDeferredReason(e.target.value)} rows={2} required
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            placeholder="Jelaskan alasan mengapa ditunda..." />
        </div>
      )}

      {/* Info dari history */}
      {existing && (
        <div className="text-xs text-gray-500 space-y-1 bg-gray-100 p-2 rounded">
          {existing.started_at && <p>Mulai dikerjakan: {new Date(existing.started_at).toLocaleString('id-ID')}</p>}
          {existing.completed_at && <p>Selesai: {new Date(existing.completed_at).toLocaleString('id-ID')}</p>}
          {existing.handled_by_name && <p>Ditangani oleh: {existing.handled_by_name}</p>}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  );
};

export default ChecklistNGItems;
