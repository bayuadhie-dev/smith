import React, { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { showError } from '../../components/ui';
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit';

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
  urgent: { label: 'Mendesak', color: 'bg-red-600 text-white', sortOrder: 1 },
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

const filterCls = 'rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';

const ChecklistNGItems: React.FC = () => {
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
      showError('Gagal menyimpan');
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
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Item NG Checklist"
        subtitle="Item yang perlu diperbaiki dari Pre-Shift Checklist"
        actions={
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Muat ulang
          </button>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total NG', value: stats.total },
          { label: 'Menunggu', value: stats.pending, tone: stats.pending > 0 ? 'warn' : null },
          { label: 'Dikerjakan', value: stats.inProgress },
          { label: 'Selesai', value: stats.completed, tone: stats.completed > 0 ? 'good' : null },
          { label: 'Tidak bisa diperbaiki', value: stats.cannotRepair, tone: stats.cannotRepair > 0 ? 'bad' : null },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={filterCls} />
        <span className="text-gray-400">-</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={filterCls} />
        <select value={filterMachine} onChange={e => setFilterMachine(e.target.value ? Number(e.target.value) : '')} className={filterCls}>
          <option value="">Semua mesin</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={filterCls}>
          <option value="">Semua status</option>
          {REPAIR_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Panel title="Daftar item NG">
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Tidak ada item NG dalam periode ini.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(item => (
              <div key={item.answer_id}>
                <div
                  className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  onClick={() => setExpandedItem(expandedItem === item.answer_id ? null : item.answer_id)}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {expandedItem === item.answer_id ? (
                      <ChevronUpIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{item.item_name}</span>
                        <span className="text-xs text-gray-400">{item.item_category}</span>
                        {item.corrective_action?.priority && item.corrective_action.priority !== 'normal' && (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_CONFIG[item.corrective_action.priority]?.color || 'bg-gray-400 text-white'}`}>
                            {PRIORITY_CONFIG[item.corrective_action.priority]?.label || item.corrective_action.priority}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.machine_name} · {formatDate(item.tanggal)} · Shift {item.shift}
                      </div>
                      {item.catatan && (
                        <div className="mt-1 text-sm text-red-600 dark:text-red-400">Catatan operator: {item.catatan}</div>
                      )}
                      {item.corrective_action?.supervisor_note && (
                        <div className="mt-1.5 rounded border-l-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-sm dark:bg-amber-900/20">
                          <span className="font-medium text-amber-800 dark:text-amber-300">Catatan supervisor:</span>
                          <span className="ml-1 text-amber-700 dark:text-amber-200">{item.corrective_action.supervisor_note}</span>
                          {item.corrective_action.supervisor_name && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">- {item.corrective_action.supervisor_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">{getStatusBadge(item.corrective_action?.repair_status || 'pending')}</div>
                </div>

                {expandedItem === item.answer_id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
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
      </Panel>
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status Perbaikan</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            {REPAIR_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Conditional: Deferred Until */}
        {status === 'deferred' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Ditunda Sampai</label>
            <input type="date" value={deferredUntil} onChange={e => setDeferredUntil(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Catatan Perbaikan</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Alasan Ditunda *</label>
          <textarea value={deferredReason} onChange={e => setDeferredReason(e.target.value)} rows={2} required
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="Jelaskan alasan mengapa ditunda..." />
        </div>
      )}

      {/* Info dari history */}
      {existing && (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
          {existing.started_at && <p>Mulai dikerjakan: {new Date(existing.started_at).toLocaleString('id-ID')}</p>}
          {existing.completed_at && <p>Selesai: {new Date(existing.completed_at).toLocaleString('id-ID')}</p>}
          {existing.handled_by_name && <p>Ditangani oleh: {existing.handled_by_name}</p>}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-medium transition disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  );
};

export default ChecklistNGItems;
