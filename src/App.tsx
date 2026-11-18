import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db, exportJson, getMode, importJson, loadDemo, setMode } from './db'
import { PayslipForm } from './PayslipForm'
import { MODES } from './rules/config'
import { countDays, progress, tax, totals } from './rules/count'
import type { CountMode, Payslip } from './rules/types'

type Tab = 'home' | 'add' | 'list'
const money = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
const d1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-AU')

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [editing, setEditing] = useState<Payslip | 'new' | null>(null)
  const payslips = useLiveQuery(() => db.payslips.orderBy('periodEnd').reverse().toArray(), [])
  const mode = useLiveQuery(getMode, [], 'h38' as CountMode)

  if (!payslips) return null

  return (
    <div className="app">
      <header>
        <h1>WHV Payslip Tracker</h1>
        <nav>
          {(['home', 'add', 'list'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ home: 'Home', add: 'Add', list: 'Payslips' }[t]}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'home' && <Home payslips={payslips} mode={mode} />}
        {tab === 'add' && <Add onManual={() => setEditing('new')} />}
        {tab === 'list' && <List payslips={payslips} mode={mode} onOpen={setEditing} />}
      </main>

      {editing && (
        <PayslipForm
          initial={editing === 'new' ? undefined : editing}
          previous={payslips[0]}
          mode={mode}
          onClose={() => {
            if (editing === 'new') setTab('list')
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Home({ payslips, mode }: { payslips: Payslip[]; mode: CountMode }) {
  const t = totals(payslips)
  const prog = progress(payslips, mode)
  const short = payslips.filter((p) => p.specified && p.visa !== 'third' && !countDays(p, mode).fullTime)

  return (
    <>
      <section className="card">
        <label className="mode">
          Day counting
          <select value={mode} onChange={(e) => setMode(e.target.value as CountMode)}>
            {Object.entries(MODES).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{MODES[mode].help}</p>

        {prog.map((p) => (
          <div key={p.label} className="progress">
            <div className="progress-head">
              <span>Toward {p.label}</span>
              <span>
                <b>{d1(p.done)}</b> / {p.required} days {p.remaining > 0 ? `· ${d1(p.remaining)} to go` : '· done ✓'}
              </span>
            </div>
            <div className="bar">
              <div style={{ width: `${Math.min(100, (p.done / p.required) * 100)}%` }} />
            </div>
          </div>
        ))}
        {short.length > 0 && mode !== 'ratio' && (
          <p className="warn">
            {short.length} payslip{short.length > 1 ? 's' : ''} below {MODES[mode].threshold} h/week. Not sure? Aim for 38 hours a week.
          </p>
        )}
      </section>

      <section className="stats">
        <Stat label="Hours worked" value={d1(t.hours)} />
        <Stat label="Gross pay" value={money(t.gross)} />
        <Stat label="Net pay" value={money(t.net)} />
        <Stat label="Payslips" value={String(payslips.length)} />
      </section>

      <section className="card">
        <h2>Tax return (by financial year)</h2>
        {t.years.length === 0 ? (
          <p className="hint">No payslips yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Gross</th>
                <th>Tax withheld</th>
              </tr>
            </thead>
            <tbody>
              {t.years.map(([fy, y]) => (
                <tr key={fy}>
                  <td>{fy}</td>
                  <td>{money(y.gross)}</td>
                  <td>
                    {money(y.tax)}
                    {y.taxEstimated && <span className="opt"> (est.)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint">Use gross pay for your tax return. "est." = some payslips have no tax amount, so gross − net was used.</p>
      </section>

      <p className="disclaimer">
        Estimates only. Check the Department of Home Affairs and the ATO before applying. Your data stays in this browser.
      </p>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function Add({ onManual }: { onManual: () => void }) {
  const file = useRef<HTMLInputElement>(null)
  return (
    <>
      <section className="card add">
        <button className="big" disabled title="Coming in v0.2">
          📄 Read a PDF payslip
          <small>coming in v0.2</small>
        </button>
        <button className="big" disabled title="Coming in v0.3">
          📷 Take a photo
          <small>coming in v0.3</small>
        </button>
        <button className="big primary" onClick={onManual}>
          ✏️ Enter manually
        </button>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="hint">Data is saved only in this browser. Export a file to move it to another device.</p>
        <div className="actions">
          <button onClick={exportJson}>Export JSON</button>
          <button onClick={() => file.current?.click()}>Import JSON</button>
          <button onClick={() => loadDemo()}>Load demo data</button>
          <button className="danger" onClick={() => confirm('Delete all payslips?') && db.payslips.clear()}>
            Clear all
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f && confirm('Replace all payslips with this file?')) await importJson(f).catch((err) => alert(err.message))
            e.target.value = ''
          }}
        />
      </section>
    </>
  )
}

function List({ payslips, mode, onOpen }: { payslips: Payslip[]; mode: CountMode; onOpen: (p: Payslip) => void }) {
  if (payslips.length === 0) return <p className="hint center">No payslips yet. Add one from the Add tab.</p>
  return (
    <ul className="list">
      {payslips.map((p) => {
        const c = countDays(p, mode)
        const tx = tax(p)
        return (
          <li key={p.id} onClick={() => onOpen(p)}>
            <div className="list-main">
              <b>{p.employer}</b>
              <span className="hint">
                {p.periodStart} – {p.periodEnd} · {p.hours != null ? `${p.hours} h` : `${p.daysWorked ?? 0} days`} · {p.visa} visa
              </span>
            </div>
            <div className="list-side">
              <b>{money(p.gross)}</b>
              <span className="hint">
                net {money(p.net)} · tax {money(tx.amount)}
                {tx.estimated && '*'}
              </span>
              <span className={p.specified ? (c.fullTime ? 'tag ok' : 'tag') : 'tag off'}>
                {p.specified ? `${d1(c.days)} days` : 'not specified'}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
