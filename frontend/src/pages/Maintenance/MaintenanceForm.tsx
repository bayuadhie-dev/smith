import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader, Panel } from '../../components/ui/PageKit';
import NumberInput from '../../components/ui/NumberInput'

interface Machine {
  id: number;
  name: string;
  code: string;
  status: string;
}

interface Employee {
  id: number;
  full_name: string;
  employee_id: string;
  department?: string;
}

interface MaintenanceTask {
  id?: number;
  task_name: string;
  description: string;
  estimated_time_hours: number;
  status: string;
}

interface MaintenancePart {
  id?: number;
  part_name: string;
  quantity: number;
  unit_cost: number;
  supplier: string;
}

interface FormData {
  machine_id: number | '';
  maintenance_type: string;
  scheduled_date: string;
  estimated_duration_hours: number;
  priority: string;
  description: string;
  assigned_to: number | '';
  preventive_schedule: string;
  cost_estimate: number;
  safety_requirements: string;
  notes: string;
  tasks: MaintenanceTask[];
  required_parts: MaintenancePart[];
}

const MaintenanceForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    machine_id: '',
    maintenance_type: 'preventive',
    scheduled_date: new Date().toISOString().split('T')[0],
    estimated_duration_hours: 1,
    priority: 'medium',
    description: '',
    assigned_to: '',
    preventive_schedule: '',
    cost_estimate: 0,
    safety_requirements: '',
    notes: '',
    tasks: [],
    required_parts: []
  });

  const maintenanceTypes = [
    { value: 'preventive', label: 'Preventif (terjadwal)' },
    { value: 'corrective', label: 'Korektif (perbaikan)' },
    { value: 'predictive', label: 'Prediktif' },
    { value: 'breakdown', label: 'Perbaikan kerusakan' },
    { value: 'inspection', label: 'Inspeksi' },
    { value: 'calibration', label: 'Kalibrasi' },
    { value: 'overhaul', label: 'Overhaul' }
  ];

  const priorities = [
    { value: 'low', label: 'Rendah', color: 'text-green-600' },
    { value: 'medium', label: 'Sedang', color: 'text-yellow-600' },
    { value: 'high', label: 'Tinggi', color: 'text-orange-600' },
    { value: 'critical', label: 'Kritis', color: 'text-red-600' }
  ];

  useEffect(() => {
    fetchMachines();
    fetchEmployees();
    if (isEdit) {
      fetchRecord();
    }
  }, [id]);

  const fetchMachines = async () => {
    try {
      const response = await api.get('/api/production/machines');
      setMachines(response.data.machines || response.data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/hr/employees');
      setEmployees(response.data.employees || response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchRecord = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/maintenance/records/${id}`);
      const record = response.data.record;
      setFormData({
        machine_id: record.machine_id,
        maintenance_type: record.maintenance_type,
        scheduled_date: record.scheduled_date?.split('T')[0] || record.maintenance_date?.split('T')[0] || '',
        estimated_duration_hours: record.estimated_duration_hours || 1,
        priority: record.priority || 'medium',
        description: record.problem_description || record.description || '',
        assigned_to: record.assigned_to || record.performed_by || '',
        preventive_schedule: record.preventive_schedule || '',
        cost_estimate: record.cost_estimate || record.cost || 0,
        safety_requirements: record.safety_requirements || '',
        notes: record.notes || '',
        tasks: record.tasks || [],
        required_parts: record.required_parts || []
      });
    } catch (error) {
      console.error('Error fetching record:', error);
      toast.error('Failed to load maintenance record');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  // Task management
  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { task_name: '', description: '', estimated_time_hours: 0.5, status: 'pending' }]
    }));
  };

  const updateTask = (index: number, field: keyof MaintenanceTask, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => i === index ? { ...task, [field]: value } : task)
    }));
  };

  const removeTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  // Parts management
  const addPart = () => {
    setFormData(prev => ({
      ...prev,
      required_parts: [...prev.required_parts, { part_name: '', quantity: 1, unit_cost: 0, supplier: '' }]
    }));
  };

  const updatePart = (index: number, field: keyof MaintenancePart, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.map((part, i) => i === index ? { ...part, [field]: value } : part)
    }));
  };

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.machine_id) {
      toast.error('Pilih mesin dulu');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        machine_id: Number(formData.machine_id),
        maintenance_date: formData.scheduled_date, // Sync with backend
        performed_by: formData.assigned_to ? Number(formData.assigned_to) : null, // Sync with backend
        cost: formData.cost_estimate, // Sync with backend
        problem_description: formData.description // Sync with backend
      };

      if (isEdit) {
        await api.patch(`/api/maintenance/records/${id}`, payload);
        toast.success('Catatan perawatan diperbarui');
      } else {
        await api.post('/api/maintenance/maintenance', payload);
        toast.success('SPK perawatan dibuat');
      }
      navigate('/app/maintenance/records');
    } catch (error: any) {
      console.error('Error saving maintenance:', error);
      toast.error(error.response?.data?.error || 'Catatan perawatan gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200';
  const partsTotal = formData.required_parts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_cost) || 0), 0);
  const tasksHours = formData.tasks.reduce((sum, tk) => sum + (Number(tk.estimated_time_hours) || 0), 0);
  const typeLabel = maintenanceTypes.find(x => x.value === formData.maintenance_type)?.label || formData.maintenance_type;
  const priorityLabel = priorities.find(x => x.value === formData.priority)?.label || formData.priority;
  const machineLabel = machines.find(m => m.id === Number(formData.machine_id));

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Memuat data...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={isEdit ? 'Ubah SPK Perawatan' : 'SPK Perawatan Baru'}
        subtitle={isEdit ? 'Perbarui rincian pekerjaan perawatan' : 'Jadwalkan pekerjaan perawatan mesin'}
        actions={<Link to="/app/maintenance/records" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Kembali ke daftar</Link>}
      />

      <form onSubmit={handleSubmit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Panel title="Data pekerjaan">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Mesin <span className="text-red-500">*</span></label>
                <select name="machine_id" value={formData.machine_id} onChange={handleChange} required className={inputCls}>
                  <option value="">Pilih mesin</option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>{machine.code} - {machine.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Jenis perawatan <span className="text-red-500">*</span></label>
                <select name="maintenance_type" value={formData.maintenance_type} onChange={handleChange} required className={inputCls}>
                  {maintenanceTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tanggal rencana <span className="text-red-500">*</span></label>
                <input type="date" name="scheduled_date" value={formData.scheduled_date} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estimasi durasi (jam)</label>
                <NumberInput name="estimated_duration_hours" value={formData.estimated_duration_hours} onChange={handleNumberChange} min="0.5" step="0.5" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Prioritas</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className={inputCls}>
                  {priorities.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Teknisi</label>
                <select name="assigned_to" value={formData.assigned_to} onChange={handleChange} className={inputCls}>
                  <option value="">Pilih teknisi</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employee_id} - {emp.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Perkiraan biaya (Rp)</label>
                <NumberInput currency name="cost_estimate" value={formData.cost_estimate} onChange={handleNumberChange} min="0" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Deskripsi atau masalah</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Jelaskan pekerjaan atau masalah yang ditemukan" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Persyaratan keselamatan</label>
                <textarea name="safety_requirements" value={formData.safety_requirements} onChange={handleChange} rows={2} placeholder="Tindakan pengamanan atau APD yang diperlukan" className={inputCls} />
              </div>
            </div>
          </Panel>

          <Panel
            title="Langkah pekerjaan"
            action={<button type="button" onClick={addTask} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"><Plus className="h-3.5 w-3.5" /> Tambah langkah</button>}
          >
            {formData.tasks.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada langkah. Pilih "Tambah langkah" untuk merinci pekerjaan.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {formData.tasks.map((task, index) => (
                  <div key={index} className="grid grid-cols-12 items-center gap-2 p-3">
                    <span className="col-span-12 text-xs font-medium text-gray-500 md:col-span-1">#{index + 1}</span>
                    <input type="text" placeholder="Nama langkah" value={task.task_name} onChange={(e) => updateTask(index, 'task_name', e.target.value)} className={`${inputCls} col-span-12 md:col-span-4`} />
                    <input type="text" placeholder="Keterangan" value={task.description} onChange={(e) => updateTask(index, 'description', e.target.value)} className={`${inputCls} col-span-8 md:col-span-4`} />
                    <NumberInput placeholder="Jam" value={task.estimated_time_hours} onChange={(e) => updateTask(index, 'estimated_time_hours', parseFloat(e.target.value) || 0)} min="0" step="0.5" className={`${inputCls} col-span-3 text-right md:col-span-2`} />
                    <button type="button" onClick={() => removeTask(index)} className="col-span-1 text-gray-400 hover:text-red-600" title="Hapus langkah"><Trash2 className="mx-auto h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Sparepart yang dibutuhkan"
            action={<button type="button" onClick={addPart} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"><Plus className="h-3.5 w-3.5" /> Tambah sparepart</button>}
          >
            {formData.required_parts.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada sparepart. Pilih "Tambah sparepart" untuk mencatat kebutuhannya.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {formData.required_parts.map((part, index) => (
                  <div key={index} className="grid grid-cols-12 items-center gap-2 p-3">
                    <input type="text" placeholder="Nama sparepart" value={part.part_name} onChange={(e) => updatePart(index, 'part_name', e.target.value)} className={`${inputCls} col-span-12 md:col-span-4`} />
                    <NumberInput placeholder="Jumlah" value={part.quantity} onChange={(e) => updatePart(index, 'quantity', parseInt(e.target.value) || 0)} min="1" className={`${inputCls} col-span-4 text-right md:col-span-2`} />
                    <NumberInput currency placeholder="Harga satuan" value={part.unit_cost} onChange={(e) => updatePart(index, 'unit_cost', parseFloat(e.target.value) || 0)} min="0" className={`${inputCls} col-span-8 text-right md:col-span-2`} />
                    <input type="text" placeholder="Pemasok" value={part.supplier} onChange={(e) => updatePart(index, 'supplier', e.target.value)} className={`${inputCls} col-span-11 md:col-span-3`} />
                    <button type="button" onClick={() => removePart(index)} className="col-span-1 text-gray-400 hover:text-red-600" title="Hapus sparepart"><Trash2 className="mx-auto h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Catatan tambahan">
            <div className="p-4">
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} placeholder="Catatan atau instruksi tambahan" className={inputCls} />
            </div>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-4">
          <Panel title="Ringkasan">
            <dl className="space-y-3 p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Mesin</dt><dd className="truncate text-right font-medium">{machineLabel ? `${machineLabel.code} ${machineLabel.name}` : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Jenis</dt><dd className="text-right font-medium">{typeLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Prioritas</dt><dd className="font-medium">{priorityLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Tanggal</dt><dd className="font-medium">{formData.scheduled_date || '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Langkah</dt><dd className="font-medium">{formData.tasks.length}{tasksHours > 0 ? ` (${tasksHours} jam)` : ''}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Nilai sparepart</dt><dd className="font-medium tabular-nums">Rp {partsTotal.toLocaleString('id-ID')}</dd></div>
            </dl>
            <div className="space-y-2 border-t border-gray-200 p-4 dark:border-gray-700">
              {!formData.machine_id && <p className="text-sm text-amber-700 dark:text-amber-400">Pilih mesin dulu.</p>}
              <button type="submit" disabled={saving} className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Buat SPK'}
              </button>
              <Link to="/app/maintenance/records" className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">Batal</Link>
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  );
};

export default MaintenanceForm;
