import { describe, it, expect } from 'vitest'
import { formatRawNumber, parseDisplayNumber } from './numberFormat'

describe('numberFormat', () => {
  it('formats with Indonesian separators', () => {
    expect(formatRawNumber('1234567.89')).toBe('1.234.567,89')
    expect(formatRawNumber(1000)).toBe('1.000')
    expect(formatRawNumber('')).toBe('')
    expect(formatRawNumber('-2500', { currency: true })).toBe('Rp -2.500')
    expect(formatRawNumber('12.')).toBe('12,')
  })
  it('parses typed text back to a plain number string', () => {
    expect(parseDisplayNumber('1.234.567,89')).toBe('1234567.89')
    expect(parseDisplayNumber('Rp 1.000')).toBe('1000')
    expect(parseDisplayNumber('12,')).toBe('12.')
    expect(parseDisplayNumber('007')).toBe('7')
    expect(parseDisplayNumber('1.5', { maxDecimals: 0 })).toBe('15')
    expect(parseDisplayNumber('12.', { maxDecimals: 2 })).toBe('12.')
    expect(parseDisplayNumber('-5', { allowNegative: false })).toBe('5')
    expect(parseDisplayNumber('1,23456789', { maxDecimals: 2 })).toBe('1.23')
    expect(parseDisplayNumber('abc')).toBe('')
  })
})

describe('lone minus', () => {
  it('keeps a typed "-" as "-" so the next digit is not displaced', () => {
    expect(formatRawNumber('-', { currency: true })).toBe('Rp -')
    expect(formatRawNumber('-', {})).toBe('-')
    expect(formatRawNumber('-5', { currency: true })).toBe('Rp -5')
    expect(parseDisplayNumber('Rp -5', { currency: true })).toBe('-5')
  })
})
