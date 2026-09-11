// Shared antara SalesForecastList, SalesForecastGrid & PeriodSelectModal.
// Rombak putaran 6 (2026-08-25, keputusan manajemen - grid rolling + bisa geser lihat
// histori): forecast tidak lagi punya window 12-bulan tetap per header - kolom grid
// sekarang bulan KALENDER ASLI ("YYYY-MM" string dari backend), bebas digeser ke bulan
// manapun. Helper di sini kerja langsung dengan string "YYYY-MM", bukan lagi index slot
// relatif ke period_start.
export const MONTH_LABELS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// "2026-08" -> "Agu '26"
export function periodLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  return `${MONTH_LABELS_ID[m - 1]} '${String(y).slice(2)}`;
}

// "2026-08" -> "Agustus 2026"
export function periodLabelFull(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${FULL[m - 1]} ${y}`;
}

// Geser "YYYY-MM" sebanyak `delta` bulan (boleh negatif) -> "YYYY-MM" baru.
export function shiftPeriod(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Bulan kalender berjalan hari ini, format "YYYY-MM" - dipakai sebagai default rolling.
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtMonth(iso: string) {
  const d = new Date(iso);
  return `${MONTH_LABELS_ID[d.getMonth()]} ${d.getFullYear()}`;
}
