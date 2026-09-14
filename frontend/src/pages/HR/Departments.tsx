import { useState, useEffect } from 'react';
import {
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';

interface Department {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  employee_count?: number;
  parent_department_id?: number | null;
  parent_department_name?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
}

export default function Departments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState<{ code: string; name: string; description: string; parent_department_id: string; manager_id: string }>({ code: '', name: '', description: '', parent_department_id: '', manager_id: '' });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [drillDownDept, setDrillDownDept] = useState<Department | null>(null);

  const fetchEmployees = async () => {
    try {
      const response = await axiosInstance.get('/api/hr/employees', { params: { per_page: 2000 } });
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/api/hr/departments');
      setDepartments(response.data.departments || response.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingDept(null);
    setFormData({ code: '', name: '', description: '', parent_department_id: '', manager_id: '' });
    setShowModal(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      code: dept.code, name: dept.name, description: dept.description || '',
      parent_department_id: dept.parent_department_id ? String(dept.parent_department_id) : '',
      manager_id: dept.manager_id ? String(dept.manager_id) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: formData.code,
      name: formData.name,
      description: formData.description,
      parent_department_id: formData.parent_department_id ? Number(formData.parent_department_id) : null,
      manager_id: formData.manager_id ? Number(formData.manager_id) : null,
    };
    try {
      if (editingDept) {
        await axiosInstance.put(`/api/hr/departments/${editingDept.id}`, payload);
        toast.success('Departemen berhasil diupdate');
      } else {
        await axiosInstance.post('/api/hr/departments', payload);
        toast.success('Departemen berhasil ditambahkan');
      }
      setShowModal(false);
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan departemen');
    }
  };

  const departmentEmployees = (deptId: number) => employees.filter((e) => e.department_id === deptId || (e.department && departments.find((d) => d.id === deptId)?.name === e.department));
  const childDepartments = (deptId: number) => departments.filter((d) => d.parent_department_id === deptId);

  const handleDelete = async (dept: Department) => {
    if (!confirm(`Hapus departemen ${dept.name}?`)) return;
    try {
      await axiosInstance.delete(`/api/hr/departments/${dept.id}`);
      toast.success('Departemen berhasil dihapus');
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghapus departemen');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Departemen</h1>
          <p className="text-gray-600 dark:text-gray-300">Kelola data departemen perusahaan</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Tambah Departemen
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari departemen..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Memuat data...</p>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Tidak ada departemen ditemukan</p>
          </div>
        ) : (
          filteredDepartments.map(dept => (
            <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{dept.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{dept.code}</p>
                    {dept.parent_department_name && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">di bawah {dept.parent_department_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(dept)}
                    className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {dept.description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{dept.description}</p>
              )}
              {dept.manager_name && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Manager: <span className="font-medium">{dept.manager_name}</span></p>
              )}
              {childDepartments(dept.id).length > 0 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{childDepartments(dept.id).length} sub-departemen</p>
              )}
              <button
                onClick={() => setDrillDownDept(dept)}
                className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <UserGroupIcon className="h-4 w-4" />
                <span>{dept.employee_count || 0} karyawan &rarr;</span>
              </button>
              <span className={`mt-2 inline-block px-2 py-1 text-xs rounded-full ${
                dept.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {dept.is_active ? 'Aktif' : 'Non-aktif'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingDept ? 'Edit Departemen' : 'Tambah Departemen'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Kode</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Contoh: HRD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama Departemen</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Contoh: Human Resources Department"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Deskripsi departemen (opsional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Induk Departemen (Org Unit)</label>
                <select
                  value={formData.parent_department_id}
                  onChange={(e) => setFormData({ ...formData, parent_department_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Tidak ada (top-level)</option>
                  {departments.filter((d) => d.id !== editingDept?.id).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Manager Departemen</label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Belum ditentukan</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Dipakai sebagai approver pertama untuk cuti/reimbursement karyawan di departemen ini.</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drill-down: employees + sub-departments in this department */}
      {drillDownDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{drillDownDept.name}</h3>
                <p className="text-sm text-gray-500">{drillDownDept.code}{drillDownDept.manager_name && ` — Manager: ${drillDownDept.manager_name}`}</p>
              </div>
              <button onClick={() => setDrillDownDept(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>

            {childDepartments(drillDownDept.id).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Sub-departemen</h4>
                <div className="space-y-1">
                  {childDepartments(drillDownDept.id).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDrillDownDept(d)}
                      className="w-full text-left text-sm px-3 py-1.5 border rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {d.name} <span className="text-gray-400">({d.employee_count || 0} karyawan)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Karyawan ({departmentEmployees(drillDownDept.id).length})</h4>
            {departmentEmployees(drillDownDept.id).length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada karyawan di departemen ini.</p>
            ) : (
              <div className="space-y-1">
                {departmentEmployees(drillDownDept.id).map((e) => (
                  <div key={e.id} className="text-sm px-3 py-1.5 border rounded flex justify-between">
                    <span>{e.full_name}</span>
                    <span className="text-gray-400">{e.position}</span>
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
