import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useGetProductsQuery } from '../../services/api';
import {
  useGetProductionRecipesQuery,
  useCreateProductionRecipeMutation,
  useUpdateProductionRecipeMutation,
  useDeleteProductionRecipeMutation,
} from '../../services/api';
import { useGetMachinesQuery } from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';

const emptyForm = { product_id: '', machine_id: '', batch_size: '', rate_per_hour: '', is_default: false };

export default function MasterDataRecipeTab() {
  const { data: recipesData, isLoading, refetch } = useGetProductionRecipesQuery({ active_only: true });
  const { data: productsData } = useGetProductsQuery(undefined);
  const { data: machinesData } = useGetMachinesQuery(undefined);
  const [createRecipe, { isLoading: creating }] = useCreateProductionRecipeMutation();
  const [updateRecipe] = useUpdateProductionRecipeMutation();
  const [deleteRecipe] = useDeleteProductionRecipeMutation();

  const [form, setForm] = useState<any>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const recipes: any[] = recipesData?.recipes || [];
  const products: any[] = productsData?.products || productsData || [];
  const machines: any[] = machinesData?.machines || machinesData || [];

  const filtered = recipes.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.product_name || '').toLowerCase().includes(s) || (r.product_code || '').toLowerCase().includes(s) || (r.machine_name || '').toLowerCase().includes(s);
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      product_id: String(r.product_id),
      machine_id: String(r.machine_id),
      batch_size: String(r.batch_size),
      rate_per_hour: String(r.rate_per_hour),
      is_default: r.is_default,
    });
  };

  const handleSave = async () => {
    if (!form.product_id || !form.machine_id || !form.batch_size || !form.rate_per_hour) {
      toast.error('Produk, mesin, kapasitas batch, dan rate/jam wajib diisi');
      return;
    }
    const payload = {
      product_id: Number(form.product_id),
      machine_id: Number(form.machine_id),
      batch_size: Number(form.batch_size),
      rate_per_hour: Number(form.rate_per_hour),
      is_default: !!form.is_default,
    };
    try {
      if (editingId) {
        await updateRecipe({ id: editingId, ...payload }).unwrap();
        toast.success('Resep diperbarui');
      } else {
        await createRecipe(payload).unwrap();
        toast.success('Resep dibuat');
      }
      resetForm();
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.message || e?.data?.error || 'Gagal menyimpan resep');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Nonaktifkan resep ini?')) return;
    try {
      await deleteRecipe(id).unwrap();
      toast.success('Resep dinonaktifkan');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.message || e?.data?.error || 'Gagal menghapus resep');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Resep produksi (produk + mesin) menentukan kapasitas satu batch fisik (misal kapasitas tangki mixing) dan kecepatan produksi -
        dipakai Batch Scheduling untuk memecah target SPK jadi batch-batch nyata.
      </p>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <h3 className="font-semibold mb-3">{editingId ? 'Edit Resep' : 'Tambah Resep'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SearchableSelect
            options={products.map((p: any) => ({ id: p.id, code: p.code, name: p.name }))}
            value={form.product_id ? Number(form.product_id) : null}
            onChange={(v) => setForm({ ...form, product_id: v ?? '' })}
            placeholder="Pilih Produk..."
          />
          <SearchableSelect
            options={machines.map((m: any) => ({ id: m.id, code: m.code, name: m.name }))}
            value={form.machine_id ? Number(form.machine_id) : null}
            onChange={(v) => setForm({ ...form, machine_id: v ?? '' })}
            placeholder="Pilih Mesin..."
          />
          <input
            type="number" step="any" placeholder="Kapasitas Batch"
            className="input-field" value={form.batch_size}
            onChange={(e) => setForm({ ...form, batch_size: e.target.value })}
          />
          <input
            type="number" step="any" placeholder="Rate/Jam"
            className="input-field" value={form.rate_per_hour}
            onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              Default
            </label>
            <button className="btn-primary text-sm" disabled={creating} onClick={handleSave}>
              {editingId ? 'Simpan' : 'Tambah'}
            </button>
            {editingId && (
              <button className="btn-secondary text-sm" onClick={resetForm}>Batal</button>
            )}
          </div>
        </div>
      </div>

      <input
        type="text"
        placeholder="Cari produk atau mesin..."
        className="input-field w-full max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Mesin</th>
              <th>Kapasitas Batch</th>
              <th>Rate/Jam</th>
              <th>Durasi/Batch</th>
              <th>Default</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">Belum ada resep</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.product_code} - {r.product_name}</td>
                  <td>{r.machine_code} - {r.machine_name}</td>
                  <td>{r.batch_size.toLocaleString()}</td>
                  <td>{r.rate_per_hour.toLocaleString()}</td>
                  <td>{r.duration_hours ? `${r.duration_hours} jam` : '-'}</td>
                  <td>{r.is_default ? '✓' : ''}</td>
                  <td className="flex items-center gap-2">
                    <button onClick={() => handleEdit(r)} className="text-primary-600 hover:text-primary-700">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
