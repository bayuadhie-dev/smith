import React, { useEffect, useState } from 'react';
import axios from '../../lib/axios';
import AccountSlotSelector from '../../components/Finance/AccountSlotSelector';
import SingleRowSettingsTab from '../../components/Finance/SingleRowSettingsTab';

interface SettingsTab {
  id: string;
  name: string;
}

interface ProductCategory {
  id: number;
  code: string;
  name: string;
}

interface ProductLite {
  id: number;
  code: string;
  name: string;
}

// The 9 "Barang & Jasa" account slots, in the order agreed with management
// (matches Accurate's Preferensi Akun structure for this tab specifically).
const ITEM_SLOTS: { key: string; label: string }[] = [
  { key: 'akun_persediaan_id', label: 'Akun Persediaan' },
  { key: 'akun_penjualan_id', label: 'Akun Penjualan' },
  { key: 'akun_retur_penjualan_id', label: 'Akun Retur Penjualan' },
  { key: 'akun_diskon_penjualan_id', label: 'Akun Diskon Penjualan' },
  { key: 'akun_barang_terkirim_id', label: 'Akun Barang Terkirim' },
  { key: 'akun_hpp_id', label: 'Akun HPP' },
  { key: 'akun_retur_pembelian_id', label: 'Akun Retur Pembelian' },
  { key: 'akun_beban_id', label: 'Akun Beban' },
  { key: 'akun_pembelian_belum_tertagih_id', label: 'Akun Pembelian Belum Tertagih' },
];

