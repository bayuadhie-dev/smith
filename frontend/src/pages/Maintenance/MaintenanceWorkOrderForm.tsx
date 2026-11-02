import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { XMarkIcon as X } from '@heroicons/react/24/outline';
import NumberInput from '../../components/ui/NumberInput'
import { PageHeader, Panel } from '../../components/ui/PageKit'
interface WorkOrderFormData {
  work_order_number: string;
  title: string;
  description: string;
  machine_id: number;
  maintenance_type: string;
  priority: string;
  assigned_to: number;
  scheduled_date: string;
  estimated_hours: number;
  estimated_cost: number;
  status: string;
  parts_required: WorkOrderPart[];
  tasks: WorkOrderTask[];
  notes: string;
}

interface WorkOrderPart {
  id?: number;
  part_name: string;
  quantity: number;
  unit_cost: number;
  supplier: string;
}

interface WorkOrderTask {
  id?: number;
  task_description: string;
  estimated_time: number;
  is_completed: boolean;
  assigned_technician: string;
}

const MaintenanceWorkOrderForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<WorkOrderFormData>({
    work_order_number: '',
    title: '',
    description: '',
    machine_id: 0,
    maintenance_type: 'preventive',
    priority: 'medium',
    assigned_to: 0,
    scheduled_date: new Date().toISOString().split('T')[0],
    estimated_hours: 0,
    estimated_cost: 0,
    status: 'pending',
    parts_required: [],
    tasks: [],
    notes: ''
  });

  const [machines, setMachines] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const maintenanceTypes = [
    { value: 'preventive', label: 'Preventive Maintenance' },
    { value: 'corrective', label: 'Corrective Maintenance' },
    { value: 'emergency', label: 'Emergency Repair' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'calibration', label: 'Calibration' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' }
  ];

  const statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  useEffect(() => {
    fetchMachines();
    fetchTechnicians();
    if (isEdit && id) {
      fetchWorkOrder();
    }
  }, [id]);

  const fetchMachines = async () => {
    try {
      const response = await fetch('/api/production/machines', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMachines(data.machines || []);
      }
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await fetch('/api/hr/employees?department=maintenance', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTechnicians(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch technicians:', error);
    }
  };

  const fetchWorkOrder = async () => {
    try {
      const response = await fetch(`/api/maintenance/work-orders/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFormData(data.work_order);
      }
    } catch (error) {
      console.error('Failed to fetch SPK:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEdit ? `/api/maintenance/records/${id}` : '/api/maintenance/maintenance';
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        maintenance_date: formData.scheduled_date,
        performed_by: formData.assigned_to,
        cost: formData.estimated_cost,
        problem_description: formData.description
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        navigate('/app/maintenance/work-orders');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Gagal menyimpan SPK');
      }
    } catch (error) {
      setError('Terjadi gangguan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const addPart = () => {
    setFormData(prev => ({
      ...prev,
      parts_required: [...prev.parts_required, {
        part_name: '',
        quantity: 1,
        unit_cost: 0,
        supplier: ''
      }]
    }));
  };

  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, {
        task_description: '',
        estimated_time: 0,
        is_completed: false,
        assigned_technician: ''
      }]
    }));
  };

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parts_required: prev.parts_required.filter((_, i) => i !== index)
    }));
  };

  const removeTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  const updatePart = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parts_required: prev.parts_required.map((part, i) => 
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  const updateTask = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const calculateTotalCost = () => {
    const partsCost = formData.parts_required.reduce((sum, part) => 
      sum + (part.quantity * part.unit_cost), 0
    );
    return partsCost + formData.estimated_cost;
  };

  const priorityLabelId: Record<string, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis' };
  const typeLabelId: Record<string, string> = {
    preventive: 'Perawatan preventif', corrective: 'Perawatan korektif', emergency: 'Perbaikan darurat',
    inspection: 'Inspeksi', calibration: 'Kalibrasi'
  };
  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200';
  const rp = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;
  const parts = formData.parts_required || [];
  const tasks = formData.tasks || [];
  const partsCost = parts.reduce((sum, part) => sum + (part.quantity * part.unit_cost), 0);
  const machine = machines.find(m => m.id === formData.machine_id);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={isEdit ? 'Ubah SPK Perawatan' : 'SPK Perawatan Baru'}
        subtitle="Kelola SPK perawatan beserta sparepart dan tugasnya"
        actions={
          <button type="button" onClick={() => navigate('/app/maintenance/work-orders')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
            Batal
          </button>
        }
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Panel title="Data umum">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>No. SPK</label>
                <input type="text" value={formData.work_order_number} onChange={(e) => setFormData(prev => ({ ...prev, work_order_number: e.target.value }))} placeholder="Otomatis jika dikosongkan" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Prioritas *</label>
                <select value={formData.priority} onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))} required className={inputCls}>
                  {priorities.map(priority => (
                    <option key={priority.value} value={priority.value}>{priorityLabelId[priority.value] || priority.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Judul *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required placeholder="Ringkasan singkat SPK" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Deskripsi *</label>
                <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} required rows={3} placeholder="Uraian pekerjaan perawatan yang diperlukan" className={inputCls} />
              </div>
            </div>
          </Panel>

          <Panel title="Mesin dan penanggung jawab">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Mesin *</label>
                <select value={formData.machine_id} onChange={(e) => setFormData(prev => ({ ...prev, machine_id: parseInt(e.target.value) }))} required className={inputCls}>
                  <option value="">Pilih mesin</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.name} - {m.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Jenis perawatan *</label>
                <select value={formData.maintenance_type} onChange={(e) => setFormData(prev => ({ ...prev, maintenance_type: e.target.value }))} required className={inputCls}>
                  {maintenanceTypes.map(type => (
                    <option key={type.value} value={type.value}>{typeLabelId[type.value] || type.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Teknisi penanggung jawab *</label>
                <select value={formData.assigned_to} onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: parseInt(e.target.value) }))} required className={inputCls}>
                  <option value="">Pilih teknisi</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.full_name} - {tech.position}</option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>

          <Panel title="Jadwal dan biaya">
            <div className="grid gap-4 p-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>Tanggal pelaksanaan *</label>
                <input type="date" value={formData.scheduled_date} onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estimasi jam</label>
                <NumberInput value={formData.estimated_hours} onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: parseFloat(e.target.value) || 0 }))} min="0" step="0.5" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estimasi biaya tenaga kerja</label>
                <NumberInput currency value={formData.estimated_cost} onChange={(e) => setFormData(prev => ({ ...prev, estimated_cost: parseFloat(e.target.value) || 0 }))} min="0" className={inputCls} />
              </div>
            </div>
          </Panel>

          <Panel
            title="Sparepart dibutuhkan"
            action={<button type="button" onClick={addPart} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">+ Tambah sparepart</button>}
          >
            {parts.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada sparepart.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {parts.map((part, index) => (
                  <div key={index} className="grid gap-3 p-4 md:grid-cols-[1.5fr_0.7fr_1fr_1fr_auto]">
                    <div>
                      <label className={labelCls}>Nama sparepart</label>
                      <input type="text" value={part.part_name} onChange={(e) => updatePart(index, 'part_name', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Jumlah</label>
                      <NumberInput value={part.quantity} onChange={(e) => updatePart(index, 'quantity', parseInt(e.target.value) || 0)} min="1" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Harga satuan</label>
                      <NumberInput currency value={part.unit_cost} onChange={(e) => updatePart(index, 'unit_cost', parseFloat(e.target.value) || 0)} min="0" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Pemasok</label>
                      <input type="text" value={part.supplier} onChange={(e) => updatePart(index, 'supplier', e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={() => removePart(index)} className="rounded-md px-2 py-2 text-sm text-gray-400 hover:text-red-600" title="Hapus baris">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Tugas"
            action={<button type="button" onClick={addTask} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">+ Tambah tugas</button>}
          >
            {tasks.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada tugas.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {tasks.map((task, index) => (
                  <div key={index} className="grid gap-3 p-4 md:grid-cols-[2fr_1fr_auto]">
                    <div>
                      <label className={labelCls}>Uraian tugas</label>
                      <input type="text" value={task.task_description} onChange={(e) => updateTask(index, 'task_description', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Estimasi waktu (jam)</label>
                      <NumberInput value={task.estimated_time} onChange={(e) => updateTask(index, 'estimated_time', parseFloat(e.target.value) || 0)} min="0" step="0.5" className={inputCls} />
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={() => removeTask(index)} className="rounded-md px-2 py-2 text-sm text-gray-400 hover:text-red-600" title="Hapus baris">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Catatan tambahan">
            <div className="p-4">
              <textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} placeholder="Catatan atau instruksi khusus" className={inputCls} />
            </div>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-4">
          <Panel title="Ringkasan">
            <dl className="space-y-3 p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Mesin</dt><dd className="truncate text-right font-medium">{machine ? `${machine.code} ${machine.name}` : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Prioritas</dt><dd className="font-medium">{priorityLabelId[formData.priority] || formData.priority}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Tanggal</dt><dd className="font-medium">{formData.scheduled_date || '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Biaya tenaga kerja</dt><dd className="font-medium tabular-nums">{rp(formData.estimated_cost)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Biaya sparepart</dt><dd className="font-medium tabular-nums">{rp(partsCost)}</dd></div>
              <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
                <dt className="text-xs text-gray-500 dark:text-gray-400">Total biaya</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{rp(calculateTotalCost())}</dd>
              </div>
            </dl>
            <div className="border-t border-gray-200 p-4 dark:border-gray-700">
              <button type="submit" disabled={loading} className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                {loading ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Buat SPK'}
              </button>
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  );
};

export default MaintenanceWorkOrderForm;
