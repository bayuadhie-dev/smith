import { useState, useEffect } from 'react';
import { MapPinIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';

interface FunctionalLocation {
  id: number;
  code: string;
  name: string;
  location_type: string | null;
  parent_location_id: number | null;
  parent_location_name: string | null;
}

export default function FunctionalLocations() {
  const [locations, setLocations] = useState<FunctionalLocation[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FunctionalLocation | null>(null);
  const [drillDown, setDrillDown] = useState<FunctionalLocation | null>(null);
  const [form, setForm] = useState({ code: '', name: '', location_type: '', parent_location_id: '' });

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get('/api/assets/functional-locations');
      setLocations(res.data.functional_locations || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await axiosInstance.get('/api/assets', { params: { per_page: 2000 } });
      setAssets(res.data.assets || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchAssets();
  }, []);

  const childLocations = (id: number) => locations.filter((l) => l.parent_location_id === id);
  const topLevelLocations = locations.filter((l) => !l.parent_location_id);
  const assetsAtLocation = (id: number) => assets.filter((a) => a.functional_location_id === id);

  const openAdd = (parentId?: number) => {
    setEditing(null);
    setForm({ code: '', name: '', location_type: '', parent_location_id: parentId ? String(parentId) : '' });
    setShowModal(true);
  };
  const openEdit = (l: FunctionalLocation) => {
    setEditing(l);
    setForm({ code: l.code, name: l.name, location_type: l.location_type || '', parent_location_id: l.parent_location_id ? String(l.parent_location_id) : '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code, name: form.name,
      location_type: form.location_type || null,
      parent_location_id: form.parent_location_id ? Number(form.parent_location_id) : null,
    };
    try {
      if (editing) {
        await axiosInstance.put(`/api/assets/functional-locations/${editing.id}`, payload);
        toast.success('Functional location diupdate');
      } else {
        await axiosInstance.post('/api/assets/functional-locations', payload);
        toast.success('Functional location ditambahkan');
      }
      setShowModal(false);
      fetchLocations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  };

  const handleDelete = async (l: FunctionalLocation) => {
    if (!confirm(`Hapus lokasi ${l.name}?`)) return;
    try {
      await axiosInstance.delete(`/api/assets/functional-locations/${l.id}`);
      toast.success('Dihapus');
      fetchLocations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  };

  const renderNode = (loc: FunctionalLocation, depth: number) => (
    <div key={loc.id}>
      <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700" style={{ paddingLeft: depth * 24 }}>
        <button onClick={() => setDrillDown(loc)} className="flex items-center gap-2 text-left hover:text-blue-600">
          <MapPinIcon className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{loc.name}</span>
          <span className="text-xs text-gray-400">{loc.code}{loc.location_type ? ` — ${loc.location_type}` : ''}</span>
          <span className="text-xs text-blue-600">({assetsAtLocation(loc.id).length} aset) &rarr;</span>
        </button>
        <div className="flex gap-1">
          <button onClick={() => openAdd(loc.id)} className="p-1 text-gray-400 hover:text-green-600" title="Tambah sub-lokasi"><PlusIcon className="h-4 w-4" /></button>
          <button onClick={() => openEdit(loc)} className="p-1 text-gray-400 hover:text-blue-600"><PencilIcon className="h-4 w-4" /></button>
          <button onClick={() => handleDelete(loc)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
        </div>
      </div>
      {childLocations(loc.id).map((child) => renderNode(child, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Functional Location</h1>
          <p className="text-gray-600 dark:text-gray-300">Hierarki Plant &rarr; Building &rarr; Line untuk penempatan aset/mesin.</p>
        </div>
        <button onClick={() => openAdd()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <PlusIcon className="h-5 w-5" /> Tambah Lokasi
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        {isLoading ? (
          <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
        ) : topLevelLocations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Belum ada functional location terdaftar.</div>
        ) : (
          topLevelLocations.map((loc) => renderNode(loc, 0))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Lokasi' : 'Tambah Lokasi'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Kode</label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required className="w-full border rounded-lg px-3 py-2" placeholder="Contoh: PLANT-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded-lg px-3 py-2" placeholder="Contoh: Pabrik 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tipe</label>
                <input type="text" value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="plant / building / line" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Induk Lokasi</label>
                <select value={form.parent_location_id} onChange={(e) => setForm({ ...form, parent_location_id: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Tidak ada (top-level)</option>
                  {locations.filter((l) => l.id !== editing?.id).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
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
              <div>
                <h3 className="text-lg font-semibold">{drillDown.name}</h3>
                <p className="text-sm text-gray-500">{drillDown.code}</p>
              </div>
              <button onClick={() => setDrillDown(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Aset di lokasi ini ({assetsAtLocation(drillDown.id).length})</h4>
            {assetsAtLocation(drillDown.id).length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada aset ditempatkan di sini.</p>
            ) : (
              <div className="space-y-1">
                {assetsAtLocation(drillDown.id).map((a) => (
                  <div key={a.id} className="text-sm px-3 py-1.5 border rounded flex justify-between">
                    <span>{a.asset_name}</span>
                    <span className="text-gray-400">{a.asset_code}</span>
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
