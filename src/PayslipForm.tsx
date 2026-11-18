import { useState, type FormEvent } from 'react'
import { db } from './db'
import { countDays, periodDays } from './rules/count'
import type { CountMode, Payslip } from './rules/types'

type Draft = Record<keyof Omit<Payslip, 'id' | 'specified' | 'visa'>, string> & Pick<Payslip, 'specified' | 'visa'>

const toDraft = (p?: Partial<Payslip>): Draft => ({
  employer: p?.employer ?? '',
  periodStart: p?.periodStart ?? '',
  periodEnd: p?.periodEnd ?? '',
  gross: p?.gross?.toString() ?? '',
  net: p?.net?.toString() ?? '',
  taxWithheld: p?.taxWithheld?.toString() ?? '',
  hours: p?.hours?.toString() ?? '',
  daysWorked: p?.daysWorked?.toString() ?? '',
  note: p?.note ?? '',
  visa: p?.visa ?? 'first',
  specified: p?.specified ?? true,
})

const num = (s: string) => (s.trim() === '' ? undefined : Number(s))

function fromDraft(d: Draft): Payslip {
  return {
    employer: d.employer.trim(),
    periodStart: d.periodStart,
    periodEnd: d.periodEnd,
    gross: Number(d.gross),
    net: Number(d.net),
    taxWithheld: num(d.taxWithheld),
    hours: num(d.hours),
    daysWorked: num(d.hours) == null ? num(d.daysWorked) : undefined,
    note: d.note.trim() || undefined,
    visa: d.visa,
    specified: d.specified,
  }
}

function validate(d: Draft): string | null {
  if (!d.employer.trim()) return 'Enter the employer.'
  if (!d.periodStart || !d.periodEnd) return 'Enter the pay period.'
  if (d.periodEnd < d.periodStart) return 'The period ends before it starts.'
  if (d.gross === '' || d.net === '') return 'Enter gross and net pay.'
  if (Number(d.net) > Number(d.gross)) return 'Net pay is larger than gross pay.'
  if (d.specified && d.hours === '' && d.daysWorked === '') return 'Enter hours, or days worked if the payslip has no hours.'
  return null
}

interface Props {
  initial?: Payslip
  previous?: Payslip
  mode: CountMode
  onClose: () => void
}

/** The check-and-fix window. Used for new entries and for editing. */
export function PayslipForm({ initial, previous, mode, onClose }: Props) {
  // New entry: carry over employer and visa from the last payslip
  const [d, setD] = useState<Draft>(() =>
    toDraft(initial ?? (previous ? { employer: previous.employer, visa: previous.visa, specified: previous.specified } : undefined)),
  )
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const preview = validate(d) == null ? countDays(fromDraft(d), mode) : null
  const span = d.periodStart && d.periodEnd && d.periodEnd >= d.periodStart ? periodDays(d) : null

  async function save(e: FormEvent) {
    e.preventDefault()
    const msg = validate(d)
    if (msg) return setError(msg)
    const p = fromDraft(d)
    if (initial?.id != null) await db.payslips.update(initial.id, { ...p })
    else await db.payslips.add(p)
    onClose()
  }

  async function remove() {
    if (initial?.id == null || !confirm('Delete this payslip?')) return
    await db.payslips.delete(initial.id)
    onClose()
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{initial ? 'Edit payslip' : 'Check payslip'}</h2>

        <label>
          Employer
          <input value={d.employer} onChange={(e) => set('employer', e.target.value)} autoFocus />
        </label>
        <div className="row">
          <label>
            Period start
            <input type="date" value={d.periodStart} onChange={(e) => set('periodStart', e.target.value)} />
          </label>
          <label>
            Period end
            <input type="date" value={d.periodEnd} onChange={(e) => set('periodEnd', e.target.value)} />
          </label>
        </div>
        {span != null && <p className="hint">{span} days ({Math.round((span / 7) * 10) / 10} weeks)</p>}

        <div className="row">
          <label>
            Gross pay ($)
            <input inputMode="decimal" value={d.gross} onChange={(e) => set('gross', e.target.value)} />
          </label>
          <label>
            Net pay ($)
            <input inputMode="decimal" value={d.net} onChange={(e) => set('net', e.target.value)} />
          </label>
        </div>
        <label>
          Tax withheld ($) <span className="opt">optional — gross − net is used if empty</span>
          <input inputMode="decimal" value={d.taxWithheld} onChange={(e) => set('taxWithheld', e.target.value)} />
        </label>

        <div className="row">
          <label>
            Hours
            <input inputMode="decimal" value={d.hours} onChange={(e) => set('hours', e.target.value)} />
          </label>
          <label>
            Days worked <span className="opt">if no hours</span>
            <input inputMode="numeric" value={d.daysWorked} disabled={d.hours !== ''} onChange={(e) => set('daysWorked', e.target.value)} />
          </label>
        </div>

        <div className="row">
          <label>
            Visa at the time
            <select value={d.visa} onChange={(e) => set('visa', e.target.value as Payslip['visa'])}>
              <option value="first">1st visa</option>
              <option value="second">2nd visa</option>
              <option value="third">3rd visa</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={d.specified} onChange={(e) => set('specified', e.target.checked)} />
            Specified work
          </label>
        </div>

        <label>
          Note
          <input value={d.note} onChange={(e) => set('note', e.target.value)} />
        </label>

        {preview && (
          <p className="preview">
            Counts as <b>{Math.round(preview.days * 10) / 10} days</b> — {preview.reason}
          </p>
        )}
        {error && <p className="error">{error}</p>}

        <div className="actions">
          {initial && (
            <button type="button" className="danger" onClick={remove}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            OK
          </button>
        </div>
      </form>
    </div>
  )
}
