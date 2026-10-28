// Satuan hasil produksi per jenis mesin converting (sesuai label di form input).
export const UNIT_BY_TYPE: Record<string, string> = {
  slitting: 'kg',
  perforating: 'kg',
  cutting: 'kg',
  folding: 'pcs',
  bagmaker: 'pcs',
}

export const unitFor = (machineType?: string | null) => (machineType ? UNIT_BY_TYPE[machineType] || '' : '')

export const fmtQty = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })

export const qtyWithUnit = (n: number | string | null | undefined, machineType?: string | null) => {
  const unit = unitFor(machineType)
  return unit ? `${fmtQty(n)} ${unit}` : fmtQty(n)
}
