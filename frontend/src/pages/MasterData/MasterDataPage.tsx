import React, { useState } from 'react';
import { CubeIcon, BanknotesIcon, BeakerIcon } from '@heroicons/react/24/outline';
import MasterDataBarangTab from './MasterDataBarangTab';
import MasterDataAccountsTab from './MasterDataAccountsTab';
import MasterDataRecipeTab from './MasterDataRecipeTab';

type Tab = 'barang' | 'accounts' | 'recipes';

export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>('barang');

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'barang', label: 'Barang (Product & Material)', icon: CubeIcon },
    { key: 'accounts', label: 'Chart of Accounts', icon: BanknotesIcon },
    { key: 'recipes', label: 'Resep Produksi', icon: BeakerIcon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Master Data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pusat data master yang dipakai lintas modul — barang dan akun perkiraan.
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6 -mb-px">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                tab === key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'barang' && <MasterDataBarangTab />}
      {tab === 'accounts' && <MasterDataAccountsTab />}
      {tab === 'recipes' && <MasterDataRecipeTab />}
    </div>
  );
}