const AccountPreferences: React.FC = () => {
  const [activeTab, setActiveTab] = useState('barang_jasa');

  const tabs: SettingsTab[] = [
    { id: 'barang_jasa', name: 'Barang & Jasa' },
    { id: 'penjualan', name: 'Penjualan' },
    { id: 'pembelian', name: 'Pembelian' },
    { id: 'pajak', name: 'Pajak' },
    { id: 'perusahaan', name: 'Perusahaan' },
    { id: 'persediaan', name: 'Persediaan' },
    { id: 'penomoran', name: 'Penomoran Dokumen' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Preferensi Akun
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700 border-l-4 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow p-6">
            {activeTab === 'barang_jasa' && <BarangJasaTab />}
            {activeTab === 'penjualan' && (
              <SingleRowSettingsTab
                title="Penjualan"
                description="Akun default untuk transaksi penjualan di luar 9 slot per-item."
                endpoint="/finance/account-preferences/sales-settings"
                fields={[{ key: 'akun_uang_muka_pelanggan_id', label: 'Akun Uang Muka Pelanggan' }]}
              />
            )}
            {activeTab === 'pembelian' && (
              <SingleRowSettingsTab
                title="Pembelian"
                description="Akun default untuk transaksi pembelian di luar 9 slot per-item."
                endpoint="/finance/account-preferences/purchase-settings"
                fields={[
                  { key: 'akun_selisih_pembelian_id', label: 'Akun Selisih Pembelian' },
                  { key: 'akun_perintah_pembayaran_id', label: 'Akun Perintah Pembayaran' },
                ]}
              />
            )}
            {activeTab === 'pajak' && (
              <SingleRowSettingsTab
                title="Pajak"
                description="Akun default untuk PPN dan PPh."
                endpoint="/finance/account-preferences/tax-settings"
                fields={[
                  { key: 'akun_ppn_keluaran_id', label: 'Akun PPN Keluaran' },
                  { key: 'akun_ppn_masukan_id', label: 'Akun PPN Masukan' },
                  { key: 'akun_pph22_id', label: 'Akun PPh 22' },
                  { key: 'akun_pph23_id', label: 'Akun PPh 23' },
                ]}
              />
            )}
            {activeTab === 'perusahaan' && (
              <SingleRowSettingsTab
                title="Perusahaan"
                description="Akun ekuitas dan pengaturan kurs mata uang."
                endpoint="/finance/account-preferences/company-settings"
                fields={[
                  { key: 'akun_ekuitas_id', label: 'Akun Ekuitas' },
                  { key: 'akun_laba_ditahan_id', label: 'Akun Laba Ditahan' },
                  { key: 'exchange_rate_refresh_enabled', label: 'Aktifkan refresh kurs otomatis harian', type: 'boolean' },
                ]}
              />
            )}
            {activeTab === 'persediaan' && (
              <SingleRowSettingsTab
                title="Persediaan"
                description="Akun default untuk penyesuaian stok (wajib diisi sebelum posting hasil stok opname)."
                endpoint="/finance/account-preferences/inventory-settings"
                fields={[{ key: 'akun_penyesuaian_id', label: 'Akun Penyesuaian Persediaan' }]}
              />
            )}
            {activeTab === 'penomoran' && <NomorDokumenTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * "Barang & Jasa" tab: bulk-edit-by-category (apply one account to every
 * item in a category at once) plus per-item override for exceptions.
 * Per the 2026-08-14 decision, bulk-by-category is the primary entry
 * mechanism so not every item needs manual setup from day one.
 */
const BarangJasaTab: React.FC = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryDefaults, setCategoryDefaults] = useState<Record<string, number | null>>({});
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productOverrides, setProductOverrides] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    axios.get('/products/product-categories').then((res) => {
      setCategories(res.data?.categories || []);
    });
    axios.get('/products').then((res) => {
      const list = res.data?.products || res.data || [];
      setProducts(list.map((p: any) => ({ id: p.id, code: p.code, name: p.name })));
    });
  }, []);

  // Load existing category defaults when a category is picked
  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryDefaults({});
      return;
    }
    axios
      .get(`/finance/account-preferences/category-defaults/${selectedCategoryId}`)
      .then((res) => setCategoryDefaults(res.data || {}))
      .catch(() => setCategoryDefaults({}));
  }, [selectedCategoryId]);

  // Load existing product overrides when a product is picked
  useEffect(() => {
    if (!selectedProductId) {
      setProductOverrides({});
      return;
    }
    axios
      .get(`/finance/account-preferences/product-overrides/${selectedProductId}`)
      .then((res) => setProductOverrides(res.data || {}))
      .catch(() => setProductOverrides({}));
  }, [selectedProductId]);

  const handleSaveCategoryDefaults = async () => {
    if (!selectedCategoryId) return;
    setSaving(true);
    setMessage(null);
    try {
      await axios.put(`/finance/account-preferences/category-defaults/${selectedCategoryId}`, categoryDefaults);
      setMessage({ type: 'success', text: 'Berhasil disimpan untuk kategori. Berlaku untuk semua item di kategori ini kecuali yang punya override sendiri.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan kategori.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProductOverride = async () => {
    if (!selectedProductId) return;
    setSaving(true);
    setMessage(null);
    try {
      await axios.put(`/finance/account-preferences/product-overrides/${selectedProductId}`, productOverrides);
      setMessage({ type: 'success', text: 'Berhasil disimpan sebagai override khusus item ini.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal menyimpan override item.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Bulk-by-category section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Atur per Kategori (Massal)
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Terapkan satu akun ke semua item dalam kategori ini sekaligus. Item tertentu masih bisa
          dikecualikan lewat override di bawah.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Kategori
          </label>
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Pilih Kategori --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedCategoryId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ITEM_SLOTS.map((slot) => (
                <AccountSlotSelector
                  key={slot.key}
                  label={slot.label}
                  value={categoryDefaults[slot.key]}
                  onChange={(accountId) =>
                    setCategoryDefaults((prev) => ({ ...prev, [slot.key]: accountId }))
                  }
                />
              ))}
            </div>
            <button
              onClick={handleSaveCategoryDefaults}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan untuk Kategori Ini'}
            </button>
          </>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Per-item override section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Override per Item
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Untuk item yang butuh akun berbeda dari default kategorinya.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Item
          </label>
          <select
            value={selectedProductId ?? ''}
            onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Pilih Item --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProductId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ITEM_SLOTS.map((slot) => (
                <AccountSlotSelector
                  key={slot.key}
                  label={slot.label}
                  value={productOverrides[slot.key]}
                  onChange={(accountId) =>
                    setProductOverrides((prev) => ({ ...prev, [slot.key]: accountId }))
                  }
                  helpText="Kosongkan untuk memakai default kategori/global"
                />
              ))}
            </div>
            <button
              onClick={handleSaveProductOverride}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Override Item Ini'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * "Penomoran Dokumen" tab: lets an admin override the prefix used for
 * document numbers (e.g. INV, PO) going forward. Per the 2026-08-16
 * decision, this is purely additive - it only affects NEW call sites
 * written via generate_number_v2(), not the dozens of existing hardcoded
 * generate_number() calls throughout the codebase.
 */
const NomorDokumenTab: React.FC = () => {
  type SequenceRow = { id: number; sequence_key: string; prefix: string; description: string | null };
  const [sequences, setSequences] = useState<SequenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ prefix: '', description: '' });
  const [newForm, setNewForm] = useState({ sequence_key: '', prefix: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSequences = () => {
    axios
      .get('/finance/number-sequences')
      .then((res) => {
        setSequences(res.data?.number_sequences || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadSequences();
  }, []);

  const handleSave = async (sequence_key: string, prefix: string, description: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await axios.post('/finance/number-sequences', { sequence_key, prefix, description });
      setMessage({ type: 'success', text: 'Berhasil disimpan.' });
      setEditingKey(null);
      setNewForm({ sequence_key: '', prefix: '', description: '' });
      loadSequences();
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal menyimpan.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Memuat...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Penomoran Dokumen</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Atur prefix nomor dokumen (misal INV, PO). Perubahan di sini hanya berlaku untuk fitur baru yang
        dibangun ke depannya, tidak mengubah nomor dokumen dari fitur lama yang sudah ada.
      </p>

      {message && (
        <div
          className={`p-3 rounded-md text-sm mb-4 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
            <th className="pb-2">Kunci</th>
            <th className="pb-2">Prefix</th>
            <th className="pb-2">Keterangan</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {sequences.map((s) => (
            <tr key={s.sequence_key} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 font-mono">{s.sequence_key}</td>
              <td className="py-2">
                {editingKey === s.sequence_key ? (
                  <input
                    type="text"
                    value={editForm.prefix}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, prefix: e.target.value }))}
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                  />
                ) : (
                  s.prefix
                )}
              </td>
              <td className="py-2 text-gray-500">
                {editingKey === s.sequence_key ? (
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                  />
                ) : (
                  s.description
                )}
              </td>
              <td className="py-2 text-right">
                {editingKey === s.sequence_key ? (
                  <button
                    onClick={() => handleSave(s.sequence_key, editForm.prefix, editForm.description)}
                    disabled={saving}
                    className="text-primary-600 hover:underline"
                  >
                    Simpan
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingKey(s.sequence_key);
                      setEditForm({ prefix: s.prefix, description: s.description || '' });
                    }}
                    className="text-gray-500 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tambah Kunci Baru</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="kunci (e.g. sales_invoice)"
            value={newForm.sequence_key}
            onChange={(e) => setNewForm((prev) => ({ ...prev, sequence_key: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
          />
          <input
            type="text"
            placeholder="prefix (e.g. INV)"
            value={newForm.prefix}
            onChange={(e) => setNewForm((prev) => ({ ...prev, prefix: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
          />
          <input
            type="text"
            placeholder="keterangan"
            value={newForm.description}
            onChange={(e) => setNewForm((prev) => ({ ...prev, description: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
          />
        </div>
        <button
          onClick={() => handleSave(newForm.sequence_key, newForm.prefix, newForm.description)}
          disabled={saving || !newForm.sequence_key || !newForm.prefix}
          className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          Tambah
        </button>
      </div>
    </div>
  );
};

export default AccountPreferences;
