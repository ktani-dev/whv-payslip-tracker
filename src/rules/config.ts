import type { CountMode } from './types'

// Rules change often. Keep every number here, not in the logic.
export const RULES = {
  secondVisaDays: 88,
  thirdVisaDays: 179,
  hoursPerDay: 8, // h38 / h35: below the threshold, hours ÷ 8
  ratioBaseHours: 38, // ratio: 7 × (hours ÷ 38)
  fullTimeDaysPerWeek: 5, // when only days worked are known
} as const

export const MODES: Record<CountMode, { label: string; threshold: number; help: string }> = {
  h38: {
    label: '38-hour rule (safest)',
    threshold: 38,
    help: '38+ hours a week = 7 days. Below that, hours ÷ 8. Widely used by backpackers; not written by the Department.',
  },
  h35: {
    label: '35-hour rule',
    threshold: 35,
    help: '35+ hours a week = 7 days. Below that, hours ÷ 8. Some applicants were accepted with this, some were not.',
  },
  ratio: {
    label: 'Proportional (official wording)',
    threshold: 38,
    help: 'Days = 7 × (hours ÷ 38), up to 7 a week. Follows the official "half the full-time hours = half the days" example.',
  },
}
