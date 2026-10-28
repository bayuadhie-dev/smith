import React, { useLayoutEffect, useRef, useState } from 'react'
import { formatRawNumber, parseDisplayNumber } from '../../utils/numberFormat'

type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'>

export interface NumberInputProps extends NativeProps {
  value?: string | number | null
  defaultValue?: string | number | null
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Show "Rp " prefix (money fields). */
  currency?: boolean
  /** Max digits after the decimal comma. Default: 2 for currency, 6 otherwise, 0 when step is an integer. */
  decimals?: number
}

function decimalsFor(props: { currency?: boolean; decimals?: number; step?: string | number }): number {
  if (props.decimals !== undefined) return props.decimals
  const step = props.step === undefined ? undefined : String(props.step)
  if (step && /^\d+$/.test(step) && step !== '0') return props.currency ? 2 : 0
  return props.currency ? 2 : 6
}

/**
 * Text input that shows 1.234.567,89 (or "Rp 1.234.567") while typing but hands the rest of the app
 * the plain number ("1234567.89"), through a change event that looks like the native one
 * (e.target.value / e.target.name / e.target.valueAsNumber).
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, defaultValue, onChange, currency, decimals, step, min, onKeyDown, onBlur, ...rest }, ref,
) {
  const controlled = value !== undefined
  const [inner, setInner] = useState<string>(() => (defaultValue === null || defaultValue === undefined ? '' : String(defaultValue)))
  const incoming = controlled ? (value === null ? '' : String(value)) : inner
  // Parents often turn the text into a number on every keystroke (parseFloat(...) || 0), which drops what the user
  // is still typing ("12," -> 12, "0," -> ''). While the parent's value is numerically the same as what was last
  // typed, keep showing the typed text so decimals can be entered.
  const lastTyped = useRef<string | null>(null)
  const sameNumber = (a: string, b: string) => {
    const toNum = (t: string) => (t === '' || t === '-' ? 0 : Number(t.endsWith('.') ? t.slice(0, -1) || '0' : t))
    const x = toNum(a)
    const y = toNum(b)
    return Number.isFinite(x) && Number.isFinite(y) && x === y
  }
  const raw = controlled && lastTyped.current !== null && lastTyped.current !== incoming && sameNumber(lastTyped.current, incoming)
    ? lastTyped.current
    : incoming
  const maxDecimals = decimalsFor({ currency, decimals, step })
  const allowNegative = min === undefined || Number(min) < 0
  const opts = { currency, maxDecimals, allowNegative }

  const inputRef = useRef<HTMLInputElement | null>(null)
  const caretDigits = useRef<number | null>(null)

  const display = formatRawNumber(raw, opts)

  useLayoutEffect(() => {
    const el = inputRef.current
    const target = caretDigits.current
    if (!el || target === null || document.activeElement !== el) return
    caretDigits.current = null
    let pos = el.value.length
    if (target === 0) {
      const first = el.value.search(/[\d,]/)
      if (first !== -1) pos = first
    } else {
      let seen = 0
      for (let i = 0; i < el.value.length; i++) {
        if (/[\d,]/.test(el.value[i]) && ++seen === target) { pos = i + 1; break }
      }
    }
    el.setSelectionRange(pos, pos)
  })

  const emit = (e: React.ChangeEvent<HTMLInputElement>, next: string) => {
    const n = next === '' || next === '-' || next.endsWith('.') ? NaN : Number(next)
    const target = {
      name: rest.name, id: rest.id, type: 'number', value: next, valueAsNumber: n, checked: false,
    }
    const fake = { ...e, target, currentTarget: target } as unknown as React.ChangeEvent<HTMLInputElement>
    onChange?.(fake)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const before = el.value.slice(0, el.selectionStart ?? el.value.length)
    caretDigits.current = (before.match(/[\d,]/g) || []).length
    const next = parseDisplayNumber(el.value, opts)
    lastTyped.current = next
    setInner(next) // also re-renders when a controlled parent keeps the same state (e.g. 0 -> 0)
    emit(e, next)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let next = raw
    lastTyped.current = null
    if (next.endsWith('.')) next = next.slice(0, -1)
    if (next === '-') next = ''
    if (next !== raw) {
      if (!controlled) setInner(next)
      emit({ ...e, target: e.target } as unknown as React.ChangeEvent<HTMLInputElement>, next)
    }
    onBlur?.(e)
  }

  // react-hook-form mode: `register()` hands us name/onChange/onBlur/ref and reads/writes the DOM element's
  // `value` itself. The element shows the formatted text, but its `value` property reads as the raw number and
  // writing a raw number into it formats it, so react-hook-form never sees the display text.
  const domManaged = value === undefined && defaultValue === undefined && ref !== null && ref !== undefined
  const optsRef = useRef(opts)
  optsRef.current = opts
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  if (domManaged) {
    const attach = (el: HTMLInputElement | null) => {
      if (el && !(el as any).__numberInput) {
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
        ;(el as any).__numberInput = true
        Object.defineProperty(el, 'value', {
          configurable: true,
          get() { return parseDisplayNumber(desc.get!.call(el), optsRef.current) },
          set(v: unknown) { desc.set!.call(el, formatRawNumber(v === null || v === undefined ? '' : String(v), optsRef.current)) },
        })
        Object.defineProperty(el, 'valueAsNumber', {
          configurable: true,
          get() { const r = parseDisplayNumber(desc.get!.call(el), optsRef.current); return r === '' || r === '-' ? NaN : Number(r) },
        })
      }
      inputRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
    }
    const handleDom = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      const text = desc.get!.call(el) as string
      const before = text.slice(0, el.selectionStart ?? text.length)
      const digitsBefore = (before.match(/[\d,]/g) || []).length
      const formatted = formatRawNumber(parseDisplayNumber(text, optsRef.current), optsRef.current)
      if (formatted !== text) {
        desc.set!.call(el, formatted)
        let seen = 0
        let pos = formatted.length
        for (let i = 0; i < formatted.length; i++) {
          if (seen === digitsBefore) { pos = i; break }
          if (/[\d,]/.test(formatted[i])) seen++
        }
        if (seen < digitsBefore) pos = formatted.length
        el.setSelectionRange(pos, pos)
      }
      onChangeRef.current?.(e)
    }
    const handleBlurDom = (e: React.FocusEvent<HTMLInputElement>) => {
      const el = e.target
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      const raw = parseDisplayNumber(desc.get!.call(el), optsRef.current)
      const clean = raw.endsWith('.') ? raw.slice(0, -1) : raw === '-' ? '' : raw
      if (clean !== raw) desc.set!.call(el, formatRawNumber(clean, optsRef.current))
      onBlur?.(e)
    }
    return (
      <input
        {...rest}
        ref={attach}
        type="text"
        inputMode={maxDecimals > 0 ? 'decimal' : 'numeric'}
        autoComplete={rest.autoComplete ?? 'off'}
        onChange={handleDom}
        onBlur={handleBlurDom}
        onKeyDown={onKeyDown}
      />
    )
  }

  return (
    <input
      {...rest}
      ref={(el) => {
        inputRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
      }}
      type="text"
      inputMode={maxDecimals > 0 ? 'decimal' : 'numeric'}
      autoComplete={rest.autoComplete ?? 'off'}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
    />
  )
})

export default NumberInput
export { NumberInput }
