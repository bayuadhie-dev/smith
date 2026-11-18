/**
 * Penghitung permintaan HTTP yang sedang berjalan lewat axios.
 *
 * Dipakai garis muat di puncak layar (components/ui/TopProgress.tsx). Ditaruh
 * terpisah dari axiosConfig supaya berkas itu tetap soal HTTP saja, dan supaya
 * komponen tampilan tidak perlu mengenal axios.
 */
type Pendengar = (jumlah: number) => void

let jumlah = 0
const pendengar = new Set<Pendengar>()

function kabari() {
  pendengar.forEach((f) => f(jumlah))
}

export function mulaiPermintaan() {
  jumlah += 1
  kabari()
}

export function selesaiPermintaan() {
  jumlah = Math.max(0, jumlah - 1)
  kabari()
}

export function jumlahPermintaan() {
  return jumlah
}

export function langganPermintaan(f: Pendengar) {
  pendengar.add(f)
  return () => { pendengar.delete(f) }
}
