import React, { useState, useEffect } from 'react';
import { Clock, Plus, Pencil, Trash2, Users, Loader2, X } from 'lucide-react';
import axiosInstance from '../../utils/axiosConfig';

interface WorkSchedule {
  id: number;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
  is_active: boolean;
  employee_count: number;
}

interface EmployeeOption {
  id: number;
  full_name: string;
  work_schedule_id?: number | null;
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const emptyForm = {
  name: '', days_of_week: [0, 1, 2, 3, 4] as number[],
  start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 30, is_active: true,
};

const WorkScheduleManagement: React.FC = () => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Assign modal
  const [assigningSchedule, setAssigningSchedule] = useState<WorkSchedule | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/attendance/work-schedules');
      setSchedules(res.data.work_schedules || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchedules(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (s: WorkSchedule) => {
    setEditingId(s.id);
    setForm({
      name: s.name, days_of_week: s.days_of_week,
      start_time: s.start_time, end_time: s.end_time,
      late_tolerance_minutes: s.late_tolerance_minutes, is_active: s.is_active,
    });
    setFormError('');
    setShowForm(true);
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.name.trim()) { setFormError('Nama wajib diisi'); return; }
    if (form.days_of_week.length === 0) { setFormError('Pilih minimal 1 hari kerja'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await axiosInstance.put(`/api/attendance/work-schedules/${editingId}`, form);
      } else {
        await axiosInstance.post('/api/attendance/work-schedules', form);
      }
      setShowForm(false);
      fetchSchedules();
    } catch (e: any) {
      setFormError(e?.response?.data?.error || 'Gagal menyimpan jadwal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: WorkSchedule) => {
    if (!confirm(`Hapus jadwal "${s.name}"?`)) return;
    try {
      await axiosInstance.delete(`/api/attendance/work-schedules/${s.id}`);
      fetchSchedules();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Gagal menghapus jadwal');
    }
  };

  const openAssign = async (s: WorkSchedule) => {
    setAssigningSchedule(s);
    setSelectedEmployeeIds([]);
    try {
      const res = await axiosInstance.get('/api/hr/employees', { params: { per_page: 1000 } });
      setEmployees(res.data.employees || res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssign = async () => {
    if (!assigningSchedule || selectedEmployeeIds.length === 0) return;
    setAssigning(true);
    try {
      await axiosInstance.post(`/api/attendance/work-schedules/${assigningSchedule.id}/assign`, {
        employee_ids: selectedEmployeeIds,
      });
      setAssigningSchedule(null);
      fetchSchedules();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Gagal menugaskan jadwal');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="h-6 w-6" />
          Jadwal Kerja Staff Kantor
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus className="h-4 w-4" /> Tambah Jadwal
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Terpisah dari Roster (jadwal operator produksi, bergilir harian) - ini untuk staff kantor
        yang jam kerjanya tetap setiap hari kerja. Menentukan kapan clock-in dianggap "terlambat".
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Belum ada jadwal kerja. Karyawan tanpa jadwal memakai setting global.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hari Kerja</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jam</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toleransi Terlambat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {schedules.map(s => (
                <tr key={s.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {s.name} {!s.is_active && <span className="text-xs text-gray-400">(nonaktif)</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {s.days_of_week.map(d => DAY_LABELS[d]).join(', ')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.start_time} - {s.end_time}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.late_tolerance_minutes} menit</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <button onClick={() => openAssign(s)} className="flex items-center gap-1 text-blue-600 hover:underline">
                      <Users className="h-4 w-4" /> {s.employee_count} karyawan
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(s)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Tambah'} Jadwal Kerja</h3>
            {formError && <div className="mb-3 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{formError}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Kantor Reguler Senin-Jumat"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Hari Kerja</label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`px-2 py-1 text-xs rounded ${form.days_of_week.includes(idx) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Jam Mulai</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Jam Selesai</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Toleransi Terlambat (menit)</label>
                <input
                  type="number" value={form.late_tolerance_minutes}
                  onChange={e => setForm(p => ({ ...p, late_tolerance_minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-200">Aktif</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Batal</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:bg-gray-400 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Employees Modal */}
      {assigningSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Tugaskan ke "{assigningSchedule.name}"</h3>
              <button onClick={() => setAssigningSchedule(null)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-1">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEmployeeIds.includes(emp.id)}
                    onChange={e => setSelectedEmployeeIds(prev => e.target.checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id))}
                    className="rounded"
                  />
                  {emp.full_name}
                  {emp.work_schedule_id === assigningSchedule.id && <span className="text-xs text-gray-400">(sudah di jadwal ini)</span>}
                </label>
              ))}
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button onClick={() => setAssigningSchedule(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Batal</button>
              <button
                onClick={handleAssign}
                disabled={assigning || selectedEmployeeIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:bg-gray-400 flex items-center gap-2"
              >
                {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
                Tugaskan ({selectedEmployeeIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkScheduleManagement;
