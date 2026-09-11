import React, { useEffect, useState } from 'react';
import axios from '../../lib/axios';

interface RecurringPaymentMaster {
  id: number;
  name: string;
  category: string;
  vendor_name: string | null;
  notes: string | null;
}

interface RecurringPaymentTx {
  id: number;
  transaction_number: string;
  payment_date: string;
  period_label: string | null;
  amount: number;
  notes: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  electricity: 'Listrik',
  water: 'Air',
  internet: 'Internet/WiFi',
  other: 'Lainnya',
};

/**
 * Recurring payment (WiFi/Listrik/Air) management. Two levels: master list
 * (the named bill template, e.g. "Listrik Pabrik") and, per master, a
 * transaction history of actual monthly payments - each payment posts a
 * GL journal automatically (Debit Beban Operasional / Credit Kas) via the
 * backend, so this UI is purely data entry, no journal logic here.
 */
const RecurringPayment: React.FC = () => {
  const [masters, setMasters] = useState<RecurringPaymentMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaster, setSelectedMaster] = useState<RecurringPaymentMaster | null>(null);
  const [transactions, setTransactions] = useState<RecurringPaymentTx[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const [showNewMasterForm, setShowNewMasterForm] = useState(false);
  const [newMaster, setNewMaster] = useState({ name: '', category: 'electricity', vendor_name: '', notes: '' });

  const [showNewTxForm, setShowNewTxForm] = useState(false);
  const [newTx, setNewTx] = useState({ payment_date: '', amount: '', notes: '' });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadMasters = () => {
    axios
      .get('/finance/recurring-payments')
      .then((res) => {
        setMasters(res.data?.recurring_payments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const loadTransactions = (masterId: number) => {
    setLoadingTx(true);
    axios
      .get(`/finance/recurring-payments/${masterId}/transactions`)
      .then((res) => {
        setTransactions(res.data?.transactions || []);
        setLoadingTx(false);
      })
      .catch(() => setLoadingTx(false));
  };

  const handleSelectMaster = (master: RecurringPaymentMaster) => {
    setSelectedMaster(master);
    setShowNewTxForm(false);
    loadTransactions(master.id);
  };

  const handleCreateMaster = async () => {
    if (!newMaster.name || !newMaster.category) return;
    setSaving(true);
    setMessage(null);
    try {
      await axios.post('/finance/recurring-payments', newMaster);
      setMessage({ type: 'success', text: 'Berhasil ditambahkan.' });
      setNewMaster({ name: '', category: 'electricity', vendor_name: '', notes: '' });
      setShowNewMasterForm(false);
      loadMasters();
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal menambahkan.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedMaster || !newTx.payment_date || !newTx.amount) return;
    setSaving(true);
    setMessage(null);
    try {
      await axios.post(`/finance/recurring-payments/${selectedMaster.id}/transactions`, {
        payment_date: newTx.payment_date,
        amount: Number(newTx.amount),
        notes: newTx.notes || undefined,
      });
      setMessage({ type: 'success', text: 'Pembayaran berhasil dicatat dan jurnal telah diposting.' });
      setNewTx({ payment_date: '', amount: '', notes: '' });
      setShowNewTxForm(false);
      loadTransactions(selectedMaster.id);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.error || 'Gagal mencatat pembayaran.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tagihan Rutin</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        WiFi, listrik, air, dan tagihan bulanan lainnya. Setiap pembayaran yang dicatat otomatis membuat
        jurnal (Debit Beban Operasional / Kredit Kas).
      </p>

      {message && (
        <div
          className={`p-3 rounded-md text-sm mb-6 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Master list */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Daftar Tagihan</h2>
              <button
                onClick={() => setShowNewMasterForm(!showNewMasterForm)}
                className="text-sm text-primary-600 hover:underline"
              >
                {showNewMasterForm ? 'Batal' : '+ Tambah'}
              </button>
            </div>

            {showNewMasterForm && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
                <input
                  type="text"
                  placeholder="Nama (e.g. Listrik Pabrik)"
                  value={newMaster.name}
                  onChange={(e) => setNewMaster((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                />
                <select
                  value={newMaster.category}
                  onChange={(e) => setNewMaster((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Vendor (e.g. PLN)"
                  value={newMaster.vendor_name}
                  onChange={(e) => setNewMaster((prev) => ({ ...prev, vendor_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                />
                <button
                  onClick={handleCreateMaster}
                  disabled={saving || !newMaster.name}
                  className="w-full px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                >
                  Simpan
                </button>
              </div>
            )}

            <div>
              {masters.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Belum ada tagihan terdaftar.</p>
              ) : (
                masters.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMaster(m)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedMaster?.id === m.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {CATEGORY_LABELS[m.category] || m.category}
                      {m.vendor_name && ` · ${m.vendor_name}`}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transaction history for selected master */}
        <div className="lg:col-span-2">
          {!selectedMaster ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
              Pilih tagihan di sebelah kiri untuk melihat riwayat pembayaran.
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{selectedMaster.name}</h2>
                <button
                  onClick={() => setShowNewTxForm(!showNewTxForm)}
                  className="text-sm text-primary-600 hover:underline"
                >
                  {showNewTxForm ? 'Batal' : '+ Catat Pembayaran'}
                </button>
              </div>

              {showNewTxForm && (
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newTx.payment_date}
                      onChange={(e) => setNewTx((prev) => ({ ...prev, payment_date: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Jumlah"
                      value={newTx.amount}
                      onChange={(e) => setNewTx((prev) => ({ ...prev, amount: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Catatan (opsional)"
                    value={newTx.notes}
                    onChange={(e) => setNewTx((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                  />
                  <button
                    onClick={handleCreateTransaction}
                    disabled={saving || !newTx.payment_date || !newTx.amount}
                    className="w-full px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan & Posting Jurnal'}
                  </button>
                </div>
              )}

              {loadingTx ? (
                <div className="p-4 text-gray-500 text-sm">Memuat...</div>
              ) : transactions.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Belum ada riwayat pembayaran.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Periode</th>
                      <th className="p-3 text-right">Jumlah</th>
                      <th className="p-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-3">{new Date(t.payment_date).toLocaleDateString('id-ID')}</td>
                        <td className="p-3">{t.period_label}</td>
                        <td className="p-3 text-right">Rp{t.amount.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-gray-500">{t.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecurringPayment;
