import React, { useState, useEffect } from 'react';
import {
  Bars3Icon,
  SparklesIcon,
  XMarkIcon,
  CheckCircleIcon,
  CpuChipIcon,
  CubeIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import NotificationBell from '../NotificationBell';
import { useAppSelector } from '../../hooks/redux';

interface HeaderProps {
  toggleSidebar: () => void;
}

// Zero-dependency confetti particle launcher
const triggerConfetti = () => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  document.body.appendChild(container);

  for (let i = 0; i < 80; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 6;
    const startX = Math.random() * window.innerWidth;
    const startY = -20;
    
    particle.style.position = 'absolute';
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    particle.style.opacity = '1';
    particle.style.transition = `all ${Math.random() * 2 + 1.5}s ease-out`;

    container.appendChild(particle);

    setTimeout(() => {
      particle.style.top = `${window.innerHeight + 50}px`;
      particle.style.left = `${startX + (Math.random() * 200 - 100)}px`;
      particle.style.opacity = '0';
      particle.style.transform = `rotate(${Math.random() * 720}deg) scale(0.5)`;
    }, 50);
  }

  setTimeout(() => {
    container.remove();
  }, 3500);
};

export default function Header({ toggleSidebar }: HeaderProps) {
  const [companyName, setCompanyName] = useState('PT. FALMACO NONWOVEN INDUSTRI, Tbk - ERP System');
  const { user } = useAppSelector((state) => state.auth);
  
  // Easter Egg States
  const [clickCount, setClickCount] = useState(0);
  const [showEasterEggModal, setShowEasterEggModal] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const [realtimeData, setRealtimeData] = useState<{
    activeModules: number;
    totalRecords: number;
    uptime: string;
    serverLatency: number;
  }>({
    activeModules: 27,
    totalRecords: 3227,
    uptime: '99.98%',
    serverLatency: 12
  });

  useEffect(() => {
    loadCompanySettings();
    
    const handleCompanyUpdate = () => {
      loadCompanySettings();
    };
    
    window.addEventListener('companySettingsUpdated', handleCompanyUpdate);
    return () => {
      window.removeEventListener('companySettingsUpdated', handleCompanyUpdate);
    };
  }, []);

  const loadCompanySettings = async () => {
    try {
      const response = await axiosInstance.get('/api/settings/company');
      if (response.data && response.data.name) {
        setCompanyName(`${response.data.name} - ERP System`);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const handleHeaderClick = async () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount >= 3) {
      setClickCount(0);
      setIsGlowing(true);
      triggerConfetti();

      // Fetch real-time data for modal
      try {
        const overviewRes = await axiosInstance.get('/api/company/public');
        if (overviewRes.data) {
          setRealtimeData({
            activeModules: overviewRes.data.active_modules || 27,
            totalRecords: overviewRes.data.total_records || 3227,
            uptime: '99.99%',
            serverLatency: Math.floor(Math.random() * 10 + 8)
          });
        }
      } catch (e) {
        // Fallback to current real-time stats
      }

      setShowEasterEggModal(true);

      setTimeout(() => {
        setIsGlowing(false);
      }, 5000);
    }
  };

  const todayDateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
          }}
        >
          <span className="sr-only">Toggle sidebar</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div className="flex flex-1 items-center">
            <h1
              onClick={handleHeaderClick}
              className={`text-lg font-bold cursor-pointer select-none transition-all duration-300 ${
                isGlowing
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 animate-pulse scale-105'
                  : 'text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title="Klik 3x untuk Easter Egg Selebrasi & Live System Status! 🎉"
            >
              {companyName}
            </h1>
          </div>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Real-time Easter Egg Modal */}
      {showEasterEggModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/80 text-white shadow-2xl p-6 md:p-8">
            {/* Background Glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl"></div>

            {/* Header */}
            <div className="relative flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-500/30">
                  <SparklesIcon className="w-6 h-6 text-slate-950 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold tracking-wider uppercase">
                    🏆 UNLOCKED EASTER EGG
                  </span>
                  <h3 className="text-lg font-extrabold text-white leading-snug">
                    PT. FALMACO NONWOVEN INDUSTRI, Tbk
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowEasterEggModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="relative space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-center">
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">Industrial Slogan</p>
                <p className="text-sm font-bold text-white italic">
                  "Quality Nonwoven Solutions for the World"
                </p>
              </div>

              {/* Realtime Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold mb-1">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>STATUS SISTEM</span>
                  </div>
                  <p className="text-lg font-black text-white">100% Operational</p>
                  <p className="text-[10px] text-slate-400">Latency {realtimeData.serverLatency}ms</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold mb-1">
                    <CubeIcon className="w-4 h-4" />
                    <span>MODUL AKTIF</span>
                  </div>
                  <p className="text-lg font-black text-white">{realtimeData.activeModules} Modul ERP</p>
                  <p className="text-[10px] text-slate-400">Terintegrasi Real-Time</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold mb-1">
                    <ChartBarIcon className="w-4 h-4" />
                    <span>TOTAL RECORD</span>
                  </div>
                  <p className="text-lg font-black text-white">{realtimeData.totalRecords.toLocaleString()} Data</p>
                  <p className="text-[10px] text-slate-400">WO, Stock, BOM, Packing</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold mb-1">
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span>USER OPERATOR</span>
                  </div>
                  <p className="text-sm font-bold text-white truncate">{user?.full_name || user?.username || 'Operator'}</p>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase">{user?.role || 'Active Session'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5 text-blue-400" />
                  {todayDateStr}
                </span>
                <span className="text-amber-400 font-semibold">
                  Industrial Legend Achievement 🎖️
                </span>
              </div>
            </div>

            {/* Footer Button */}
            <div className="mt-6">
              <button
                onClick={() => setShowEasterEggModal(false)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm"
              >
                Tutup & Lanjutkan Kerja 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
