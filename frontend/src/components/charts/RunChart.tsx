import { useEffect, useRef, useState } from 'react'
import { Grid2X2, Waves, BarChart3 } from 'lucide-react'

/**
 * Diagram aktivitas harian dengan tiga cara baca.
 *
 * Satu rangkaian angka yang sama bisa dilihat sebagai:
 *   titik  - satu titik = satu kejadian, jadi kepadatan jam sibuk terlihat apa adanya
 *   ridge  - satu punggungan per kategori, untuk membandingkan sumbernya
 *   batang - ringkasan per rentang, paling mudah dibaca dari jauh
 *
 * Digambar di canvas, bukan SVG: ribuan titik sebagai elemen DOM membuat
 * halaman tersendat di mesin kantor. Warnanya dibaca dari variabel tema
 * perusahaan saat menggambar, jadi Falmaco dan Fengsheng tetap beda tanpa
 * kode cabang di sini.
 */

export type ChartMode = 'dots' | 'ridge' | 'bars'

export interface RidgeRow {
  label: string
  /** Angka per bucket, panjangnya sama dengan `values` utama. */
  values: number[]
  /** Jumlah untuk label kiri. Kalau kosong, dijumlahkan dari `values`. */
  total?: number
}

export interface RunChartProps {
  /** Angka per bucket, dari awal periode sampai akhir. */
  values: number[]
  /** Bucket yang belum terjadi (rencana/jadwal) - digambar pucat. */
  futureFrom?: number
  /** Indeks bucket yang bermasalah; ditandai merah. */
  bad?: number[]
  /** Label sumbu X, dibagi rata. */
  axis?: string[]
  /** Penanda "sekarang" sebagai pecahan 0..1 dari lebar. */
  now?: number | null
  /** Teks penanda garis sekarang, misal "SEKARANG 11:02". */
  nowLabel?: string
  /** Catatan kejadian: di bucket ke berapa dan apa isinya. */
  annotation?: { at: number; text: string } | null
  rows?: RidgeRow[]
  mode?: ChartMode
  onModeChange?: (m: ChartMode) => void
  height?: number
  /** Satuan untuk tooltip, misal "produksi" atau "kg". */
  unit?: string
  className?: string
}

const MODES: { value: ChartMode; label: string; Icon: typeof Grid2X2 }[] = [
  { value: 'dots', label: 'Titik', Icon: Grid2X2 },
  { value: 'ridge', label: 'Punggungan', Icon: Waves },
  { value: 'bars', label: 'Batang', Icon: BarChart3 },
]

const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const easeBack = (t: number) => {
  const c = 1.6
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))

interface Palette {
  ink: string
  /** Isi batang: cukup terlihat tanpa jadi blok hitam. */
  pale: string
  mid: string
  soft: string
  faint: string
  grid: string
  bad: string
  live: string
  surface: string
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => {
    const raw = cs.getPropertyValue(name).trim()
    return raw ? `rgb(${raw})` : fallback
  }
  const dark = document.documentElement.classList.contains('dark')
  return {
    ink: dark ? 'rgb(226 232 240)' : v('--gray-900', 'rgb(27 31 36)'),
    pale: dark ? 'rgba(226,232,240,.18)' : 'rgba(20,22,26,.10)',
    mid: dark ? 'rgba(226,232,240,.55)' : 'rgba(20,22,26,.45)',
    soft: dark ? 'rgb(148 163 184)' : v('--gray-700', 'rgb(82 88 95)'),
    faint: dark ? 'rgba(148,163,184,.35)' : 'rgba(120,128,138,.32)',
    grid: dark ? 'rgba(148,163,184,.25)' : 'rgba(120,128,138,.3)',
    bad: 'rgb(229 72 60)',
    live: v('--cta-500', 'rgb(56 115 219)'),
    surface: dark ? 'rgba(255,255,255,.04)' : 'rgba(20,22,26,.035)',
  }
}

