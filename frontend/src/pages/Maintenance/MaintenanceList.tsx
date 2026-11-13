import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../components/ui';
import { Search, Eye, Pencil, Trash2, Play, CheckCircle2 } from 'lucide-react';
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

interface MaintenanceRecord {
  id: number;
  record_number: string;
  machine_id: number;
  machine_name: string;
  maintenance_type: string;
  maintenance_date: string;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  duration_hours?: number;
  status: string;
  priority?: string;
  problem_description?: string;
  work_performed?: string;
  cost: number;
  performed_by?: number;
  performed_by_name?: string;
  notes?: string;
}

// Tipe yang wajib isi root cause sebelum bisa ditandai selesai (2026-09-28)
// - harus sama persis dengan ROOT_CAUSE_REQUIRED_TYPES di backend/routes/maintenance.py
const ROOT_CAUSE_REQUIRED_TYPES = ['corrective', 'breakdown', 'emergency'];

const ROOT_CAUSE_CATEGORIES = [
  { value: 'mechanical', label: 'Mekanikal' },
  { value: 'electrical', label: 'Elektrikal' },
  { value: 'operator_error', label: 'Kesalahan Operator' },
  { value: 'material', label: 'Material/Bahan' },
  { value: 'preventive_lapse', label: 'Preventive Terlewat' },
  { value: 'other', label: 'Lainnya' },
];

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Terjadwal', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Dibatalkan',
};
const TYPE_LABEL: Record<string, string> = {
  preventive: 'Preventif', corrective: 'Korektif', predictive: 'Prediktif', breakdown: 'Kerusakan',
  emergency: 'Darurat', inspection: 'Inspeksi', calibration: 'Kalibrasi', overhaul: 'Overhaul',
};
const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  in_progress: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  scheduled: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const COLUMNS: ListColumn<MaintenanceRecord>[] = [
  { key: 'record_number', label: 'No. SPK', value: (r) => r.record_number },
  { key: 'machine_name', label: 'Mesin', value: (r) => r.machine_name },
  { key: 'maintenance_type', label: 'Jenis', value: (r) => r.maintenance_type, exportValue: (r) => TYPE_LABEL[r.maintenance_type] || r.maintenance_type },
  { key: 'maintenance_date', label: 'Tanggal', value: (r) => r.maintenance_date, type: 'date' },
  { key: 'scheduled_date', label: 'Tanggal Jadwal', value: (r) => r.scheduled_date, type: 'date' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS_LABEL[r.status] || r.status },
  { key: 'priority', label: 'Prioritas', value: (r) => r.priority },
  { key: 'duration_hours', label: 'Durasi (jam)', value: (r) => r.duration_hours, type: 'number' },
  { key: 'problem_description', label: 'Masalah', value: (r) => r.problem_description },
  { key: 'work_performed', label: 'Pekerjaan', value: (r) => r.work_performed },
  { key: 'performed_by_name', label: 'Dikerjakan Oleh', value: (r) => r.performed_by_name },
  { key: 'cost', label: 'Biaya', value: (r) => r.cost, type: 'number' },
];

