/** Jenis mesin yang dipakai di pabrik, satu daftar untuk formulir dan penyaring. */
export const MACHINE_TYPES: { value: string; label: string }[] = [
  { value: 'spunlace', label: 'Spunlace' },
  { value: 'slitting', label: 'Slitting' },
  { value: 'folding', label: 'Folding' },
  { value: 'perforating', label: 'Perforating' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'laminasi', label: 'Laminasi' },
  { value: 'bagmaker', label: 'Bagmaker' },
  { value: 'wet_wipes', label: 'Wet Wipes' },
  { value: 'printing', label: 'Printing' },
  { value: 'oven', label: 'Oven' },
  { value: 'packing', label: 'Packing' },
  { value: 'bantal', label: 'Bantal' },
  { value: 'manufacturing', label: 'Produksi Umum' },
  { value: 'auxiliary', label: 'Penunjang' },
]

const LABEL = Object.fromEntries(MACHINE_TYPES.map((t) => [t.value, t.label]))

export const machineTypeLabel = (t?: string | null) => LABEL[(t || '').toLowerCase()] || t || '-'

/** Daftar pilihan + jenis lama yang masih terpakai di data, supaya tidak hilang saat mengubah mesin. */
export const machineTypeOptions = (current?: string | null) => {
  const extra = current && !LABEL[current.toLowerCase()] ? [{ value: current, label: machineTypeLabel(current) }] : []
  return [...MACHINE_TYPES, ...extra]
}
