import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowRightIcon,
  ChartBarIcon,
  CogIcon,
  ComputerDesktopIcon,
  TruckIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { PageHeader } from '../../components/ui/PageKit';
const TVDisplaySelector: React.FC = () => {
  const { t } = useLanguage();

  const displayOptions = [
    {
      title: 'Lantai Produksi',
      description: 'Pantau mesin produksi, SPK, dan kemajuan pengerjaan.',
      icon: CogIcon,
      href: '/tv/production',
      color: 'blue',
      features: ['SPK aktif', 'Status mesin', 'Kemajuan produksi', 'Target vs realisasi']
    },
    {
      title: 'Pengiriman',
      description: 'Lacak pengiriman, status sopir, dan jadwal antar.',
      icon: TruckIcon,
      href: '/tv/shipping',
      color: 'green',
      features: ['Pengiriman aktif', 'Status sopir', 'Nomor resi', 'Jadwal antar']
    },
    {
      title: 'Jadwal Karyawan',
      description: 'Jadwal karyawan per mesin per shift untuk minggu ini.',
      icon: UsersIcon,
      href: '/tv/roster',
      color: 'purple',
      features: ['Jadwal mingguan', 'Penempatan mesin', 'Jadwal shift', 'Status karyawan']
    },
    {
      title: 'Ringkasan Pabrik',
      description: 'Gambaran menyeluruh operasional pabrik dan KPI.',
      icon: ChartBarIcon,
      href: '/tv/overview',
      color: 'yellow',
      features: ['KPI produksi', 'Ringkasan pengiriman', 'Ukuran mutu', 'Ringkasan OEE']
    }
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800'
    },
    green: {
      bg: 'bg-green-600',
      hover: 'hover:bg-green-700',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800'
    },
    purple: {
      bg: 'bg-purple-600',
      hover: 'hover:bg-purple-700',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800'
    },
    yellow: {
      bg: 'bg-yellow-600',
      hover: 'hover:bg-yellow-700',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800'
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          eyebrow="LAYAR TV"
          title="Layar TV Pabrik"
          subtitle="Pilih tampilan yang akan dipasang di layar TV untuk pemantauan operasional."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayOptions.map((option) => {
            const Icon = option.icon;
            const colors = colorClasses[option.color as keyof typeof colorClasses];
            
            return (
              <Link
                key={option.title}
                to={option.href}
                className="fn-card fn-press group block p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className={`p-3 ${colors.bg} rounded-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <ArrowRightIcon className="h-6 w-6 text-gray-400 group-hover:text-gray-600 dark:text-gray-300 transition-colors" />
                </div>
                
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {option.title}
                </h3>
                
                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                  {option.description}
                </p>

                <div className="space-y-2">
                  <h4 className="fn-label mb-3">Isi tampilan</h4>
                  <ul className="space-y-2">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <div className={`w-2 h-2 ${colors.bg} rounded-full mr-3`}></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className={`inline-flex items-center text-sm font-medium ${colors.text} group-hover:${colors.text}`}>
                    Buka tampilan
                    <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="fn-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Tips pemakaian layar TV
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2 text-left">
              <li>Pakai mode layar penuh pada peramban.</li>
              <li>Data dimuat ulang otomatis setiap 10-30 detik.</li>
              <li>Paling enak dilihat di TV 32 inci ke atas, resolusi 1080p.</li>
              <li>Tekan F11 untuk layar penuh, atau klik tombolnya.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVDisplaySelector;
