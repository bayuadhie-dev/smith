import { useState } from 'react';
import { BriefcaseIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  useGetJobPositionsQuery,
  useCreateJobPositionMutation,
  useUpdateJobPositionMutation,
  useDeleteJobPositionMutation,
  useGetDepartmentsQuery,
  useGetEmployeesQuery,
} from '../../services/api';

export default function PositionManagement() {
  const { data, refetch } = useGetJobPositionsQuery(undefined);
  const { data: departmentsData } = useGetDepartmentsQuery({});
  const { data: employeesData } = useGetEmployeesQuery({ per_page: 2000 });
  const [createPosition] = useCreateJobPositionMutation();
  const [updatePosition] = useUpdateJobPositionMutation();
  const [deletePosition] = useDeleteJobPositionMutation();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [drillDown, setDrillDown] = useState<any>(null);
  const [form, setForm] = useState({ title: '', department_id: '', grade: '' });

  const positions: any[] = data?.positions || [];
  const departments: any[] = departmentsData?.departments || [];
  const employees: any[] = employeesData?.employees || [];

  const employeesInPosition = (positionId: number) => employees.filter((e) => e.position_id === positionId);

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', department_id: '', grade: '' });
    setShowModal(true);
  };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ title: p.title, department_id: p.department_id ? String(p.department_id) : '', grade: p.grade || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { title: form.title, department_id: form.department_id ? Number(form.department_id) : null, grade: form.grade || null };
    try {
      if (editing) {
        await updatePosition({ id: editing.id, ...payload }).unwrap();
        toast.success('Jabatan diupdate');
      } else {
        await createPosition(payload).unwrap();
        toast.success('Jabatan ditambahkan');
      }
      setShowModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.error || 'Gagal menyimpan jabatan');
    }
  };

  const handleDelete = async (p: any) => {
    if (!confirm(`Hapus jabatan ${p.title}?`)) return;
    try {
      await deletePosition(p.id).unwrap();
      toast.success('Jabatan dihapus');
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.error || 'Gagal menghapus jabatan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Master Data Jabatan</h1>
          <p className="text-gray-600 dark:text-gray-300">Entitas Position asli (SAP HCM) - dipakai sebagai pilihan &quot;Jabatan (Terstruktur)&quot; di form karyawan.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <PlusIcon className="h-5 w-5" /> Tambah Jabatan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Belum ada jabatan terdaftar.</p>
          </div>
        ) : (
          positions.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BriefcaseIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{p.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{p.department_name || 'Semua departemen'}{p.grade ? ` — ${p.grade}` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                </div>
              </div>
              <button
                onClick={() => setDrillDown(p)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {employeesInPosition(p.id).length} karyawan &rarr;
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Jabatan' : 'Tambah Jabatan'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama Jabatan</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full border rounded-lg px-3 py-2" placeholder="Contoh: Supervisor Produksi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Departemen</label>
                <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Semua departemen</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Grade/Level</label>
                <input type="text" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Contoh: Staff, Supervisor, Manager" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {drillDown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{drillDown.title}</h3>
              <button onClick={() => setDrillDown(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            {employeesInPosition(drillDown.id).length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada karyawan dengan jabatan ini.</p>
            ) : (
              <div className="space-y-1">
                {employeesInPosition(drillDown.id).map((e: any) => (
                  <div key={e.id} className="text-sm px-3 py-1.5 border rounded flex justify-between">
                    <span>{e.full_name}</span>
                    <span className="text-gray-400">{e.department}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
