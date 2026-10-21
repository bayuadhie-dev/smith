import React, { useState, useCallback, useEffect } from 'react';
import AccessibleModal from './AccessibleModal';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * Pengganti native window.confirm() (2026-10-19) - browser automation tools
 * (dan sebagian pengguna) tidak bisa berinteraksi dengan dialog native,
 * jadi semua confirm() di aplikasi pindah ke sini secara bertahap.
 *
 * Pakai seperti window.confirm tapi async:
 *   if (!(await confirmDialog('Hapus data ini?'))) return;
 *
 * Singleton pub-sub sederhana (sama pola seperti react-hot-toast's imperative
 * API) supaya bisa dipanggil dari mana saja (termasuk di luar komponen React,
 * misal di dalam async handler biasa) tanpa perlu useConfirm() hook di tiap
 * file. Provider di-mount sekali di App.tsx, sejajar dengan <ToastProvider />.
 */

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // tombol confirm merah (untuk aksi destruktif) - default true
}

interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (value: boolean) => void;
}

let pushRequest: ((req: ConfirmRequest) => void) | null = null;

export function confirmDialog(message: string, options?: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushRequest) {
      // Provider belum mount (seharusnya tidak terjadi di app ini) - fallback
      // ke native supaya aksi tidak pernah diam-diam gagal tanpa konfirmasi.
      resolve(window.confirm(message));
      return;
    }
    pushRequest({ message, resolve, ...options });
  });
}

export const ConfirmDialogProvider: React.FC = () => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    pushRequest = (req) => setQueue((prev) => [...prev, req]);
    return () => {
      pushRequest = null;
    };
  }, []);

  const current = queue[0] || null;

  const settle = useCallback((value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setQueue((prev) => prev.slice(1));
  }, [current]);

  if (!current) return null;

  const danger = current.danger !== false;

  return (
    <AccessibleModal
      isOpen={true}
      onClose={() => settle(false)}
      title={current.title || 'Konfirmasi'}
      size="sm"
      closeOnOverlayClick={false}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => settle(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {current.cancelText || 'Batal'}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            autoFocus
          >
            {current.confirmText || 'Ya'}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        {danger && (
          <ExclamationTriangleIcon className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
        )}
        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{current.message}</p>
      </div>
    </AccessibleModal>
  );
};

export default confirmDialog;
