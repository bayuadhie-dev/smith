import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NumberInput from '../../components/ui/NumberInput'
import { PageHeader, Panel } from '../../components/ui/PageKit'
interface Machine {
  id: number;
  name: string;
  code: string;
  status: string;
}

interface MaintenanceRequestData {
  machine_id: number;
  maintenance_type: string;
  priority: string;
  scheduled_date: string;
  estimated_duration_hours: number;
  description: string;
  assigned_to: string;
  cost_estimate: number;
  safety_requirements: string;
  notes: string;
  tasks: MaintenanceTask[];
  required_parts: RequiredPart[];
}

interface MaintenanceTask {
  task_name: string;
  description: string;
  estimated_time_hours: number;
  required_parts: string;
  status: string;
}

interface RequiredPart {
  part_name: string;
  quantity: number;
  unit_cost: number;
  supplier: string;
  availability_status: string;
}

const MaintenanceRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<MaintenanceRequestData>({
    machine_id: 0,
    maintenance_type: 'preventive',
    priority: 'medium',
    scheduled_date: new Date().toISOString().split('T')[0],
    estimated_duration_hours: 4,
    description: '',
    assigned_to: '',
    cost_estimate: 0,
    safety_requirements: '',
    notes: '',
    tasks: [],
    required_parts: []
  });

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const maintenanceTypes = [
    'preventive',
    'corrective',
    'emergency',
    'predictive',
    'condition_based'
  ];

  const priorities = [
    'low',
    'medium',
    'high',
    'critical'
  ];

  const taskStatuses = [
    'pending',
    'in_progress',
    'completed',
    'cancelled'
  ];

  const availabilityStatuses = [
    'available',
    'ordered',
    'backordered',
    'discontinued'
  ];

  useEffect(() => {
    fetchMachines();
    if (isEdit) {
      fetchMaintenanceRequest();
    }
  }, [id]);

  const fetchMachines = async () => {
    try {
      const response = await fetch('/api/production/machines?status=active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMachines(data.machines || []);
      }
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    }
  };

  const fetchMaintenanceRequest = async () => {
    try {
      const response = await fetch(`/api/maintenance/records/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          machine_id: data.machine_id,
          maintenance_type: data.maintenance_type,
          priority: data.priority || 'medium',
          scheduled_date: data.scheduled_date ? data.scheduled_date.split('T')[0] : '',
          estimated_duration_hours: data.estimated_duration_hours || 4,
          description: data.description || '',
          assigned_to: data.assigned_to || '',
          cost_estimate: data.cost_estimate || 0,
          safety_requirements: data.safety_requirements || '',
          notes: data.notes || '',
          tasks: data.tasks || [],
          required_parts: data.required_parts || []
        });
      }
    } catch (error) {
      console.error('Failed to fetch maintenance request:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.machine_id === 0) {
      setError('Pilih mesin terlebih dahulu');
      setLoading(false);
      return;
    }

    if (!formData.description.trim()) {
      setError('Deskripsi wajib diisi');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit 
        ? `/api/maintenance/records/${id}` 
        : '/api/maintenance/maintenance';
      
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        navigate('/app/maintenance/records');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Gagal menyimpan permintaan perawatan');
      }
    } catch (error) {
      setError('Terjadi gangguan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' 
        ? (value === '' ? 0 : Number(value))
        : value
    }));
  };

  const addTask = () => {
    const newTask: MaintenanceTask = {
      task_name: '',
      description: '',
      estimated_time_hours: 1,
      required_parts: '',
      status: 'pending'
    };

    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));
  };

  const removeTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  const updateTask = (index: number, field: keyof MaintenanceTask, value: any) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const addPart = () => {
    const newPart: RequiredPart = {
      part_name: '',
      quantity: 1,
      unit_cost: 0,
      supplier: '',
      availability_status: 'available'
    };

    setFormData(prev => ({
      ...prev,
      required_parts: [...prev.required_parts, newPart]
    }));
  };

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.filter((_, i) => i !== index)
    }));
  };

  const updatePart = (index: number, field: keyof RequiredPart, value: any) => {
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.map((part, i) => 
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTotalEstimatedCost = () => {
    const partsCost = formData.required_parts.reduce((total, part) => 
      total + (part.quantity * part.unit_cost), 0
    );
    return formData.cost_estimate + partsCost;
  };

  const typeLabels: Record<string, string> = {
    preventive: 'Preventif',
    corrective: 'Korektif',
    emergency: 'Darurat',
    predictive: 'Prediktif',
    condition_based: 'Berdasarkan kondisi'
  };
  const priorityLabels: Record<string, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis' };
  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200';
  const machine = machines.find(m => m.id === Number(formData.machine_id));
  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={isEdit ? 'Ubah Permintaan Perawatan' : 'Permintaan Perawatan Baru'}
        subtitle={isEdit ? 'Perbarui rincian permintaan perawatan' : 'Jadwalkan pekerjaan perawatan mesin'}
        actions={
          <button type="button" onClick={() => navigate('/app/maintenance/records')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
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
                <label className={labelCls}>Mesin *</label>
                <select name="machine_id" value={formData.machine_id} onChange={handleInputChange} required className={inputCls}>
                  <option value="">Pilih mesin</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Jenis perawatan *</label>
                <select name="maintenance_type" value={formData.maintenance_type} onChange={handleInputChange} required className={inputCls}>
                  {maintenanceTypes.map(type => (
                    <option key={type} value={type}>{typeLabels[type] || type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prioritas *</label>
                <select name="priority" value={formData.priority} onChange={handleInputChange} required className={inputCls}>
                  {priorities.map(priority => (
                    <option key={priority} value={priority}>{priorityLabels[priority] || priority}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Penanggung jawab</label>
                <input type="text" name="assigned_to" value={formData.assigned_to} onChange={handleInputChange} placeholder="Nama teknisi" className={inputCls} />
              </div>
            </div>
          </Panel>

          <Panel title="Jadwal">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Tanggal pelaksanaan *</label>
                <input type="date" name="scheduled_date" value={formData.scheduled_date} onChange={handleInputChange} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estimasi durasi (jam)</label>
                <NumberInput name="estimated_duration_hours" value={formData.estimated_duration_hours} onChange={handleInputChange} min="0.5" step="0.5" className={inputCls} />
              </div>
            </div>
          </Panel>

          <Panel title="Uraian pekerjaan">
            <div className="space-y-4 p-4">
              <div>
                <label className={labelCls}>Deskripsi *</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} required rows={3} placeholder="Jelaskan pekerjaan perawatan yang akan dilakukan" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Persyaratan keselamatan</label>
                <textarea name="safety_requirements" value={formData.safety_requirements} onChange={handleInputChange} rows={2} placeholder="Tuliskan langkah dan syarat keselamatan kerja" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Catatan tambahan</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Informasi lain yang perlu dicatat" className={inputCls} />
              </div>
            </div>
          </Panel>

          <Panel title="Estimasi biaya">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Estimasi biaya tenaga kerja</label>
                <NumberInput currency name="cost_estimate" value={formData.cost_estimate} onChange={handleInputChange} min="0" step="1000" placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Total estimasi biaya</label>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium tabular-nums text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                  {rp(getTotalEstimatedCost())}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-4">
          <Panel title="Ringkasan">
            <dl className="space-y-3 p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Mesin</dt><dd className="truncate text-right font-medium">{machine ? `${machine.code} ${machine.name}` : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Jenis</dt><dd className="font-medium">{typeLabels[formData.maintenance_type] || formData.maintenance_type}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Prioritas</dt>
                <dd><span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${getPriorityColor(formData.priority)}`}>{priorityLabels[formData.priority] || formData.priority}</span></dd>
              </div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Tanggal</dt><dd className="font-medium">{formData.scheduled_date || '-'}</dd></div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Total estimasi biaya</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{rp(getTotalEstimatedCost())}</dd>
              </div>
            </dl>
            <div className="border-t border-gray-200 p-4 dark:border-gray-700">
              <button type="submit" disabled={loading} className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                {loading ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Buat permintaan'}
              </button>
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  );
};

export default MaintenanceRequestForm;
