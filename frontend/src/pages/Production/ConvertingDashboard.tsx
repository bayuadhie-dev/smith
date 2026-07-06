import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  CogIcon,
  PlusIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface ShiftData {
  id: number;
  shift: string;
  product_name: string;
  actual_quantity: number;
  good_quantity: number;
  reject_quantity: number;
  efficiency_rate: number;
  operator_name: string;
  specification?: string;
  njo?: string;
  notes?: string;
  loss_kg?: number;
  downtime_entries?: any[];
  machine_data?: any;
}

interface MachineData {
  id: number;
  code: string;
  name: string;
  machine_type: string;
  status: string;
  target_efficiency: number;
  shifts: ShiftData[];
  total_output: number;
  total_good: number;
  total_reject: number;
  avg_efficiency: number;
}

interface SummaryData {
  total_machines: number;
  active_machines: number;
  total_output: number;
  total_good: number;
  total_reject: number;
  quality_rate: number;
}

const ConvertingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  const [editingRecord, setEditingRecord] = useState<ShiftData | null>(null);
  const [editingMachine, setEditingMachine] = useState<MachineData | null>(null);
  const [editForm, setEditForm] = useState({
    product_name: '',
    specification: '',
    njo: '',
    operator_name: '',
    notes: '',
    grade_a: 0,
    grade_b: 0,
    loss_kg: 0,
    production_hour_minutes: 480,
    machine_speed: 0,
  });
  const [editDowntimeEntries, setEditDowntimeEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const DOWNTIME_CATEGORIES = {
    mesin: { label: 'Mesin', bgColor: 'bg-red-50/50', textColor: 'text-red-700', borderColor: 'border-red-200' },
    operator: { label: 'Operator', bgColor: 'bg-orange-50/50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
    material: { label: 'Material', bgColor: 'bg-blue-50/50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
    design: { label: 'Design', bgColor: 'bg-purple-50/50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
    idle: { label: 'Idle', bgColor: 'bg-yellow-50/50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
    others: { label: 'Lainnya', bgColor: 'bg-gray-50/50', textColor: 'text-gray-700', borderColor: 'border-gray-200' }
  };

  const detectCategory = (reason: string): string => {
    const text = reason.toLowerCase();
    const mesinKeywords = ['mesin', 'trouble', 'rusak', 'error', 'bocor', 'kabel', 'pompa', 'sparepart', 'part', 'pisau', 'ganti pisau', 'sensor', 'pneumatic', 'piston', 'rantai', 'gearbox', 'v-belt', 'belt', 'bearing', 'pemanas', 'heater', 'thermo', 'dinamo', 'motor', 'inverter', 'patah', 'selang', 'olil', 'grease', 'kebocoran', 'trip', 'pln', 'listrik mati', 'genset'];
    const operatorKeywords = ['human error', 'keluar jalur (sambungan)', 'kesalahan operator', 'kurang teliti', 'lupa', 'operator error', 'salah input', 'salah pasang', 'salah setting', 'salah ukur', 'sambungan', 'setting', 'telat', 'tidak fokus', 'kebingungan', 'lambat', 'training'];
    const materialKeywords = ['bahan baku', 'bahan cacat', 'bahan habis', 'bahan kurang', 'bahan rusak', 'benang habis', 'corak salah', 'defect', 'kain kusut', 'kain melipat', 'kain rusak', 'kain tipis', 'karton core', 'lem habis', 'material kurang', 'material lambat', 'material rusak', 'packing habis', 'plastik habis', 'rol peang', 'roll peang', 'stiker habis', 'tinta habis', 'tunggu kain', 'tunggu core', 'tunggu lem', 'tunggu plastik', 'tunggu stiker'];
    const designKeywords = ['corak', 'desain', 'design', 'ganti corak', 'ganti desain', 'ganti design', 'ganti gambar', 'ganti motif', 'ganti ukuran', 'motif', 'setting motif', 'setting ukuran', 'ukuran salah'];
    const idleKeywords = ['break', 'istirahat', 'makan', 'minum', 'shalat', 'sholat', 'solat', 'toilet', 'tunggu instruksi', 'tunggu SPK', 'belum ada order', 'order habis', 'tunggu jadwal', 'tunggu spv', 'tunggu supervisor', 'koordinasi', 'meeting', 'briefing', 'senam', 'bersih-bersih', '5S', 'clean up', 'pemeliharaan mandiri'];

    if (mesinKeywords.some(kw => text.includes(kw))) return 'mesin';
    if (operatorKeywords.some(kw => text.includes(kw))) return 'operator';
    if (materialKeywords.some(kw => text.includes(kw))) return 'material';
    if (designKeywords.some(kw => text.includes(kw))) return 'design';
    if (idleKeywords.some(kw => text.includes(kw))) return 'idle';
    return 'others';
  };

  const handleEditClick = (shift: ShiftData, machine: MachineData) => {
    setEditingRecord(shift);
    setEditingMachine(machine);
    const mdata = shift.machine_data || {};
    setEditForm({
      product_name: shift.product_name || '',
      specification: shift.specification || '',
      njo: shift.njo || '',
      operator_name: shift.operator_name || '',
      notes: shift.notes || '',
      grade_a: shift.good_quantity || 0,
      grade_b: shift.reject_quantity || 0,
      loss_kg: shift.loss_kg || 0,
      production_hour_minutes: mdata.production_hour_minutes || 480,
      machine_speed: mdata.machine_speed || 0,
    });
    
    const dtEntries = (mdata.downtime_entries || []).map((e: any, idx: number) => ({
      id: e.id || idx + Date.now(),
      reason: e.reason || '',
      duration_minutes: e.duration_minutes || 0,
      frequency: e.frequency || 1,
      category: e.category || 'others'
    }));
    setEditDowntimeEntries(dtEntries);
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data produksi ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await axiosInstance.delete(`/api/converting/production/${id}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting production record:', error);
      alert('Gagal menghapus data produksi. Silakan coba lagi.');
    }
  };

  const addEditDowntime = () => {
    setEditDowntimeEntries(prev => [
      ...prev,
      { id: Date.now(), reason: '', duration_minutes: 0, frequency: 1, category: 'others' }
    ]);
  };

  const removeEditDowntime = (id: number) => {
    setEditDowntimeEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEditDowntime = (id: number, field: string, val: any) => {
    setEditDowntimeEntries(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: val };
        if (field === 'reason') {
          updated.category = detectCategory(val);
        }
        return updated;
      }
      return e;
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSaving(true);
    try {
      const totalDowntimeMin = editDowntimeEntries.reduce(
        (sum, item) => sum + (Number(item.duration_minutes || 0) * Number(item.frequency || 1)), 
        0
      );

      const payload = {
        production_date: date,
        shift: editingRecord.shift,
        machine_id: editingMachine?.id,
        good_quantity: Number(editForm.grade_a || 0),
        reject_quantity: Number(editForm.grade_b || 0),
        loss_kg: Number(editForm.loss_kg || 0),
        operator_name: editForm.operator_name,
        product_name: editForm.product_name,
        specification: editForm.specification,
        njo: editForm.njo,
        notes: editForm.notes,
        planned_runtime: Number(editForm.production_hour_minutes || 0),
        machine_speed: Number(editForm.machine_speed || 0),
        downtime_minutes: totalDowntimeMin,
        downtime_entries: editDowntimeEntries.map(e => ({
          reason: e.reason,
          duration_minutes: Number(e.duration_minutes || 0),
          frequency: Number(e.frequency || 1),
          category: e.category
        }))
      };

      await axiosInstance.put(`/api/converting/production/${editingRecord.id}`, payload);
      setEditingRecord(null);
      setEditingMachine(null);
      fetchData();
    } catch (error) {
      console.error('Error saving production edits:', error);
      alert('Gagal menyimpan perubahan. Silakan periksa kembali input Anda.');
    } finally {
      setSaving(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/converting/dashboard?date=${date}`);
      setMachines(res.data.machines || []);
      setSummary(res.data.summary || null);
    } catch (error) {
      console.error('Error fetching converting dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const getEfficiencyColor = (eff: number, target: number) => {
    if (eff >= target) return 'text-green-600 bg-green-100';
    if (eff >= target * 0.8) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getMachineTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      perforating: 'Perforating',
      slitting: 'Slitting',
      laminasi: 'Laminasi Kain',
      bagmaker: 'Bagmaker',
      folding: 'Folding',
      cutting: 'Cutting',
    };
    return labels[type] || type;
  };

  const getMachineTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      perforating: 'bg-blue-100 text-blue-800',
      slitting: 'bg-purple-100 text-purple-800',
      laminasi: 'bg-orange-100 text-orange-800',
      bagmaker: 'bg-green-100 text-green-800',
      folding: 'bg-pink-100 text-pink-800',
      cutting: 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Group machines by type
  const machinesByType = machines.reduce((acc, m) => {
    if (!acc[m.machine_type]) acc[m.machine_type] = [];
    acc[m.machine_type].push(m);
    return acc;
  }, {} as Record<string, MachineData[]>);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Converting Dashboard</h1>
          <p className="text-slate-500">Monitor produksi mesin converting</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/production/converting/input')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            Input Produksi
          </button>
          <button
            onClick={fetchData}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-slate-50 border"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => changeDate(-1)} className="p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-slate-50 border">
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-gray-800 border rounded-lg font-medium"
        />
        <button onClick={() => changeDate(1)} className="p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-slate-50 border">
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Mesin</p>
            <p className="text-2xl font-bold text-slate-800">{summary.total_machines}</p>
            <p className="text-xs text-green-600">{summary.active_machines} aktif</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Output</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total_output.toLocaleString()}</p>
            <p className="text-xs text-slate-500">pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Grade A</p>
            <p className="text-2xl font-bold text-green-600">{summary.total_good.toLocaleString()}</p>
            <p className="text-xs text-slate-500">pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Reject</p>
            <p className="text-2xl font-bold text-red-600">{summary.total_reject.toLocaleString()}</p>
            <p className="text-xs text-slate-500">pcs</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Quality Rate</p>
            <p className={`text-2xl font-bold ${summary.quality_rate >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
              {summary.quality_rate}%
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Machines by Type */}
      {!loading && Object.entries(machinesByType).map(([type, typeMachines]) => (
        <div key={type} className="mb-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm ${getMachineTypeColor(type)}`}>
              {getMachineTypeLabel(type)}
            </span>
            <span className="text-slate-400">({typeMachines.length} mesin)</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typeMachines.map((machine) => (
              <div key={machine.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                {/* Machine Header */}
                <div className="p-4 border-b bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CogIcon className="h-6 w-6 text-slate-600" />
                      <div>
                        <h3 className="font-semibold text-slate-800">{machine.name}</h3>
                        <p className="text-xs text-slate-500">{machine.code}</p>
                      </div>
                    </div>
                    {machine.shifts.length > 0 ? (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEfficiencyColor(machine.avg_efficiency, machine.target_efficiency)}`}>
                        {machine.avg_efficiency}%
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-500">
                        No Data
                      </span>
                    )}
                  </div>
                </div>

                {/* Shifts */}
                <div className="p-4">
                  {machine.shifts.length > 0 ? (
                    <div className="space-y-3">
                      {machine.shifts.map((shift) => (
                        <div key={shift.id} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-slate-50/50 group/row px-1 rounded transition-colors">
                          <div>
                            <p className="font-medium text-slate-700">
                              {typeof shift.shift === 'string' 
                                ? shift.shift.replace('_', ' ').toUpperCase() 
                                : `SHIFT ${shift.shift}`}
                            </p>
                            <p className="text-xs text-slate-500">{shift.product_name}</p>
                            {shift.operator_name && (
                              <p className="text-xs text-slate-400">Op: {shift.operator_name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-slate-800">{shift.good_quantity.toLocaleString()}</p>
                              <p className={`text-xs ${shift.efficiency_rate >= machine.target_efficiency ? 'text-green-600' : 'text-yellow-600'}`}>
                                Eff: {shift.efficiency_rate}%
                              </p>
                            </div>
                            
                            {/* Hover Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditClick(shift, machine)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit data produksi"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(shift.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Hapus data produksi"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Machine Total */}
                      <div className="pt-2 mt-2 border-t border-dashed">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Total Output:</span>
                          <span className="font-bold text-slate-800">{machine.total_output.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Grade A:</span>
                          <span className="font-bold text-green-600">{machine.total_good.toLocaleString()}</span>
                        </div>
                        {machine.total_reject > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Reject:</span>
                            <span className="font-bold text-red-600">{machine.total_reject.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400">
                      <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
                      <p>Belum ada data produksi</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {!loading && machines.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <CogIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Belum ada mesin converting</h3>
          <p className="text-slate-500 mb-4">Klik tombol di bawah untuk menambahkan mesin default</p>
          <button
            onClick={async () => {
              try {
                await axiosInstance.post('/api/converting/machines/seed');
                fetchData();
              } catch (error) {
                console.error('Error seeding machines:', error);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Seed 12 Mesin Converting
          </button>
        </div>
      )}
      {/* Edit Modal Popup */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-gray-700 flex justify-between items-center bg-slate-50 dark:bg-gray-900 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Data Produksi Converting</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mesin: <span className="font-semibold">{editingMachine?.name}</span> ({editingMachine?.code}) | Shift {editingRecord.shift}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setEditingMachine(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama Produk</label>
                  <input
                    type="text"
                    value={editForm.product_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, product_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">NJO</label>
                  <input
                    type="text"
                    value={editForm.njo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, njo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Spesifikasi</label>
                  <input
                    type="text"
                    value={editForm.specification}
                    onChange={(e) => setEditForm(prev => ({ ...prev, specification: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Operator</label>
                  <input
                    type="text"
                    value={editForm.operator_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, operator_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Grade A (Good)</label>
                  <input
                    type="number"
                    value={editForm.grade_a || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, grade_a: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Grade B/C (Reject)</label>
                  <input
                    type="number"
                    value={editForm.grade_b || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, grade_b: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Loss (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.loss_kg || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, loss_kg: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Production Hour (menit)</label>
                  <input
                    type="number"
                    value={editForm.production_hour_minutes || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, production_hour_minutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Speed Mesin</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.machine_speed || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, machine_speed: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Catatan</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={2}
                />
              </div>

              {/* Downtime Entries Table */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-slate-500" />
                    <h4 className="font-semibold text-slate-800 text-sm">Downtime Entries</h4>
                  </div>
                  <button
                    type="button"
                    onClick={addEditDowntime}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Tambah Downtime
                  </button>
                </div>

                {editDowntimeEntries.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <ClockIcon className="h-6 w-6 mx-auto text-slate-400 mb-1.5" />
                    <p className="text-slate-500 text-xs">Tidak ada downtime</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editDowntimeEntries.map((entry, index) => {
                      const catConfig = DOWNTIME_CATEGORIES[entry.category as keyof typeof DOWNTIME_CATEGORIES] || DOWNTIME_CATEGORIES.others;
                      return (
                        <div key={entry.id} className={`p-3 rounded-lg border flex items-center gap-3 ${catConfig.bgColor} ${catConfig.borderColor}`}>
                          <span className="text-xs font-semibold text-slate-400 w-5 text-center">{index + 1}</span>
                          
                          <div className="flex-1">
                            <input
                              type="text"
                              value={entry.reason}
                              onChange={(e) => updateEditDowntime(entry.id, 'reason', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                              placeholder="Alasan downtime..."
                              required
                            />
                          </div>

                          <div className="w-24">
                            <input
                              type="number"
                              value={entry.duration_minutes || ''}
                              onChange={(e) => updateEditDowntime(entry.id, 'duration_minutes', Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-center bg-white"
                              placeholder="Durasi (mnt)"
                              min="1"
                              required
                            />
                          </div>

                          <div className="w-16">
                            <input
                              type="number"
                              value={entry.frequency || ''}
                              onChange={(e) => updateEditDowntime(entry.id, 'frequency', Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-center bg-white"
                              placeholder="Freq"
                              min="1"
                            />
                          </div>

                          <div className="w-24 text-center">
                            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider">
                              {catConfig.label}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeEditDowntime(entry.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    <div className="text-right text-xs font-semibold text-slate-600 pt-2 pr-2">
                      Total Downtime: {editDowntimeEntries.reduce((sum, e) => sum + (Number(e.duration_minutes || 0) * Number(e.frequency || 1)), 0)} menit
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setEditingMachine(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConvertingDashboard;
