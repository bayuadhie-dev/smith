import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AnimatedValue from './AnimatedValue'

/**
 * Angka KPI sempat dipajang sepuluh kali lipat: halaman yang mengirim
 * "100.0%" (gaya Inggris) terbaca sebagai seratus ribu per seratus, lalu
 * ditulis ulang jadi "1.000%". Tes ini menjaga kedua gaya tetap benar.
 */
describe('AnimatedValue', () => {
  it('tidak mengubah persen gaya Inggris jadi ribuan', () => {
    render(<AnimatedValue value="100.0%" />)
    expect(screen.getByText(/100[.,]0%/)).toBeTruthy()
    expect(screen.queryByText('1.000%')).toBeNull()
  })

  it('menghormati titik ribuan gaya Indonesia', () => {
    const { container } = render(<AnimatedValue value="Rp 58.767.958.784" />)
    expect(container.textContent).toMatch(/58\.767\.958\.78\d/)
  })

  it('membiarkan teks biasa apa adanya', () => {
    render(<AnimatedValue value="-" />)
    expect(screen.getByText('-')).toBeTruthy()
  })
})
