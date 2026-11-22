import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motionEnabled } from '../../utils/motion'

const PATTERN = /^(\D*?)(-?\d[\d.]*(?:,\d+)?)(\D*)$/

function parse(value: string | number) {
  const text = String(value)
  const m = PATTERN.exec(text.trim())
  if (!m) return null
  const [, prefix, num, suffix] = m

  let decimals: number
  let target: number
  if (num.includes(',')) {
    // Format Indonesia: titik ribuan, koma desimal.
    decimals = num.split(',')[1].length
    target = parseFloat(num.replace(/\./g, '').replace(',', '.'))
  } else {
    // Sebagian halaman mengirim angka gaya Inggris ("100.0%"). Dulu titiknya
    // dianggap pemisah ribuan sehingga 100,0% dipajang jadi 1.000% - salah
    // sepuluh kali lipat (2026-11-22). Titik di akhir yang hanya diikuti satu
    // atau dua angka pasti desimal; tiga angka berarti ribuan.
    const desimal = /\.(\d{1,2})$/.exec(num)
    decimals = desimal ? desimal[1].length : 0
    target = desimal
      ? parseFloat(num.slice(0, num.length - desimal[0].length).replace(/\./g, '') + '.' + desimal[1])
      : parseFloat(num.replace(/\./g, ''))
  }
  if (!isFinite(target)) return null
  return { prefix, suffix, decimals, target }
}

/**
 * Angka KPI menghitung naik dari 0 (atau dari nilai sebelumnya) dalam sekejap.
 * Teks yang bukan angka berformat Indonesia, atau animasi dimatikan, ditampilkan apa adanya.
 */
export default function AnimatedValue({ value }: { value: ReactNode }) {
  const primitive = typeof value === 'string' || typeof value === 'number'
  const [shown, setShown] = useState<string | number>(primitive ? (value as string | number) : '')
  const prev = useRef<number>(0)
  const frame = useRef<number>()

  useEffect(() => {
    if (!primitive) return
    const v = value as string | number
    const p = parse(v)
    if (!p || !motionEnabled() || p.target === 0 || Math.abs(p.target) < 1) {
      setShown(v)
      if (p) prev.current = p.target
      return
    }
    const from = prev.current
    const to = p.target
    const duration = from === 0 ? 700 : 400
    const fmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals })
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(`${p.prefix}${fmt.format(from + (to - from) * eased)}${p.suffix}`)
      if (t < 1) frame.current = requestAnimationFrame(tick)
      else prev.current = to
    }
    frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current) cancelAnimationFrame(frame.current) }
  }, [value, primitive])

  return <>{primitive ? shown : value}</>
}
