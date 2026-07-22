import React from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, HomeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/60 shadow-2xl">
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/30 animate-bounce">
          <ExclamationTriangleIcon className="w-10 h-10 text-amber-400" />
        </div>

        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-3">
          404
        </h1>

        <h2 className="text-xl font-bold text-white mb-2 leading-snug">
          Halamane ilang, kaya kancamu pas ditagih utang
        </h2>

        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Teu aya, cobi deui nya. Halaman yang Anda cari tidak ditemukan atau sudah berpindah alamat.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Kembali</span>
          </button>
          
          <Link
            to="/app/dashboard"
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Ke Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
