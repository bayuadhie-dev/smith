import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline';
import SearchableSelect from '../../components/SearchableSelect';
import {
  useGetChartOfAccountsQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
} from '../../services/api';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  balance: number;
  is_header: boolean;
  is_cash_bank: boolean;
  level: number;
  is_active: boolean;
  description: string | null;
  parent_id: number | null;
  parent_code: string | null;
  parent_name: string | null;
}

const emptyForm = {
  code: '',
  name: '',
  type: 'asset',
  normal_balance: 'debit',
  is_header: false,
  parent_code: '' as string | null,
  description: '',
};

export default function MasterDataAccountsTab() {
  const { data, isLoading, refetch } = useGetChartOfAccountsQuery(undefined);
  const [createAccount] = useCreateAccountMutation();
  const [updateAccount] = useUpdateAccountMutation();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const accounts: Account[] = data?.accounts || [];

  const parentOptions = useMemo(
    () => accounts.map((a) => ({ id: a.code, code: a.code, name: a.name })),
    [accounts]
  );

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const s = search.toLowerCase();
    return accounts.filter(
      (a) => a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
    );
  }, [accounts, search]);

  const openCreate = () => {
    setEditingCode(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (a: Account) => {
    setEditingCode(a.code);
    setForm({
      code: a.code,
      name: a.name,
      type: a.type,
      normal_balance: a.normal_balance,
      is_header: a.is_header,
      parent_code: a.parent_code,
      description: a.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error('Kode dan nama akun wajib diisi');
      return;
    }
    try {
      if (editingCode) {
        await updateAccount({
          code: editingCode,
          name: form.name,
          type: form.type,
          normal_balance: form.normal_balance,
          is_header: form.is_header,
          parent_code: form.parent_code || null,
          description: form.description,
        }).unwrap();
        toast.success('Akun berhasil diupdate');
      } else {
        await createAccount({
          code: form.code,
          name: form.name,
          type: form.type,
          normal_balance: form.normal_balance,
          is_header: form.is_header,
          parent_code: form.parent_code || null,
          description: form.description,
        }).unwrap();
        toast.success('Akun berhasil dibuat');
      }
      setShowModal(false);
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menyimpan akun');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <input
          type="text"
          placeholder="Cari kode atau nama akun..."
          className="input-field flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary inline-flex items-center gap-2 whitespace-nowrap" onClick={openCreate}>
          <PlusIcon className="h-5 w-5" />
          Tambah Akun
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Memuat...</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Akun</th>
                  <th>Induk</th>
                  <th>Tipe</th>
                  <th>Normal Balance</th>
                  <th>Saldo</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.code}</td>
                    <td className={a.is_header ? 'font-semibold' : ''}>
                      {a.level === 2 ? <span className="pl-4 inline-block">↳ </span> : null}
                      {a.name}
                    </td>
                    <td className="text-sm text-gray-500">
                      {a.parent_code ? `${a.parent_code} - ${a.parent_name}` : '-'}
                    </td>
                    <td>
                      <span className="badge badge-info">{a.type}</span>
                    </td>
                    <td>{a.normal_balance}</td>
                    <td>Rp {a.balance.toLocaleString('id-ID')}</td>
                    <td>
                      <span className={`badge ${a.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {a.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openEdit(a)} className="text-primary-600 hover:text-primary-800">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      Tidak ada akun ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">{editingCode ? 'Edit Akun' : 'Tambah Akun'}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Kode Akun</label>
                <input
                  className="input-field"
                  value={form.code}
                  disabled={!!editingCode}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Nama Akun</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Tipe</label>
                <select
                  className="input-field"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Normal Balance</label>
                <select
                  className="input-field"
                  value={form.normal_balance}
                  onChange={(e) => setForm({ ...form, normal_balance: e.target.value })}
                >
                  <option value="debit">debit</option>
                  <option value="credit">credit</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm mb-1">Akun Induk (opsional)</label>
                <SearchableSelect
                  options={parentOptions}
                  value={form.parent_code}
                  onChange={(v) => setForm({ ...form, parent_code: (v as string) || null })}
                  placeholder="Tanpa induk (akun header/top-level)"
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_header"
                  checked={form.is_header}
                  onChange={(e) => setForm({ ...form, is_header: e.target.checked })}
                />
                <label htmlFor="is_header" className="text-sm">Akun header (kelompok, bukan akun transaksi)</label>
              </div>
              <div className="col-span-2">
                <label className="block text-sm mb-1">Deskripsi</label>
                <textarea
                  className="input-field"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn-primary" onClick={handleSave}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
