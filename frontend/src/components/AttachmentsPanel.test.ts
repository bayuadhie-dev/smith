import { describe, it, expect } from 'vitest'
import { pesanGagalUnggah } from './AttachmentsPanel'

// Dilaporkan Finance 2026-11-24: lampiran 1,2 MB ditolak nginx (batas bawaan
// 1 MB) sebelum sampai ke Flask. Badannya HTML, jadi `data.error` kosong dan
// layar cuma bilang "coba unggah ulang dari halaman detail" - dicoba tiga kali,
// gagal tiga kali, tanpa petunjuk apa pun.

describe('pesanGagalUnggah', () => {
  it('413 dari nginx dijelaskan sebagai ukuran, meski badannya HTML', () => {
    expect(pesanGagalUnggah({ response: { status: 413, data: '<html>413 Request Entity Too Large</html>' } }))
      .toBe('ukurannya melebihi batas unggah')
  })

  it('pesan dari backend dipakai apa adanya', () => {
    expect(pesanGagalUnggah({ response: { status: 400, data: { error: 'Tipe file tidak diizinkan' } } }))
      .toBe('Tipe file tidak diizinkan')
  })

  it('tanpa respons berarti sambungan putus, bukan ditolak', () => {
    expect(pesanGagalUnggah({ message: 'Network Error' })).toBe('sambungan ke server terputus')
  })

  it('sesi habis diarahkan ke masuk lagi', () => {
    expect(pesanGagalUnggah({ response: { status: 401, data: '' } }))
      .toContain('sesi sudah habis')
  })

  it('kode lain tetap disebut angkanya supaya bisa dilacak', () => {
    expect(pesanGagalUnggah({ response: { status: 502, data: '' } })).toBe('ditolak server (kode 502)')
  })
})
