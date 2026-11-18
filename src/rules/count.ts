import { MODES, RULES } from './config'
import type { CountMode, Payslip, VisaStage } from './types'

const DAY_MS = 86_400_000

/** Calendar days in the pay period, both ends included. */
export function periodDays(p: Pick<Payslip, 'periodStart' | 'periodEnd'>): number {
  const start = Date.parse(p.periodStart + 'T00:00:00Z')
  const end = Date.parse(p.periodEnd + 'T00:00:00Z')
  return Math.max(0, Math.round((end - start) / DAY_MS) + 1)
}

export interface DayCount {
  days: number
  reason: string
  /** true when the period met the full-time threshold */
  fullTime: boolean
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Specified-work days one payslip counts for, under the chosen mode. */
export function countDays(p: Payslip, mode: CountMode): DayCount {
  if (!p.specified) return { days: 0, reason: 'Not specified work', fullTime: false }
  const span = periodDays(p)
  const weeks = span / 7
  if (span === 0) return { days: 0, reason: 'Invalid period', fullTime: false }

  if (p.hours != null) {
    const perWeek = p.hours / weeks
    if (mode === 'ratio') {
      const days = Math.min(span, (p.hours * 7) / RULES.ratioBaseHours)
      return {
        days,
        reason: `${r1(perWeek)} h/week → 7 × ${r1(perWeek)} ÷ ${RULES.ratioBaseHours} per week = ${r1(days)} days`,
        fullTime: days >= span,
      }
    }
    const threshold = MODES[mode].threshold
    if (perWeek >= threshold) {
      return { days: span, reason: `${r1(perWeek)} h/week ≥ ${threshold} → all ${span} days`, fullTime: true }
    }
    const days = Math.min(span, p.hours / RULES.hoursPerDay)
    return {
      days,
      reason: `${r1(perWeek)} h/week < ${threshold} → ${p.hours} h ÷ ${RULES.hoursPerDay} = ${r1(days)} days`,
      fullTime: false,
    }
  }

  if (p.daysWorked != null) {
    const perWeek = p.daysWorked / weeks
    const full = RULES.fullTimeDaysPerWeek
    if (mode === 'ratio') {
      const days = Math.min(span, (p.daysWorked * 7) / full)
      return { days, reason: `${p.daysWorked} days worked → 7 × ${r1(perWeek)} ÷ ${full} per week = ${r1(days)} days`, fullTime: days >= span }
    }
    if (perWeek >= full) {
      return { days: span, reason: `${r1(perWeek)} days/week ≥ ${full} → all ${span} days`, fullTime: true }
    }
    return { days: p.daysWorked, reason: `${r1(perWeek)} days/week < ${full} → ${p.daysWorked} days`, fullTime: false }
  }

  return { days: 0, reason: 'No hours or days entered', fullTime: false }
}

/** Work done on visa N counts toward visa N+1. */
export const TARGETS: { from: VisaStage; label: string; required: number }[] = [
  { from: 'first', label: '2nd visa', required: RULES.secondVisaDays },
  { from: 'second', label: '3rd visa', required: RULES.thirdVisaDays },
]

export function progress(payslips: Payslip[], mode: CountMode) {
  return TARGETS.map((t) => {
    const done = payslips.filter((p) => p.visa === t.from).reduce((s, p) => s + countDays(p, mode).days, 0)
    return { ...t, done, remaining: Math.max(0, t.required - done) }
  })
}

/** Tax withheld from the payslip, or gross − net as an estimate. */
export function tax(p: Payslip): { amount: number; estimated: boolean } {
  if (p.taxWithheld != null) return { amount: p.taxWithheld, estimated: false }
  return { amount: Math.max(0, p.gross - p.net), estimated: true }
}

/** Australian financial year (1 Jul – 30 Jun), decided by the period end date. */
export function financialYear(dateIso: string): string {
  const [y, m] = dateIso.split('-').map(Number)
  const start = m >= 7 ? y : y - 1
  return `FY${start}-${String(start + 1).slice(2)}`
}

export function totals(payslips: Payslip[]) {
  const byFy = new Map<string, { gross: number; net: number; tax: number; taxEstimated: boolean; hours: number }>()
  let hours = 0
  let gross = 0
  let net = 0
  for (const p of payslips) {
    hours += p.hours ?? 0
    gross += p.gross
    net += p.net
    const fy = financialYear(p.periodEnd)
    const t = tax(p)
    const row = byFy.get(fy) ?? { gross: 0, net: 0, tax: 0, taxEstimated: false, hours: 0 }
    row.gross += p.gross
    row.net += p.net
    row.tax += t.amount
    row.taxEstimated ||= t.estimated
    row.hours += p.hours ?? 0
    byFy.set(fy, row)
  }
  const years = [...byFy.entries()].sort(([a], [b]) => b.localeCompare(a))
  return { hours, gross, net, years }
}
