import React, { useEffect, useState } from 'react';
import axios from '../../lib/axios';
import AccountSlotSelector from './AccountSlotSelector';

interface FieldDef {
  key: string;
  label: string;
  type?: 'account' | 'boolean';
}

interface SingleRowSettingsTabProps {
  title: string;
  description?: string;
  endpoint: string; // e.g. '/finance/account-preferences/sales-settings'
  fields: FieldDef[];
}

/**
 * Generic single-row settings form, used by the 5 smaller Account
 * Preferences tabs (Penjualan, Pembelian, Pajak, Perusahaan, Persediaan).
 * Each of those tabs is just a handful of account-slot fields (plus
 * occasionally a boolean toggle) against a single-row backend table,
 * so one component covers all 5 rather than duplicating the form 5x.
 */
const SingleRowSettingsTab: React.FC<SingleRowSettingsTabProps> = ({
  title,
  description,
  endpoint,
  fields,
}) => {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    axios
      .get(endpoint)
      .then((res) => {
        setValues(res.data || {});
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Gagal memuat pengaturan.' });
        setLoading(false);
      });
  }, [endpoint]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await axios.put(endpoint, values);
      setValues(res.data || values);
      setMessage({ type: 'success', text: 'Berhasil disimpan.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Memuat...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
      )}

      {message && (
        <div
          className={`p-3 rounded-md text-sm mb-4 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => {
          if (field.type === 'boolean') {
            return (
              <div key={field.key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={field.key}
                  checked={!!values[field.key]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor={field.key} className="text-sm text-gray-700 dark:text-gray-200">
                  {field.label}
                </label>
              </div>
            );
          }
          return (
            <AccountSlotSelector
              key={field.key}
              label={field.label}
              value={values[field.key]}
              onChange={(accountId) => setValues((prev) => ({ ...prev, [field.key]: accountId }))}
            />
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </button>
    </div>
  );
};

export default SingleRowSettingsTab;