export default function RunChart({
  values,
  futureFrom,
  bad = [],
  axis = [],
  now = null,
  nowLabel,
  annotation = null,
  rows,
  mode: modeProp,
  onModeChange,
  height = 240,
  unit = '',
  className = '',
}: RunChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const [innerMode, setInnerMode] = useState<ChartMode>('dots')
  const mode = modeProp ?? innerMode
  const setMode = (m: ChartMode) => { onModeChange ? onModeChange(m) : setInnerMode(m) }
  const [hover, setHover] = useState<{ x: number; i: number } | null>(null)
  const [redrawKey, setRedrawKey] = useState(0)

  // Tema bisa berganti (gelap/terang, perusahaan) tanpa komponen ini di-mount
  // ulang - canvas tidak ikut berubah sendiri, jadi digambar ulang di sini.
  useEffect(() => {
    const ob = new MutationObserver(() => setRedrawKey((k) => k + 1))
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-company'] })
    return () => ob.disconnect()
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const motionOn = document.documentElement.dataset.motion !== 'off'
    const pal = readPalette(wrap)
    const dpr = Math.min(3, window.devicePixelRatio || 1)

    let W = wrap.clientWidth || 600
    let H = height
    const resize = () => {
      W = wrap.clientWidth || W
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const n = values.length || 1
    const cut = futureFrom ?? n
    const badSet = new Set(bad)
    const x0 = mode === 'ridge' ? 118 : 10
    const padRight = 10
    const plotW = Math.max(40, W - x0 - padRight)
    const baseY = H - 30
    const maxVal = Math.max(1, ...values)

    const drawAxis = (alpha: number) => {
      if (!axis.length) return
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = '400 8.5px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      axis.forEach((label, i) => {
        const x = x0 + (axis.length === 1 ? 0.5 : i / (axis.length - 1)) * plotW
        ctx.fillStyle = pal.soft
        ctx.globalAlpha = alpha * 0.75
        ctx.fillText(label, x, H - 8)
        ctx.fillStyle = pal.grid
        ctx.fillRect(x - 0.5, baseY + 6, 1, 3)
      })
      ctx.restore()
    }

    // Satu titik mewakili beberapa satuan supaya kolom tertinggi tetap muat.
    const perDot = Math.max(1, Math.ceil(maxVal / 22))

    const drawDots = (t: number) => {
      ctx.clearRect(0, 0, W, H)
      drawAxis(clamp(t * 3))
      const colW = plotW / n
      for (let i = 0; i < n; i++) {
        const cx = x0 + colW * (i + 0.5)
        const future = i >= cut
        const dots = Math.min(23, Math.round(values[i] / perDot))
        for (let j = 0; j < dots; j++) {
          const cy = baseY - 5 - j * 7.1
          const lead = clamp((t - (i / n) * 0.5 - j * 0.011) / 0.28)
          if (lead <= 0) continue
          const r = easeBack(lead)
          ctx.beginPath()
          if (future) {
            ctx.fillStyle = pal.faint
            ctx.arc(cx, cy, 1.35 * r, 0, 7)
            ctx.fill()
            continue
          }
          const isBad = badSet.has(i) && j === dots - 1
          ctx.fillStyle = isBad ? pal.bad : pal.ink
          ctx.arc(cx, cy, Math.max(0.1, 2.9 * r), 0, 7)
          ctx.fill()
        }
      }
    }

    const drawBars = (t: number) => {
      ctx.clearRect(0, 0, W, H)
      drawAxis(clamp(t * 3))
      const step = plotW / n
      const bw = Math.max(2, step * 0.58)
      const d = Math.min(3.5, bw * 0.4)
      for (let i = 0; i < n; i++) {
        const future = i >= cut
        const x = x0 + i * step + (step - bw) / 2
        const lead = clamp((t - (i / n) * 0.5) / 0.5)
        const h = (values[i] / maxVal) * (H - 80) * ease(lead)
        if (h < 0.5) continue
        ctx.save()
        ctx.globalAlpha = future ? 0.4 : 1
        // bayangan tipis di kaki batang
        ctx.fillStyle = 'rgba(60,66,76,.12)'
        ctx.beginPath()
        ctx.ellipse(x + bw / 2 + 2, baseY + 1, bw * 0.9, 2, 0, 0, 7)
        ctx.fill()
        // sisi kanan dan tutup atas - memberi kesan balok, bukan garis
        ctx.fillStyle = pal.mid
        ctx.beginPath()
        ctx.moveTo(x + bw, baseY)
        ctx.lineTo(x + bw + d, baseY - d)
        ctx.lineTo(x + bw + d, baseY - h - d)
        ctx.lineTo(x + bw, baseY - h)
        ctx.fill()
        const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY)
        grad.addColorStop(0, pal.pale)
        grad.addColorStop(1, pal.mid)
        ctx.fillStyle = grad
        ctx.fillRect(x, baseY - h, bw, h)
        ctx.fillStyle = pal.surface
        ctx.beginPath()
        ctx.moveTo(x, baseY - h)
        ctx.lineTo(x + d, baseY - h - d)
        ctx.lineTo(x + bw + d, baseY - h - d)
        ctx.lineTo(x + bw, baseY - h)
        ctx.fill()
        if (badSet.has(i) && lead > 0.9) {
          ctx.fillStyle = pal.bad
          ctx.fillRect(x + bw / 2, baseY - h - 12, 1, 10)
          ctx.beginPath()
          ctx.moveTo(x + bw / 2 + 1, baseY - h - 12)
          ctx.lineTo(x + bw / 2 + 6, baseY - h - 9.5)
          ctx.lineTo(x + bw / 2 + 1, baseY - h - 7)
          ctx.fill()
        }
        ctx.restore()
      }
    }

    const ridgeRows: RidgeRow[] = rows && rows.length
      ? rows.slice(0, 6)
      : [{ label: 'Semua', values, total: values.reduce((a, b) => a + b, 0) }]

    const drawRidge = (t: number) => {
      ctx.clearRect(0, 0, W, H)
      drawAxis(clamp(t * 3))
      const slot = (H - 46) / ridgeRows.length
      ridgeRows.forEach((row, k) => {
        const b = 34 + k * slot + slot * 0.72
        const p = clamp((t - k * 0.07) / 0.65)
        if (p <= 0) return
        const pe = ease(p)
        const rowMax = Math.max(1, ...row.values)
        const amp = slot * 0.62
        const pts: [number, number][] = row.values.map((v, i) => [
          x0 + (row.values.length === 1 ? 0 : i / (row.values.length - 1)) * plotW,
          b - (v / rowMax) * amp,
        ])
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, x0 + plotW * pe + 1, H)
        ctx.clip()
        ctx.beginPath()
        ctx.moveTo(x0, b)
        pts.forEach(([x, y]) => ctx.lineTo(x, y))
        ctx.lineTo(x0 + plotW, b)
        ctx.closePath()
        ctx.fillStyle = pal.surface
        ctx.fill()
        ctx.beginPath()
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.strokeStyle = pal.ink
        ctx.lineWidth = 1.25
        ctx.lineJoin = 'round'
        ctx.stroke()
        ctx.restore()
        ctx.save()
        ctx.globalAlpha = clamp((t - k * 0.06) * 3)
        ctx.textAlign = 'left'
        ctx.font = '500 10px Onest, sans-serif'
        ctx.fillStyle = pal.soft
        ctx.fillText(row.label.slice(0, 18), 6, b - 9)
        const total = row.total ?? row.values.reduce((a, b2) => a + b2, 0)
        ctx.font = '400 8px JetBrains Mono, monospace'
        ctx.fillStyle = pal.faint
        ctx.fillText(total.toLocaleString('id-ID'), 6, b + 1)
        ctx.restore()
      })
    }

    const paint = (t: number) => {
      if (mode === 'dots') drawDots(t)
      else if (mode === 'bars') drawBars(t)
      else drawRidge(t)
    }

    const start = performance.now()
    const dur = 1100
    const frame = (ts: number) => {
      const p = motionOn ? clamp((ts - start) / dur) : 1
      paint(p)
      if (p < 1) rafRef.current = requestAnimationFrame(frame)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => {
      resize()
      paint(1)
    })
    ro.observe(wrap)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [values, rows, mode, height, futureFrom, bad, axis, redrawKey])

  const n = values.length || 1
  const hoverValue = hover ? values[hover.i] : null
  const kosong = values.length === 0 || values.every((v) => !v)

  return (
    <div className={`relative ${className}`}>
      <div className="mb-2 flex items-center justify-end gap-1">
        {MODES.map(({ value: m, label, Icon }) => (
          <button
              key={m}
              type="button"
              title={`Tampilkan sebagai ${label.toLowerCase()}`}
              onClick={() => setMode(m)}
              className={`fn-press rounded-lg p-1.5 transition-colors ${
                mode === m
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              aria-pressed={mode === m}
            >
              <Icon className="h-4 w-4" />
            </button>
        ))}
      </div>

      {/* Semua angkanya nol - lebih jujur mengatakannya daripada memajang
          bidang kosong yang terlihat seperti grafik gagal dimuat. */}
      {kosong && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-gray-400 dark:text-gray-500">
          Belum ada data pada rentang ini.
        </p>
      )}

      <div
        ref={wrapRef}
        className="relative"
        style={{ height }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - r.left
          const x0 = mode === 'ridge' ? 118 : 10
          const plotW = Math.max(40, r.width - x0 - 10)
          const i = Math.floor(((x - x0) / plotW) * n)
          setHover(i >= 0 && i < n ? { x, i } : null)
        }}
        onMouseLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} className="block" />

        {now !== null && now !== undefined && (
          <>
            <span
              className="pointer-events-none absolute top-6 w-px bg-gray-400/70 dark:bg-gray-500/70"
              style={{ left: `${10 + now * 100}%`, height: 'calc(100% - 54px)' }}
            />
            {nowLabel && (
              <span
                className="fn-label pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-2 py-1 text-white dark:bg-gray-700"
                style={{ left: `${10 + now * 100}%` }}
              >
                {nowLabel}
              </span>
            )}
          </>
        )}

        {annotation && (
          <span
            className="fn-label pointer-events-none absolute top-7 whitespace-nowrap text-red-600 dark:text-red-400"
            style={{ left: `${Math.min(70, (annotation.at / n) * 100)}%` }}
          >
            ● {annotation.text}
          </span>
        )}

        {hover && hoverValue !== null && (
          <span
            className="pointer-events-none absolute bottom-8 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[11px] text-white shadow-lg dark:bg-gray-700"
            style={{ left: hover.x }}
          >
            <b className="fn-num">{hoverValue.toLocaleString('id-ID')}</b> {unit}
            {axis.length > 0 && (
              <em className="ml-1 not-italic opacity-60">
                {axis[Math.min(axis.length - 1, Math.round((hover.i / n) * (axis.length - 1)))]}
              </em>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
