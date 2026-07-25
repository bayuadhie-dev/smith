import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  IdentificationIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';

export interface PendingUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
  employee_number?: string;
  department?: string;
  position?: string;
  created_at?: string;
  requested_role: string;
}

interface PendingUserTableProps {
  pendingUsers: PendingUser[];
  onRefresh: () => void;
}

const PendingUserTable: React.FC<PendingUserTableProps> = ({ pendingUsers, onRefresh }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    user: PendingUser;
    action: 'approve' | 'decline';
  } | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleActionConfirm = async () => {
    if (!confirmModal) return;
    const { user, action } = confirmModal;
    setActionLoadingId(user.id);
    setConfirmModal(null);

    try {
      const res = await axiosInstance.post(`/api/auth/approve-user/${user.id}`, { action });
      if (res.data.success) {
        toast.success(res.data.message || (action === 'approve' ? 'Pengguna berhasil disetujui' : 'Pendaftaran ditolak'));
        onRefresh();
      } else {
        toast.error(res.data.error || 'Gagal memproses aksi');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal memproses aksi');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (pendingUsers.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
          <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tidak Ada Pendaftaran Menunggu</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          Semua akun pengguna yang mendaftar telah diproses. Pendaftaran akun baru akan muncul di sini untuk disetujui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {pendingUsers.length} pendaftaran membutuhkan verifikasi Super Admin
          </span>
        </div>
        <span className="text-xs text-gray-400">Klik baris untuk melihat detail registrasi</span>
      </div>

      <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/80">
            <tr>
              <th scope="col" className="w-10 px-3 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"></th>
              <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Lengkap</th>
              <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role Diminta</th>
              <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal Daftar</th>
              <th scope="col" className="px-4 py-3.5 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi Verifikasi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {pendingUsers.map(user => {
              const isExpanded = expandedId === user.id;
              const isLoading = actionLoadingId === user.id;

              return (
                <React.Fragment key={user.id}>
                  {/* MAIN ROW */}
                  <tr
                    onClick={() => toggleExpand(user.id)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isExpanded ? 'bg-blue-50/70 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <td className="px-3 py-4 whitespace-nowrap text-gray-400">
                      {isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 font-bold" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                          {user.full_name?.substring(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-sm">{user.full_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {user.requested_role}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className="w-4 h-4 text-gray-400" />
                        {user.created_at ? new Date(user.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setConfirmModal({ user, action: 'approve' })}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => setConfirmModal({ user, action: 'decline' })}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* EXPANDED DETAILS PANEL */}
                  {isExpanded && (
                    <tr className="bg-blue-50/50 dark:bg-slate-900/80 border-t-0">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-inner border border-blue-100 dark:border-gray-700 space-y-3">
                          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                              <UserIcon className="w-4 h-4" />
                              Detail Lengkap Registrasi Akun
                            </span>
                            <span className="text-[11px] text-gray-400">ID User: #{user.id}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              <UserIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <div className="text-gray-400 font-medium">Username</div>
                                <div className="font-mono font-bold text-gray-900 dark:text-white mt-0.5">{user.username}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              <EnvelopeIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <div className="text-gray-400 font-medium">Email Address</div>
                                <div className="font-bold text-gray-900 dark:text-white mt-0.5 select-all">{user.email}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              <IdentificationIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <div className="text-gray-400 font-medium">Nomor Karyawan</div>
                                <div className="font-semibold text-gray-900 dark:text-white mt-0.5">
                                  {user.employee_number || <span className="text-gray-400 italic">Tidak diisi</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              <BuildingOfficeIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <div className="text-gray-400 font-medium">Department</div>
                                <div className="font-semibold text-gray-900 dark:text-white mt-0.5">
                                  {user.department || <span className="text-gray-400 italic">Tidak diisi</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              <PhoneIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <div className="text-gray-400 font-medium">Nomor HP / Whatsapp</div>
                                <div className="font-semibold text-gray-900 dark:text-white mt-0.5 select-all">
                                  {user.phone || <span className="text-gray-400 italic">Tidak diisi</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              <ShieldCheckIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <div className="text-gray-400 font-medium">Role yang Diminta</div>
                                <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{user.requested_role}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-full ${confirmModal.action === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {confirmModal.action === 'approve' ? <CheckIcon className="w-6 h-6" /> : <XMarkIcon className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {confirmModal.action === 'approve' ? 'Setujui Pendaftaran Akun?' : 'Tolak Pendaftaran Akun?'}
                </h3>
                <p className="text-xs text-gray-500">Konfirmasi aksi verifikasi pengguna</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/60 rounded-xl p-3.5 text-xs space-y-1.5 mb-5 border border-gray-200 dark:border-gray-700">
              <div><strong>Nama:</strong> {confirmModal.user.full_name}</div>
              <div><strong>Username:</strong> @{confirmModal.user.username}</div>
              <div><strong>Email:</strong> {confirmModal.user.email}</div>
              <div><strong>Role:</strong> {confirmModal.user.requested_role}</div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-6">
              {confirmModal.action === 'approve'
                ? 'Setelah disetujui, akun ini akan menjadi AKTIF dan pengguna dapat langsung melakukan login ke sistem ERP.'
                : 'Pendaftaran ini akan DITOLAK dan data pendaftaran pengguna akan dihapus permanen dari sistem.'}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleActionConfirm}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-md transition-all duration-150 ${
                  confirmModal.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmModal.action === 'approve' ? 'Ya, Setujui Akun' : 'Ya, Tolak Pendaftaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingUserTable;
