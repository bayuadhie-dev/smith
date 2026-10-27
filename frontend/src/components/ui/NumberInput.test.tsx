import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import NumberInput from './NumberInput'

function Harness({ currency = false, start = '' as string | number }: { currency?: boolean; start?: string | number }) {
  const [v, setV] = useState<string | number>(start)
  return (
    <div>
      <NumberInput data-testid="n" name="qty" value={v} currency={currency} onChange={(e) => setV(e.target.value)} />
      <span data-testid="raw">{String(v)}</span>
    </div>
  )
}

describe('NumberInput', () => {
  it('shows grouped text but keeps the raw number for the parent', () => {
    render(<Harness />)
    const input = screen.getByTestId('n') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1234567' } })
    expect(input.value).toBe('1.234.567')
    expect(screen.getByTestId('raw').textContent).toBe('1234567')
  })
  it('supports decimals typed with a comma', () => {
    render(<Harness />)
    const input = screen.getByTestId('n') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12,' } })
    expect(input.value).toBe('12,')
    fireEvent.change(input, { target: { value: '12,5' } })
    expect(input.value).toBe('12,5')
    expect(screen.getByTestId('raw').textContent).toBe('12.5')
  })
  it('prefixes Rp for currency and shows the initial value formatted', () => {
    render(<Harness currency start={2500000} />)
    expect((screen.getByTestId('n') as HTMLInputElement).value).toBe('Rp 2.500.000')
  })
  it('clears to an empty string', () => {
    render(<Harness start={5} />)
    const input = screen.getByTestId('n') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByTestId('raw').textContent).toBe('')
  })
})

import { useForm } from 'react-hook-form'

function RhfHarness({ onSubmit }: { onSubmit: (v: any) => void }) {
  const { register, handleSubmit, watch } = useForm({ defaultValues: { price: 2500000 as any, qty: '' as any } })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <NumberInput data-testid="price" currency {...register('price', { required: true, min: 1 })} />
      <NumberInput data-testid="qty" {...register('qty')} />
      <span data-testid="w">{String(watch('qty'))}</span>
      <button type="submit">go</button>
    </form>
  )
}

describe('NumberInput with react-hook-form register', () => {
  it('shows formatted defaults, formats typing and submits raw numbers', async () => {
    let submitted: any = null
    render(<RhfHarness onSubmit={(v) => { submitted = v }} />)
    const price = screen.getByTestId('price') as HTMLInputElement
    const qty = screen.getByTestId('qty') as HTMLInputElement
    expect(price.value).toBe('2500000')           // property reads raw
    expect(price.getAttribute('value') ?? '').not.toBe('2.500.000')
    fireEvent.input(qty, { target: { value: '1234,5' } })
    fireEvent.change(qty, { target: { value: '1234,5' } })
    expect(qty.value).toBe('1234.5')
    expect(screen.getByTestId('w').textContent).toBe('1234.5')
    fireEvent.click(screen.getByText('go'))
    await new Promise((r) => setTimeout(r, 20))
    expect(String(submitted.price)).toBe('2500000')
    expect(String(submitted.qty)).toBe('1234.5')
  })
  it('types a negative currency amount character by character without losing the minus', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(<Harness currency />)
    const input = screen.getByTestId('n') as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('-50000')
    expect(input.value).toBe('Rp -50.000')
    expect(screen.getByTestId('raw').textContent).toBe('-50000')
  })
})
