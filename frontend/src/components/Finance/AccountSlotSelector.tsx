import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../lib/axios';
import SearchableSelect from '../SearchableSelect';

interface Account {
  id: number;
  code: string;
  name: string;
  account_type: string;
  parent_id?: number | null;
  is_header: boolean;
}

interface AccountSlotSelectorProps {
  label: string;
  value: number | null | undefined;
  onChange: (accountId: number | null) => void;
  required?: boolean;
  helpText?: string;
  /** Slot kolom akun barang (mis. 'akun_penjualan_id'); mempersempit daftar sesuai aturannya. */
  slot?: string;
}

// Aturan per slot: jenis akun + kata kunci pada nama akun itu sendiri atau induknya (induk bisa bertingkat).
const SLOT_RULES: Record<string, { types: string[]; ancestor?: RegExp; hint: string }> = {
  akun_persediaan_id: { types: ['asset'], ancestor: /persediaan|inventory/i, hint: 'akun persediaan' },
  akun_barang_terkirim_id: { types: ['asset'], ancestor: /persediaan|inventory/i, hint: 'akun persediaan' },
  akun_retur_pembelian_id: { types: ['asset'], ancestor: /persediaan|inventory/i, hint: 'akun persediaan' },
  akun_penjualan_id: { types: ['revenue'], ancestor: /^penjualan|^sales/i, hint: 'pendapatan, induk Penjualan' },
  akun_retur_penjualan_id: { types: ['revenue'], ancestor: /retur/i, hint: 'pendapatan, induk Retur Penjualan' },
  akun_diskon_penjualan_id: { types: ['revenue'], ancestor: /diskon|potongan|discount/i, hint: 'pendapatan, induk Diskon Penjualan' },
  akun_hpp_id: { types: ['expense'], ancestor: /hpp|pokok|cogs/i, hint: 'beban pokok penjualan, induk HPP' },
  akun_pembelian_belum_tertagih_id: { types: ['liability'], hint: 'akun liabilitas' },
  akun_beban_id: { types: ['expense'], hint: 'akun beban' },
};

const AccountSlotSelector: React.FC<AccountSlotSelectorProps> = ({ label, value, onChange, required = false, helpText, slot }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    axios
      .get('/finance/accounts')
      .then((res) => {
        if (!isMounted) return;
        setAccounts(res.data?.accounts || []);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Gagal memuat daftar akun');
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const { options, narrowed, hint } = useMemo(() => {
    const detail = accounts.filter((a) => !a.is_header);
    const rule = slot ? SLOT_RULES[slot] : undefined;
    if (!rule) return { options: detail, narrowed: false, hint: '' };
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const chainMatches = (a: Account, re: RegExp) => {
      let cur: Account | undefined = a;
      for (let i = 0; cur && i < 6; i++) {
        if (re.test(cur.name)) return true;
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
      return false;
    };
    const ofType = detail.filter((a) => rule.types.includes(a.account_type));
    const strict = rule.ancestor ? ofType.filter((a) => chainMatches(a, rule.ancestor!)) : ofType;
    // Bila struktur akun perusahaan tidak punya induk yang cocok, jatuh ke semua akun berjenis sama (tetap bisa dicari).
    const picked = strict.length ? strict : ofType;
    const current = typeof value === 'number' ? detail.find((a) => a.id === value) : undefined;
    const out = current && !picked.some((a) => a.id === current.id) ? [current, ...picked] : picked;
    return { options: out, narrowed: true, hint: strict.length ? rule.hint : `semua ${rule.types[0]}` };
  }, [accounts, slot, value]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <SearchableSelect
        options={options.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
        value={typeof value === 'number' && Number.isFinite(value) ? value : null}
        onChange={(v) => onChange(v ? Number(v) : null)}
        placeholder={loading ? 'Memuat...' : 'Cari kode atau nama akun'}
        disabled={loading}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      {narrowed && !error && <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Menampilkan {hint}. Ketik untuk mencari.</p>}
      {helpText && !error && <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{helpText}</p>}
    </div>
  );
};

export default AccountSlotSelector;
