import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import ImportExcelModal from './ImportExcelModal'

// Yang dijaga di sini adalah janji "ada pratinjau saat unggah": berkas yang
// dipilih langsung diperiksa TANPA menyimpan, dan baris yang akan benar-benar
// tersimpan tidak boleh tenggelam di antara ratusan baris yang dilewati.

vi.mock('../utils/axiosConfig', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('./ui/Toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

import axiosInstance from '../utils/axiosConfig'

const JENIS = {
  key: 'employee',
  label: 'Karyawan',
  description: 'Master karyawan.',
  can_import: true,
  can_export: true,
  columns: [
    { field: 'employee_number', label: 'Nomor Karyawan', required: true },
    { field: 'first_name', label: 'Nama Depan', required: true },
  ],
  summary_columns: [
    { key: 'number', label: 'Nomor', type: 'text' },
    { key: 'name', label: 'Nama', type: 'text' },
    { key: 'action', label: 'Tindakan', type: 'text' },
  ],
}

const baris = (no: number, nomor: string, action: string | null, errors: string[] = []) => ({
  key: `__row${no}`,
  number: null,
  rows: [no],
  errors,
  created: null,
  summary: action ? { number: nomor, name: `Orang ${nomor}`, action } : null,
})

/** Dua dilewati, satu baru, satu dilengkapi - dan yang dilewati ada di awal berkas. */
const HASIL = {
  committed: false,
  transactions: [
    baris(2, 'FSN-001', null, ['Baris 2: Karyawan FSN-001 sudah ada dan tidak ada isian kosong yang bisa dilengkapi']),
    baris(3, 'FSN-002', null, ['Baris 3: Karyawan FSN-002 sudah ada dan tidak ada isian kosong yang bisa dilengkapi']),
    baris(4, 'FSN-003', 'Karyawan baru'),
    baris(5, 'FSN-004', 'Lengkapi: Departemen, NPWP'),
  ],
  summary: { total: 4, ok: 2, error: 2, amount: 0 },
}

const pilihBerkas = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['x'], 'karyawan.xlsx')
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled())
}

const barisTabel = () =>
  Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.textContent || '')

beforeEach(() => {
  vi.mocked(axiosInstance.get).mockResolvedValue({ data: { kinds: [JENIS] } } as any)
  vi.mocked(axiosInstance.post).mockResolvedValue({ data: HASIL } as any)
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

const buka = () => render(<ImportExcelModal kind="employee" satuan="karyawan" open onClose={() => {}} />)

describe('ImportExcelModal', () => {
  it('berkas yang dipilih langsung diperiksa, bukan disimpan', async () => {
    buka()
    await pilihBerkas()

    const form = vi.mocked(axiosInstance.post).mock.calls[0][1] as FormData
    expect(form.get('commit')).toBe('0')
    expect(await screen.findByText(/belum ada yang disimpan/i)).toBeInTheDocument()
  })

  it('ringkasannya menyebut apa yang akan terjadi, bukan cuma jumlahnya', async () => {
    buka()
    await pilihBerkas()

    const ringkas = await screen.findByText(/belum ada yang disimpan/i)
    expect(ringkas.textContent).toContain('1 karyawan baru')
    expect(ringkas.textContent).toContain('1 lengkapi')
    expect(ringkas.textContent).toContain('2 dilewati')
  })

  it('baris yang akan tersimpan didahulukan meski di berkas ada di bawah', async () => {
    buka()
    await pilihBerkas()
    await screen.findByText(/belum ada yang disimpan/i)

    const isi = barisTabel()
    expect(isi).toHaveLength(4)
    expect(isi[0]).toContain('FSN-003')      // baris 4 di berkas
    expect(isi[1]).toContain('FSN-004')      // baris 5 di berkas
    expect(isi[2]).toContain('sudah ada')    // yang dilewati turun ke bawah
  })

  it('baris yang dilewati bisa disembunyikan', async () => {
    buka()
    await pilihBerkas()
    await screen.findByText(/belum ada yang disimpan/i)

    fireEvent.click(screen.getByLabelText(/sembunyikan 2 baris yang dilewati/i))
    const isi = barisTabel()
    expect(isi).toHaveLength(2)
    expect(isi.join(' ')).not.toContain('sudah ada')
  })

  it('tombol simpan menyebut jumlahnya dan baru mengirim commit setelah ditekan', async () => {
    buka()
    await pilihBerkas()

    const simpan = await screen.findByRole('button', { name: /simpan 2 karyawan/i })
    expect(vi.mocked(axiosInstance.post)).toHaveBeenCalledTimes(1)

    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: { ...HASIL, committed: true, summary: { ...HASIL.summary } },
    } as any)
    fireEvent.click(simpan)

    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(2))
    const form = vi.mocked(axiosInstance.post).mock.calls[1][1] as FormData
    expect(form.get('commit')).toBe('1')
    expect(await screen.findByText(/sudah disimpan/i)).toBeInTheDocument()
  })

  it('tidak bisa menyimpan sebelum ada berkas yang diperiksa', () => {
    buka()
    expect(screen.getByRole('button', { name: /^simpan$/i })).toBeDisabled()
  })

  it('kolom wajib ditandai bintang di daftar kolom', async () => {
    buka()
    const daftar = await screen.findByText(/daftar kolom/i)
    fireEvent.click(daftar)
    expect(within(daftar.closest('details')!).getByText(/Nomor Karyawan\*/)).toBeInTheDocument()
  })
})
