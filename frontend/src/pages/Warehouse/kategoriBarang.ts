/**
 * Kelompok barang untuk penyaring dan lencana "Kategori" di modul Gudang.
 *
 * Dulu tiap halaman menyalin daftarnya sendiri dan hanya mengenali kode
 * kategori kecil-kecil peninggalan Falmaco ('chemical', 'spunbond', ...).
 * Masterdata Fengsheng datang dari Accurate dengan kategori huruf besar
 * ('BAHAN KIMIA', 'BAHAN BAKU', 'BAHAN PEMBANTU'), jadi tidak ada satu pun
 * yang cocok: memilih "Bahan Kimia" mengembalikan 0 baris padahal stoknya ada,
 * dan semua barang jatuh ke "Lainnya" (dilaporkan 2026-11-24).
 *
 * Urutannya: KATEGORI dulu, `material_type` hanya sebagai cadangan saat
 * kategorinya bukan salah satu kode lama. Bukan "mana saja yang cocok" - di
 * Falmaco `material_type` tidak bisa dipercaya (65 barang berkategori 'stc'
 * bertipe 'packaging_materials', dan 'RAW_MATERIALS' huruf besar dipakai
 * sebagai penampung umum), jadi mendahulukannya akan memindahkan barang
 * Falmaco ke kelompok yang salah.
 *
 * Nilai kuncinya harus sama dengan `KATEGORI_LAMA` / `JENIS_BARANG` di
 * `backend/routes/warehouse.py` - itu yang menyaring di sisi server.
 */

export type KelompokBarang = 'kain' | 'packaging' | 'aksesoris' | 'chemical' | 'bahan_baku' | 'lainnya'

const KATEGORI_LAMA: Record<Exclude<KelompokBarang, 'lainnya'>, string[]> = {
  kain: ['main_roll', 'jumbo_roll', 'spunbond', 'meltblown', 'kain', 'nonwoven'],
  packaging: ['packaging', 'carton_box', 'inner_box', 'jerigen', 'botol'],
  aksesoris: ['stc', 'fliptop', 'plastik'],
  chemical: ['parfum', 'chemical'],
  bahan_baku: [],
}

const JENIS_BARANG: Partial<Record<KelompokBarang, string[]>> = {
  packaging: ['packaging_materials'],
  chemical: ['chemical_materials'],
  bahan_baku: ['raw_materials'],
}

export const NAMA_KELOMPOK: Record<KelompokBarang, string> = {
  kain: 'Kain',
  packaging: 'Bahan Kemas',
  aksesoris: 'Aksesoris',
  chemical: 'Bahan Kimia',
  bahan_baku: 'Bahan Baku',
  lainnya: 'Lainnya',
}

/** Pilihan dropdown, urut seperti yang dilihat pemakai. */
export const PILIHAN_KELOMPOK: { value: KelompokBarang; label: string }[] = [
  { value: 'bahan_baku', label: '🔴 Bahan Baku' },
  { value: 'chemical', label: '🟠 Bahan Kimia' },
  { value: 'packaging', label: '🟢 Bahan Kemas' },
  { value: 'kain', label: '🔵 Kain' },
  { value: 'aksesoris', label: '🟣 Aksesoris' },
  { value: 'lainnya', label: '⚪ Lainnya' },
]

/** Kelompok sebuah barang. Kategori menang; `materialType` hanya dipakai kalau
 *  kategorinya bukan kode lama. Harus sepadan dengan `_syarat_kelompok()` di
 *  `backend/routes/warehouse.py` - kalau tidak, lencana di tabel menyebut satu
 *  kelompok sementara penyaringnya menjaring kelompok lain. */
export const kelompokBarang = (category?: string | null, materialType?: string | null): KelompokBarang => {
  const kat = (category || '').toLowerCase()
  for (const [kelompok, daftar] of Object.entries(KATEGORI_LAMA)) {
    if (daftar.includes(kat)) return kelompok as KelompokBarang
  }
  const jenis = (materialType || '').toLowerCase()
  for (const [kelompok, daftar] of Object.entries(JENIS_BARANG)) {
    if (daftar!.includes(jenis)) return kelompok as KelompokBarang
  }
  return 'lainnya'
}

export const namaKelompokBarang = (category?: string | null, materialType?: string | null) =>
  NAMA_KELOMPOK[kelompokBarang(category, materialType)]

export const warnaKelompokBarang = (category?: string | null, materialType?: string | null) => {
  switch (kelompokBarang(category, materialType)) {
    case 'kain':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'packaging':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'aksesoris':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    case 'chemical':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'bahan_baku':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
  }
}

const NAMA_KATEGORI: Record<string, string> = {
  main_roll: 'Main Roll', jumbo_roll: 'Jumbo Roll', spunbond: 'Spunbond', meltblown: 'Melt Blown',
  kain: 'Kain', nonwoven: 'Nonwoven', packaging: 'Packaging', carton_box: 'Carton Box',
  inner_box: 'Inner Box', jerigen: 'Jerigen', botol: 'Botol', stc: 'STC', fliptop: 'Fliptop',
  plastik: 'Plastik', parfum: 'Parfum', chemical: 'Chemical', tissue: 'Tissue', other_raw: 'Raw Material',
}

/** Kategori apa adanya untuk baris kedua lencana. Kategori Accurate huruf besar
 *  dirapikan jadi huruf kapital di awal kata supaya tidak berteriak di tabel. */
export const namaKategoriBarang = (category?: string | null) => {
  const kat = (category || '').trim()
  if (!kat) return '-'
  return NAMA_KATEGORI[kat.toLowerCase()]
    || (kat === kat.toUpperCase()
      ? kat.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
      : kat)
}
