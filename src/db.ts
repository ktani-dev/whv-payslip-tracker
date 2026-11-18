import Dexie, { type EntityTable } from 'dexie'
import type { CountMode, Payslip } from './rules/types'

// Everything stays in this browser (IndexedDB). Nothing is sent anywhere.
export const db = new Dexie('whv-payslips') as Dexie & {
  payslips: EntityTable<Payslip, 'id'>
  settings: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  payslips: '++id, periodEnd, employer, visa',
  settings: 'key',
})

export async function getMode(): Promise<CountMode> {
  return ((await db.settings.get('mode'))?.value as CountMode) ?? 'h38'
}

export const setMode = (mode: CountMode) => db.settings.put({ key: 'mode', value: mode })

export async function exportJson() {
  const data = { version: 1, payslips: await db.payslips.toArray(), mode: await getMode() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `payslips-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importJson(file: File) {
  const data = JSON.parse(await file.text())
  if (!Array.isArray(data.payslips)) throw new Error('Not a payslip backup file')
  await db.transaction('rw', db.payslips, db.settings, async () => {
    await db.payslips.clear()
    await db.payslips.bulkAdd(data.payslips.map(({ id: _id, ...p }: Payslip) => p))
    if (data.mode) await setMode(data.mode)
  })
}

/** Made-up payslips for trying the app. */
export async function loadDemo() {
  const slips: Payslip[] = []
  const add = (start: string, days: number, employer: string, hours: number | undefined, gross: number, visa: Payslip['visa'], extra: Partial<Payslip> = {}) => {
    const s = new Date(start + 'T00:00:00Z')
    const e = new Date(s.getTime() + (days - 1) * 86_400_000)
    const net = Math.round(gross * 0.85 * 100) / 100
    slips.push({ employer, periodStart: start, periodEnd: e.toISOString().slice(0, 10), gross, net, hours, visa, specified: true, ...extra })
  }
  // First visa: berry farm, weekly
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10)
    add(d, 7, 'Sunny Berry Farm', [40, 38, 36, 41, 30, 38][i], [1150, 1093, 1035, 1179, 863, 1093][i], 'first')
  }
  // Mango picking, piece rate, fortnightly, no hours
  add('2026-02-16', 14, 'Top End Mangoes', undefined, 2100, 'first', { daysWorked: 10, note: 'Piece rate' })
  add('2026-03-02', 14, 'Top End Mangoes', undefined, 1680, 'first', { daysWorked: 8, note: 'Piece rate' })
  // City café: not specified work
  add('2026-03-23', 7, 'Harbour Café', 25, 720, 'first', { specified: false, taxWithheld: 108 })
  // Second visa: construction, fortnightly
  add('2026-07-06', 14, 'Outback Builders', 76, 2850, 'second', { taxWithheld: 427.5 })
  add('2026-07-20', 14, 'Outback Builders', 70, 2625, 'second', { taxWithheld: 393.75 })
  await db.payslips.bulkAdd(slips)
}
