import { describe, expect, it } from 'vitest'
import { countDays, financialYear, periodDays, progress, tax } from './count'
import type { Payslip } from './types'

const week = (over: Partial<Payslip> = {}): Payslip => ({
  employer: 'Farm',
  periodStart: '2026-01-05',
  periodEnd: '2026-01-11',
  gross: 1000,
  net: 850,
  visa: 'first',
  specified: true,
  ...over,
})

describe('periodDays', () => {
  it('includes both ends', () => expect(periodDays(week())).toBe(7))
  it('handles a leap day', () => expect(periodDays({ periodStart: '2028-02-28', periodEnd: '2028-03-01' })).toBe(3))
})

describe('38-hour rule', () => {
  it('exactly 38 h = 7 days', () => expect(countDays(week({ hours: 38 }), 'h38').days).toBe(7))
  it('37.5 h = hours ÷ 8', () => expect(countDays(week({ hours: 37.5 }), 'h38').days).toBeCloseTo(4.6875))
  it('fortnight needs 76 h', () => {
    const f = week({ periodEnd: '2026-01-18', hours: 76 })
    expect(countDays(f, 'h38').days).toBe(14)
    expect(countDays({ ...f, hours: 75 }, 'h38').days).toBeCloseTo(9.375)
  })
})

describe('35-hour rule', () => {
  it('35 h = 7 days', () => expect(countDays(week({ hours: 35 }), 'h35').days).toBe(7))
  it('30 h = 3.75 days', () => expect(countDays(week({ hours: 30 }), 'h35').days).toBe(3.75))
})

describe('proportional', () => {
  it('19 h = 3.5 days', () => expect(countDays(week({ hours: 19 }), 'ratio').days).toBe(3.5))
  it('caps at the period length', () => expect(countDays(week({ hours: 60 }), 'ratio').days).toBe(7))
})

describe('days worked only (piece rate)', () => {
  it('5 days a week = 7 days', () => expect(countDays(week({ daysWorked: 5 }), 'h38').days).toBe(7))
  it('3 days = 3 days', () => expect(countDays(week({ daysWorked: 3 }), 'h38').days).toBe(3))
  it('3 days proportional = 4.2', () => expect(countDays(week({ daysWorked: 3 }), 'ratio').days).toBeCloseTo(4.2))
})

it('non-specified work counts 0', () => expect(countDays(week({ hours: 40, specified: false }), 'h38').days).toBe(0))

it('first-visa work counts toward the 2nd visa only', () => {
  const p = progress([week({ hours: 40 }), week({ hours: 40, visa: 'second' })], 'h38')
  expect(p[0]).toMatchObject({ label: '2nd visa', done: 7, remaining: 81 })
  expect(p[1]).toMatchObject({ label: '3rd visa', done: 7, remaining: 172 })
})

describe('tax', () => {
  it('uses the payslip value', () => expect(tax(week({ taxWithheld: 120 }))).toEqual({ amount: 120, estimated: false }))
  it('falls back to gross − net', () => expect(tax(week())).toEqual({ amount: 150, estimated: true }))
})

describe('financialYear', () => {
  it('30 June is the old year', () => expect(financialYear('2026-06-30')).toBe('FY2025-26'))
  it('1 July is the new year', () => expect(financialYear('2026-07-01')).toBe('FY2026-27'))
})
