/** Status mesin: satu daftar yang dipakai halaman Mesin, detail, dan formulirnya. */
export const MACHINE_STATUSES = ['idle', 'running', 'maintenance', 'breakdown', 'offline'] as const
export type MachineStatus = (typeof MACHINE_STATUSES)[number]

const LABEL: Record<string, string> = {
  idle: 'Siap',
  running: 'Jalan',
  maintenance: 'Perawatan',
  breakdown: 'Rusak',
  offline: 'Tidak Dipakai',
}

/** Penjelasan singkat, dipakai sebagai tooltip dan keterangan di formulir. */
export const MACHINE_STATUS_HINT: Record<string, string> = {
  idle: 'Siap dipakai, sedang tidak ada produksi. Terisi otomatis saat SPK selesai.',
  running: 'Sedang produksi. Terisi otomatis saat SPK dimulai.',
  maintenance: 'Sedang dirawat. Terisi otomatis dari modul Perawatan.',
  breakdown: 'Rusak dan tidak bisa dipakai.',
  offline: 'Tidak dipakai untuk sementara, misalnya menunggu relokasi.',
}

export const machineStatusLabel = (s?: string | null) => LABEL[(s || '').toLowerCase()] || s || '-'
