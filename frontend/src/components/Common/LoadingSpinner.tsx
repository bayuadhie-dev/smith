import React from 'react';

// 2026-10-07: full Axion-branded redesign (not just a recolor). Was a
// single flat `border-b-2 border-blue-600` arc - used by 58 pages via
// this shared component, so redesigning it here cascades everywhere at
// once. Now: two counter-rotating rings at different speeds (emerald
// outer, orange inner) around a pulsing brand-color center dot, plus a
// breathing "Memuat..." caption - reads as a deliberately designed
// loading state, not a default spinner, while staying pure CSS
// (no new dependencies, no image asset).
const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-3">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#059669] border-r-teal-400 animate-spin"
          style={{ animationDuration: '0.9s' }}
        />
        <div
          className="absolute inset-[6px] rounded-full border-[3px] border-transparent border-b-[#F15D2C] animate-spin [animation-direction:reverse]"
          style={{ animationDuration: '1.4s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#059669] to-[#047857] animate-pulse" />
        </div>
      </div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 animate-pulse">Memuat...</p>
    </div>
  );
};

export default LoadingSpinner;
