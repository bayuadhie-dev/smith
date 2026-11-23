import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import toast from 'react-hot-toast'
import { ToastProvider } from './Toast'

// Kegagalan yang sama sering terjadi berkali-kali: pemakai mengklik ulang,
// beberapa baris gagal sekaligus, atau backend sedang restart. Dulu itu
// menumpuk jadi tumpukan toast dengan tulisan identik (dilaporkan 2026-11-23,
// empat "Gagal memuat jurnal transfer" bertumpuk).

const tunggu = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60))
  })
}

afterEach(() => {
  act(() => toast.remove())
  cleanup()
})

describe('ToastProvider', () => {
  it('pesan yang sama persis hanya tampil satu kali', async () => {
    render(<ToastProvider />)

    await act(async () => {
      for (let i = 0; i < 6; i++) toast.error('Gagal memuat jurnal transfer')
    })
    await tunggu()

    expect(screen.getAllByText('Gagal memuat jurnal transfer')).toHaveLength(1)
  })

  it('pesan yang berbeda tetap tampil sendiri-sendiri', async () => {
    render(<ToastProvider />)

    await act(async () => {
      toast.error('Gagal memuat jurnal transfer')
      toast.error('Gagal membatalkan transfer')
    })
    await tunggu()

    expect(screen.getByText('Gagal memuat jurnal transfer')).toBeInTheDocument()
    expect(screen.getByText('Gagal membatalkan transfer')).toBeInTheDocument()
  })

  it('tidak lebih dari tiga toast menumpuk di layar', async () => {
    render(<ToastProvider />)

    await act(async () => {
      for (let i = 1; i <= 7; i++) toast.error(`Kesalahan nomor ${i}`)
    })
    await tunggu()

    // Yang kelebihan di-dismiss; react-hot-toast membuangnya dari DOM
    // sekitar sedetik kemudian. Setelah itu yang tersisa adalah yang
    // benar-benar dilihat pemakai.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300))
    })

    const tersisa = document.querySelectorAll('[role="status"]')
    expect(tersisa.length).toBeLessThanOrEqual(3)
  })
})
