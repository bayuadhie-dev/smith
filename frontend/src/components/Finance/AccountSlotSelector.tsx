import React, { useEffect, useState } from 'react';
import axios from '../../lib/axios';

interface Account {
  id: number;
  code: string;
  name: string;
  account_type: string;
  is_header: boolean;
}

interface AccountSlotSelectorProps {
  label: string;
  value: number | null | undefined;
  onChange: (accountId: number | null) => void;
  required?: boolean;
  helpText?: string;
}

/**
 * Reusable single account-picker dropdown, used across the 9-slot
 * "Barang & Jasa" product form and the Account Preferences Settings tabs.
 * Fetches the account list once (GET /api/finance/accounts) and filters
 * out header accounts, since header accounts cannot receive direct
 * postings (see post_pending_journal()'s is_header guard).
 */
const AccountSlotSelector: React.FC<AccountSlotSelectorProps> = ({
  label,
  value,
  onChange,
  required = false,
  helpText,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    axios
      .get('/finance/accounts')
      .then((res) => {
        if (!isMounted) return;
        const list: Account[] = res.data?.accounts || [];
        setAccounts(list.filter((a) => !a.is_header));
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Gagal memuat daftar akun');
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
      >
        <option value="">{loading ? 'Memuat...' : '-- Pilih Akun --'}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} - {a.name}
          </option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      {helpText && !error && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{helpText}</p>
      )}
    </div>
  );
};

export default AccountSlotSelector;
