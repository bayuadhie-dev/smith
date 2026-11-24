/**
 * Tiap deploy, nama berkas potongan kode (chunk) berubah. Tab yang sudah
 * terbuka sejak sebelum deploy masih memegang daftar nama yang lama, jadi
 * begitu pindah halaman impor-nya gagal dan React melempar - yang terlihat
 * oleh pemakai sebagai "Oops! Terjadi Kesalahan" di banyak halaman sekaligus,
 * padahal aplikasinya sehat. (Dilaporkan 2026-11-24.)
 *
 * Muat ulang sekali saja: index.html yang baru menunjuk nama yang benar.
 * Penanda di sessionStorage menjaga supaya tidak berputar kalau penyebab
 * gagalnya ternyata bukan itu - mis. berkasnya memang rusak, atau jaringan
 * mati. Penanda dibersihkan begitu ada satu impor yang berhasil.
 */
export const KUNCI_MUAT_ULANG = 'chunk-dimuat-ulang'

const aman = {
  baca: () => {
    try { return sessionStorage.getItem(KUNCI_MUAT_ULANG) } catch { return null }
  },
  tulis: () => {
    try { sessionStorage.setItem(KUNCI_MUAT_ULANG, '1') } catch { /* mode privat */ }
  },
  hapus: () => {
    try { sessionStorage.removeItem(KUNCI_MUAT_ULANG) } catch { /* mode privat */ }
  },
}

export const muat = <T,>(impor: () => Promise<T>): Promise<T> =>
  impor().then((m) => {
    aman.hapus()
    return m
  }).catch((e) => {
    if (aman.baca()) throw e          // sudah pernah dicoba, jangan berputar
    aman.tulis()
    window.location.reload()
    return new Promise<T>(() => {})   // tertahan: halaman sedang dimuat ulang
  })
