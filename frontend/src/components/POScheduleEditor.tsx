import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import NumberInput from './ui/NumberInput'

export interface POSchedule {
  id?: number
  expected_date: string
  quantity: number | string
  notes?: string | null
}

interface Props {
  quantity: number
  uom?: string
  value: POSchedule[]
  onChange: (next: POSchedule[]) => void
  disabled?: boolean
}

export default function POScheduleEditor({ quantity, uom, value, onChange, disabled }: Props) {
  const total = value.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const over = total > Number(quantity || 0) + 0.0001
  const update = (i: number, patch: Partial<POSchedule>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const remaining = Math.max(0, Number(quantity || 0) - total)

  return (
    <div className="mt-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Jadwal kedatangan (opsional, boleh bertahap)</p>
        {!disabled && (
          <button
            type="button"
            className="text-sm text-emerald-700 hover:underline inline-flex items-center gap-1"
            onClick={() => onChange([...value, { expected_date: '', quantity: remaining || '' }])}
          >
            <PlusIcon className="h-4 w-4" /> Tambah jadwal
          </button>
        )}
      </div>
      {value.length === 0 && <p className="text-xs text-gray-500">Belum ada jadwal. Tanggal dibutuhkan PO berlaku untuk seluruh jumlah.</p>}
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
          <input
            type="date"
            className="input-field col-span-4"
            value={r.expected_date || ''}
            disabled={disabled}
            onChange={(e) => update(i, { expected_date: e.target.value })}
          />
          <div className="col-span-3">
            <NumberInput
              className="input-field"
              value={r.quantity as any}
              disabled={disabled}
              onChange={(e: any) => update(i, { quantity: e.target.value })}
              placeholder="Jumlah"
            />
          </div>
          <span className="col-span-1 text-xs text-gray-500">{uom}</span>
          <input
            type="text"
            className="input-field col-span-3"
            value={r.notes || ''}
            disabled={disabled}
            placeholder="Catatan"
            maxLength={255}
            onChange={(e) => update(i, { notes: e.target.value })}
          />
          {!disabled && (
            <button type="button" className="col-span-1 btn-danger p-2" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {value.length > 0 && (
        <p className={`text-xs ${over ? 'text-red-600' : 'text-gray-500'}`}>
          Terjadwal {total.toLocaleString('id-ID')} dari {Number(quantity || 0).toLocaleString('id-ID')} {uom}
          {over ? ' (melebihi jumlah pesanan)' : remaining > 0 ? `, sisa ${remaining.toLocaleString('id-ID')} belum dijadwalkan` : ''}
        </p>
      )}
    </div>
  )
}

export type ScheduleStatus = 'done' | 'partial' | 'late' | 'waiting'

// Receipts fill the earliest schedules first; the rest are judged by date.
export function scheduleStatuses(schedules: POSchedule[], received: number, today = new Date().toISOString().slice(0, 10)) {
  let left = Number(received) || 0
  return schedules.map((s) => {
    const q = Number(s.quantity) || 0
    const got = Math.min(left, q)
    left -= got
    let status: ScheduleStatus = 'waiting'
    if (got >= q - 0.0001) status = 'done'
    else if (s.expected_date < today) status = 'late'
    else if (got > 0) status = 'partial'
    return { received: got, status }
  })
}
