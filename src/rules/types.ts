export type VisaStage = 'first' | 'second' | 'third'

export interface Payslip {
  id?: number
  employer: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD (inclusive)
  gross: number
  net: number
  taxWithheld?: number
  hours?: number
  daysWorked?: number // used only when the payslip has no hours (piece rate)
  visa: VisaStage
  specified: boolean // counts toward the 88/179 days
  note?: string
}

export type CountMode = 'h38' | 'h35' | 'ratio'