const MaintenanceList: React.FC = () => {
    const navigate = useNavigate();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [rootCauseForm, setRootCauseForm] = useState({ root_cause_category: '', root_cause: '' });
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/maintenance/records');
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Error fetching maintenance records:', error);
      toast.error('Catatan perawatan gagal dimuat');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (recordId: number, newStatus: string) => {
    try {
      await api.patch(`/api/maintenance/records/${recordId}`, { status: newStatus });
      toast.success(`Status diubah menjadi ${STATUS_LABEL[newStatus] || newStatus}`);
      fetchRecords();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Status gagal diubah');
    }
  };

  // "Mark Complete" (2026-09-28): tipe yang benar-benar ada kerusakan wajib
  // isi root cause dulu - backend akan menolak (400) tanpa itu, jadi
  // tangkap di sini dengan modal singkat daripada biarkan user coba-coba
  // klik dan dapat error yang tidak jelas asalnya.
  const handleMarkComplete = (record: MaintenanceRecord) => {
    if (ROOT_CAUSE_REQUIRED_TYPES.includes(record.maintenance_type)) {
      setCompletingRecord(record);
      setRootCauseForm({ root_cause_category: '', root_cause: '' });
    } else {
      handleStatusChange(record.id, 'completed');
    }
  };

  const submitCompleteWithRootCause = async () => {
    if (!completingRecord) return;
    if (!rootCauseForm.root_cause.trim()) {
      toast.error('Penyebab dasar wajib diisi');
      return;
    }
    setSubmittingComplete(true);
    try {
      await api.patch(`/api/maintenance/records/${completingRecord.id}`, {
        status: 'completed',
        root_cause: rootCauseForm.root_cause,
        root_cause_category: rootCauseForm.root_cause_category || undefined,
      });
      toast.success('Maintenance selesai dicatat');
      setCompletingRecord(null);
      fetchRecords();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal menyelesaikan maintenance');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const handleDelete = async (recordId: number) => {
    if (!(await confirmDialog('Hapus catatan perawatan ini?'))) return;
    
    try {
      await api.delete(`/api/maintenance/records/${recordId}`);
      toast.success('Catatan perawatan dihapus');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Catatan gagal dihapus');
    }
  };

  // Filter records
  const filterBase = records.filter(record => (statusFilter === 'all' || record.status === statusFilter) && (typeFilter === 'all' || record.maintenance_type === typeFilter));
  const tools = useListTools<MaintenanceRecord>(filterBase, COLUMNS, { filename: 'Catatan_Perawatan', initialSort: { key: 'maintenance_date', dir: 'desc' } });
  const filteredRecords = tools.rows;
  useEffect(() => { setCurrentPage(1); }, [tools.query, tools.sortKey, tools.sortDir]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique maintenance types for filter
  const maintenanceTypes = [...new Set(records.map(r => r.maintenance_type))];

  const stats = {
    total: records.length,
    scheduled: records.filter(r => r.status === 'scheduled').length,
    running: records.filter(r => r.status === 'in_progress').length,
    cost: records.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.cost || 0), 0),
  };
  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400';

  if (loading) {
    return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Memuat catatan perawatan...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Catatan Perawatan"
        subtitle="SPK perawatan mesin: terjadwal, berjalan, dan selesai"
        actions={
          <Link to="/app/maintenance/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
            SPK perawatan baru
          </Link>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total catatan', value: stats.total.toLocaleString('id-ID') },
          { label: 'Terjadwal', value: stats.scheduled.toLocaleString('id-ID') },
          { label: 'Sedang berjalan', value: stats.running.toLocaleString('id-ID'), tone: stats.running > 0 ? 'warn' : null },
          { label: 'Biaya perawatan selesai', value: `Rp ${stats.cost.toLocaleString('id-ID')}` },
        ]}
      />

      <ListToolbar tools={tools} placeholder="Cari nomor SPK, mesin, atau jenis" extra={
        <>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className={`${inputCls}`}>
          <option value="all">Semua status</option>
          <option value="scheduled">Terjadwal</option>
          <option value="in_progress">Berjalan</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }} className={`${inputCls}`}>
          <option value="all">Semua jenis</option>
          {maintenanceTypes.map(type => (
            <option key={type} value={type}>{TYPE_LABEL[type] || type}</option>
          ))}
        </select>
        </>
      } />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortTh tools={tools} col="record_number" className={th}>No. SPK</SortTh>
              <SortTh tools={tools} col="machine_name" className={th}>Mesin</SortTh>
              <SortTh tools={tools} col="maintenance_type" className={th}>Jenis</SortTh>
              <SortTh tools={tools} col="maintenance_date" className={th}>Tanggal</SortTh>
              <SortTh tools={tools} col="status" className={th}>Status</SortTh>
              <SortTh tools={tools} col="cost" align="right" className={`${th} text-right`}>Biaya</SortTh>
              <th className={`${th} text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {paginatedRecords.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                  <Link to={`/app/maintenance/${record.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{record.record_number}</Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{record.machine_name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{TYPE_LABEL[record.maintenance_type] || record.maintenance_type.replace('_', ' ')}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{new Date(record.maintenance_date).toLocaleDateString('id-ID')}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[record.status] || STATUS_BADGE.cancelled}`}>
                    {STATUS_LABEL[record.status] || record.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">Rp {record.cost.toLocaleString('id-ID')}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/app/maintenance/${record.id}`} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white" title="Lihat detail"><Eye className="h-4 w-4" /></Link>
                    <Link to={`/app/maintenance/${record.id}/edit`} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white" title="Ubah"><Pencil className="h-4 w-4" /></Link>
                    {record.status === 'scheduled' && (
                      <button onClick={() => handleStatusChange(record.id, 'in_progress')} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-700 dark:hover:bg-gray-700" title="Mulai pekerjaan"><Play className="h-4 w-4" /></button>
                    )}
                    {record.status === 'in_progress' && (
                      <button onClick={() => handleMarkComplete(record)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-700 dark:hover:bg-gray-700" title="Tandai selesai"><CheckCircle2 className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => handleDelete(record.id)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {paginatedRecords.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  {records.length === 0 ? 'Belum ada catatan perawatan.' : 'Tidak ada catatan yang cocok dengan filter.'}
                  {records.length === 0 && (
                    <div className="mt-2"><Link to="/app/maintenance/new" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Buat SPK perawatan pertama</Link></div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRecords.length)} dari {filteredRecords.length} catatan</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Sebelumnya</button>
            <span>Halaman {currentPage} dari {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Berikutnya</button>
          </div>
        </div>
      )}

      {completingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md">
            <Panel title={`Selesaikan ${completingRecord.record_number}`}>
              <div className="space-y-4 p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Penyebab dasar wajib diisi untuk jenis "{TYPE_LABEL[completingRecord.maintenance_type] || completingRecord.maintenance_type}".
                </p>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Kategori penyebab</label>
                  <select
                    value={rootCauseForm.root_cause_category}
                    onChange={(e) => setRootCauseForm(prev => ({ ...prev, root_cause_category: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Pilih kategori (opsional)</option>
                    {ROOT_CAUSE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Penyebab dasar *</label>
                  <textarea
                    value={rootCauseForm.root_cause}
                    onChange={(e) => setRootCauseForm(prev => ({ ...prev, root_cause: e.target.value }))}
                    rows={3}
                    placeholder="Penyebab dasar kerusakan, bukan sekadar gejala"
                    className={inputCls}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setCompletingRecord(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Batal</button>
                  <button onClick={submitCompleteWithRootCause} disabled={submittingComplete} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                    {submittingComplete ? 'Menyimpan...' : 'Tandai selesai'}
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceList;
