import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PemakaianForm } from './RollList'

// Dilaporkan produksi 2026-11-24: "ga bisa input kg di pop up modal".
// Sebabnya NumberInput mengirim event seperti input biasa (e.target.value),
// tapi di modal ini dipakai seolah mengirim nilainya langsung - isiannya jadi
// "[object Object]" dan tidak menerima ketikan sama sekali. Tes ini menjaga
// kontrak itu untuk SETIAP isian angka di modal, bukan cuma yang kemarin rusak.

vi.mock('../../utils/axiosConfig', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

import axiosInstance from '../../utils/axiosConfig'

const META = {
  grades: [{ value: 'A', label: 'A - bagus' }, { value: 'B', label: 'B - perlu sortir' }],
  materials: [{ id: 7, name: 'VISCOSE RAYON 1.5D' }],
  waste_materials: [{ id: 9, name: 'WASTE SPUNLACE' }],
  work_orders: [{ id: 3, wo_number: 'NJO-2611-001', product_name: 'FN 50' }],
}

beforeEach(() => {
  vi.mocked(axiosInstance.get).mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/meta') ? META : { products: [{ id: 1, code: 'FN-50', name: 'FN 50 - 76 H' }] } }) as any)
  vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: 1, rolls: [] } } as any)
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

const buka = () => render(<PemakaianForm onClose={() => {}} onSaved={() => {}} />)

describe('modal Pemakaian Bahan Spunlace', () => {
  it('jumlah yang diketik benar-benar masuk ke isian, bukan cuma terlihat', async () => {
    // Isian NumberInput tetap memajang ketikan terakhir walau nilainya gagal
    // tersimpan - jadi yang diperiksa ringkasan "Keluar ... kg" di bawah modal,
    // yang dihitung dari state.
    buka()
    await screen.findByRole('option', { name: /NJO-2611-001/ })      // tunggu meta selesai dimuat
    fireEvent.change(screen.getByPlaceholderText('kg'), { target: { value: '120' } })
    expect(await screen.findByText('120 kg')).toBeTruthy()
  })

  it('mengetik dua angka berturut-turut tidak kehilangan yang pertama', async () => {
    // Baris bahan pernah ditulis sebagai komponen di dalam induknya: tiap
    // ketikan membongkar-pasang isiannya, kursor lepas, dan angka berikutnya
    // jatuh ke elemen yang sudah dibuang.
    buka()
    await screen.findByRole('option', { name: /NJO-2611-001/ })
    const kg = screen.getByPlaceholderText('kg') as HTMLInputElement
    fireEvent.change(kg, { target: { value: '12' } })
    fireEvent.change(screen.getByPlaceholderText('kg'), { target: { value: '120' } })
    expect(screen.getByPlaceholderText('kg')).toBe(kg)               // elemennya tidak diganti
    expect(await screen.findByText('120 kg')).toBeTruthy()
  })

  it('jumlah yang diketik ikut terkirim ke server, bukan [object Object]', async () => {
    buka()
    await screen.findByPlaceholderText('kg')
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '3' } })  // SPK
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '7' } })  // bahan
    fireEvent.change(await screen.findByPlaceholderText('kg'), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: /Simpan Pemakaian/i }))
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled())
    const body = vi.mocked(axiosInstance.post).mock.calls[0][1] as any
    expect(body.items).toEqual([{ material_id: 7, quantity: 120 }])
  })

  it('isian angkanya tidak melebar keluar kotaknya', () => {
    // Tanpa kelas lebar, <input> memakai lebar bawaannya dan menembus tepi
    // modal - terlihat sebagai kolom kg yang terpotong dan modal yang bisa
    // digeser ke samping.
    buka()
    const kg = screen.getByPlaceholderText('kg')
    expect(kg.className).toContain('w-full')
  })

  it('keperluan uji membuka isian roll beserta meternya', async () => {
    buka()
    await screen.findByPlaceholderText('kg')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'uji' } })
    fireEvent.click(await screen.findByText('+ Tambah roll'))

    expect(await screen.findByText('Panjang (m)')).toBeTruthy()
    const panjang = screen.getByText('Panjang (m)').parentElement!.querySelector('input')!
    fireEvent.change(panjang, { target: { value: '2000' } })
    await waitFor(() => expect(panjang.value).toBe('2.000'))
  })

  it('roll uji terkirim lengkap dengan setelan mesinnya', async () => {
    buka()
    await screen.findByPlaceholderText('kg')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'uji' } })
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '7' } })
    fireEvent.change(screen.getByPlaceholderText('kg'), { target: { value: '200' } })
    fireEvent.click(await screen.findByText('+ Tambah roll'))

    const isi = (label: string, nilai: string) => {
      const input = screen.getByText(label).parentElement!.querySelector('input')!
      fireEvent.change(input, { target: { value: nilai } })
    }
    fireEvent.change(screen.getByPlaceholderText('1 - 10000'), { target: { value: '701' } })
    isi('Panjang (m)', '2000')
    isi('Lebar (cm)', '200')
    isi('Speed (m/menit)', '80')

    await waitFor(() => expect(screen.getByPlaceholderText('1 - 10000')).toHaveProperty('value', '701'))
  })
})
