import React, { useState } from 'react'
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon
,
  PlusIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useGetReturnsQuery, useGetReturnAnalyticsQuery } from '../../services/returnsApi'
import { useUrlFilter, useUrlPage } from '../../hooks/useUrlState'
import { KpiStrip, PageHeader } from '../../components/ui/PageKit'
export default function ReturnsDashboard() {
    const { t } = useLanguage();

const [page, setPage] = useUrlPage()
  const [searchTerm, setSearchTerm] = useUrlFilter<string>('cari', '')
  const [statusFilter, setStatusFilter] = useUrlFilter<string>('status', '')
  const [qcStatusFilter, setQcStatusFilter] = useUrlFilter<string>('qc', '')

  const { data: returnsData, isLoading, refetch } = useGetReturnsQuery({
    page,
    per_page: 20,
    status: statusFilter || undefined,
    qc_status: qcStatusFilter || undefined
  })

  const { data: analytics } = useGetReturnAnalyticsQuery() as any

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return <ClockIcon className="h-5 w-5 text-blue-500" />
      case 'qc_pending': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
      case 'qc_approved': return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'qc_rejected': return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'processed': return <CheckCircleIcon className="h-5 w-5 text-blue-500" />
      default: return <ClockIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'received':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`
      case 'qc_pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`
      case 'qc_approved':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`
      case 'qc_rejected':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`
      case 'processed':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`
    }
  }

  const getQCStatusBadge = (qcStatus: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (qcStatus) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`
      case 'passed':
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`
      case 'failed':
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`
    }
  }

  const labelStatus: Record<string, string> = {
    received: 'Diterima',
    qc_pending: 'Menunggu QC',
    qc_approved: 'Lolos QC',
    qc_rejected: 'Ditolak QC',
    processed: 'Selesai diproses',
  };

  const labelQc: Record<string, string> = {
    pending: 'Menunggu',
    passed: 'Lolos',
    approved: 'Lolos',
    failed: 'Tidak lolos',
    rejected: 'Tidak lolos',
  };

  const ringkasan = (analytics as any)?.summary;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="PENJUALAN · RETUR"
        title="Retur Pelanggan"
        subtitle="Barang yang dikembalikan pelanggan beserta pemeriksaan QC-nya."
        actions={
          <Link
            to="/app/returns/new"
            className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <PlusIcon className="h-4 w-4" />
            Retur baru
          </Link>
        }
      />

      {ringkasan && (
        <KpiStrip
          items={[
            { label: 'Total retur', value: Number(ringkasan.total_returns || 0).toLocaleString('id-ID'), hint: 'Seluruh periode' },
            {
              label: 'Menunggu QC',
              value: Number(ringkasan.pending_qc || 0).toLocaleString('id-ID'),
              tone: Number(ringkasan.pending_qc || 0) > 0 ? 'warn' : undefined,
              hint: 'Belum diperiksa',
            },
            { label: 'Lolos QC', value: Number(ringkasan.approved_returns || 0).toLocaleString('id-ID'), hint: 'Bisa diproses' },
            {
              label: 'Ditolak QC',
              value: Number(ringkasan.rejected_returns || 0).toLocaleString('id-ID'),
              tone: Number(ringkasan.rejected_returns || 0) > 0 ? 'bad' : undefined,
              hint: 'Tidak bisa dijual lagi',
            },
            {
              label: 'Tingkat kelolosan',
              // Dikirim gaya Inggris ("0.0"), jadi dikoma-kan supaya terbaca
              // benar di layar.
              value: `${Number(ringkasan.qc_approval_rate || 0).toFixed(1).replace('.', ',')}%`,
              hint: 'Dari retur yang sudah diperiksa',
            },
          ]}
        />
      )}

      <div className="fn-card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor retur atau pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Semua status</option>
          <option value="received">Diterima</option>
          <option value="qc_pending">Menunggu QC</option>
          <option value="qc_approved">Lolos QC</option>
          <option value="qc_rejected">Ditolak QC</option>
          <option value="processed">Selesai diproses</option>
        </select>

        <select
          value={qcStatusFilter}
          onChange={(e) => setQcStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Semua hasil QC</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Lolos</option>
          <option value="rejected">Tidak lolos</option>
        </select>

        <button
          onClick={() => refetch()}
          className="fn-press inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          title="Muat ulang"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Muat ulang
        </button>
      </div>

      <div className="fn-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Sebelumnya lima judul kolom ini kosong melompong - sisa
                  pemindahan ke berkas terjemahan yang tidak pernah selesai. */}
              <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                <th className="fn-label px-4 py-2.5 text-left">Nomor retur</th>
                <th className="fn-label px-4 py-2.5 text-left">Pelanggan</th>
                <th className="fn-label px-4 py-2.5 text-left">Tanggal</th>
                <th className="fn-label px-4 py-2.5 text-left">Alasan</th>
                <th className="fn-label px-4 py-2.5 text-left">Status</th>
                <th className="fn-label px-4 py-2.5 text-left">Hasil QC</th>
                <th className="fn-label px-4 py-2.5 text-right">Jumlah barang</th>
                <th className="fn-label px-4 py-2.5 text-right">Nilai</th>
                <th className="fn-label px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">Memuat retur...</td></tr>
              ) : returnsData?.returns.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">Belum ada retur yang cocok dengan penyaringnya.</td></tr>
              ) : (
                returnsData?.returns.map((returnItem) => (
                  <tr key={returnItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(returnItem.status)}
                        <span className="font-medium text-gray-900 dark:text-white">{returnItem.return_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{returnItem.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(returnItem.return_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{returnItem.reason}</td>
                    <td className="px-4 py-3">
                      <span className={getStatusBadge(returnItem.status)}>
                        {labelStatus[returnItem.status] || returnItem.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {returnItem.qc_required ? (
                        <span className={getQCStatusBadge(returnItem.qc_status || 'pending')}>
                          {labelQc[returnItem.qc_status || 'pending'] || returnItem.qc_status}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Tidak perlu QC</span>
                      )}
                    </td>
                    <td className="fn-num px-4 py-3 text-right text-gray-900 dark:text-white">{returnItem.total_items}</td>
                    <td className="fn-num px-4 py-3 text-right text-gray-900 dark:text-white">
                      Rp {returnItem.total_value.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/returns/${returnItem.id}`} className="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                        Rincian
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {returnsData && returnsData.pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-200/70 px-4 py-3 dark:border-gray-700/70">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Halaman <span className="font-medium">{page}</span> dari <span className="font-medium">{returnsData.pages}</span>
            </p>
            {/* Dua tombol halaman ini dulu tidak punya tulisan sama sekali. */}
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="fn-press rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(Math.min(returnsData.pages, page + 1))}
                disabled={page === returnsData.pages}
                className="fn-press rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
