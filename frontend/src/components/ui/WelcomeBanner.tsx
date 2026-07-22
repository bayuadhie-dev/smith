import React, { useState, useEffect } from 'react';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '../../hooks/redux';
import { getDynamicLoginGreeting } from '../../utils/greetingHelper';

export const WelcomeBanner: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [isVisible, setIsVisible] = useState(true);
  const [greetingMsg, setGreetingMsg] = useState('');

  useEffect(() => {
    const userAny = user as any;
    const isFirstTime = userAny?.is_first_login || userAny?.login_count === 1;
    const msg = getDynamicLoginGreeting(user?.full_name || user?.username, isFirstTime);
    setGreetingMsg(msg);
  }, [user]);

  if (!isVisible) return null;

  const userAny = user as any;
  const userRole = userAny?.role || (Array.isArray(userAny?.roles) ? userAny.roles[0] : '');

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-5 md:p-6 text-white border border-blue-500/30 shadow-xl mb-6">
      {/* Background Glow Mesh */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -left-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/30 border border-blue-400/30 flex-shrink-0">
            <SparklesIcon className="w-7 h-7 text-white animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-bold tracking-wide uppercase">
                📅 {todayStr}
              </span>
              {userRole && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold uppercase">
                  {userRole}
                </span>
              )}
            </div>
            <h2 className="text-lg md:text-2xl font-extrabold text-white leading-snug tracking-tight">
              {greetingMsg}
            </h2>
          </div>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="self-end md:self-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700/60"
          title="Tutup sapaan"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeBanner;
