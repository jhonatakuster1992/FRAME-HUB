/** Helpers de data em horario local. Sem dependencia externa. */

export const MS_DAY = 86_400_000

export const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const endOfDay = (date: Date): Date => {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return d
}

/** Semana comecando no domingo, como no Google Agenda em pt-BR. */
export const startOfWeek = (date: Date): Date => addDays(startOfDay(date), -date.getDay())

export const startOfMonth = (date: Date): Date => {
  const d = startOfDay(date)
  d.setDate(1)
  return d
}

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const isToday = (date: Date): boolean => isSameDay(date, new Date())

/** Grade de 6 semanas x 7 dias que cobre o mes inteiro. */
export function monthGrid(reference: Date): Date[] {
  const first = startOfWeek(startOfMonth(reference))
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

export const weekDays = (reference: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(reference), i))

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const full = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
})

export const fmtTime = (date: Date): string => time.format(date)
export const fmtWeekday = (date: Date): string => weekday.format(date).replace('.', '')
export const fmtDayMonth = (date: Date): string => dayMonth.format(date).replace('.', '')
export const fmtMonthYear = (date: Date): string => monthYear.format(date)
export const fmtFull = (date: Date): string => full.format(date)

/** "em 25 min", "há 2 h", "amanhã 09:00" — usado nos cards e no post-it. */
export function fmtRelative(iso: string | null): string {
  if (!iso) return 'sem data'
  const date = new Date(iso)
  const diff = date.getTime() - Date.now()
  const minutes = Math.round(diff / 60_000)
  const abs = Math.abs(minutes)

  if (abs < 1) return 'agora'
  if (abs < 60) return diff > 0 ? `em ${abs} min` : `há ${abs} min`
  if (abs < 24 * 60) {
    const hours = Math.round(abs / 60)
    return diff > 0 ? `em ${hours} h` : `há ${hours} h`
  }
  if (isSameDay(date, addDays(new Date(), 1))) return `amanhã ${fmtTime(date)}`
  if (isSameDay(date, addDays(new Date(), -1))) return `ontem ${fmtTime(date)}`
  return `${fmtDayMonth(date)} ${fmtTime(date)}`
}

/** Date -> valor de <input type="datetime-local"> (sem UTC). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export const fromLocalInput = (value: string): string | null =>
  value ? new Date(value).toISOString() : null

/** Posicao vertical de um evento na grade de dia/semana. */
export const minutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes()
