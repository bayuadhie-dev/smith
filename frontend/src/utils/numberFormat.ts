// Indonesian number formatting for inputs: thousands '.', decimals ','.
// "raw" is the machine value the rest of the app sees: '-1234.5' (dot decimal, no grouping).

export interface NumberFormatOptions {
  currency?: boolean
  maxDecimals?: number
  allowNegative?: boolean
}

export function formatRawNumber(raw: string | number | null | undefined, opts: NumberFormatOptions = {}): string {
  if (raw === null || raw === undefined || raw === '') return ''
  let s = String(raw)
  if (/e/i.test(s)) {
    const n = Number(s)
    if (!isFinite(n)) return ''
    s = n.toFixed(opts.maxDecimals ?? 6)
  }
  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)
  const [intPartRaw, decPart] = s.split('.')
  // A lone '-' (user is about to type a negative number) stays '-' instead of becoming '-0'.
  if (negative && !intPartRaw && decPart === undefined) return opts.currency ? 'Rp -' : '-'
  const intPart = (intPartRaw || '0').replace(/\D/g, '') || '0'
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  let out = grouped
  if (decPart !== undefined) out += ',' + decPart.replace(/\D/g, '')
  if (negative) out = '-' + out
  return opts.currency ? 'Rp ' + out : out
}

// Parse what the user typed (display text) into a raw string. Keeps a trailing decimal separator
// so the user can keep typing ("12," -> raw "12.").
export function parseDisplayNumber(text: string, opts: NumberFormatOptions = {}): string {
  const maxDecimals = opts.maxDecimals ?? 6
  let t = (text || '').replace(/^\s*Rp\s*/i, '').replace(/\s/g, '')
  const negative = (opts.allowNegative ?? true) && t.startsWith('-')
  t = t.replace(/-/g, '')
  // The formatter inserts '.' as thousands separator; a '.' only counts as decimal when it is the last
  // character typed, decimals are allowed and there is no ',' yet.
  const comma = t.indexOf(',')
  let intText: string
  let decText: string | undefined
  if (comma >= 0) {
    intText = t.slice(0, comma)
    decText = t.slice(comma + 1)
  } else if (maxDecimals > 0 && t.endsWith('.') && t.indexOf('.') === t.length - 1) {
    intText = t.slice(0, -1)
    decText = ''
  } else {
    intText = t
  }
  intText = intText.replace(/\D/g, '')
  if (decText !== undefined) decText = decText.replace(/\D/g, '').slice(0, maxDecimals)
  if (maxDecimals === 0) decText = undefined
  if (intText === '' && decText === undefined) return negative ? '-' : ''
  const intNorm = intText === '' ? '0' : intText.replace(/^0+(?=\d)/, '')
  return (negative ? '-' : '') + intNorm + (decText !== undefined ? '.' + decText : '')
}
