import type { RecurrenceType } from './types'

/**
 * Motor de recorrencia — funcoes puras, sem I/O, para poder testar isolado.
 * Horarios ("HH:MM") sao sempre interpretados no fuso local da maquina;
 * o retorno e um Date, e a persistencia guarda o ISO em UTC.
 */

export interface RecurrenceSpec {
  type: RecurrenceType
  value: string | null
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export class RecurrenceError extends Error {}

/** "08:30" -> { hour: 8, minute: 30 } */
export function parseTime(raw: string): { hour: number; minute: number } {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(raw)
  if (!m) throw new RecurrenceError(`Horario invalido: "${raw}" (use HH:MM)`)
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) throw new RecurrenceError(`Horario fora do intervalo: "${raw}"`)
  return { hour, minute }
}

function positiveInt(raw: string | null, label: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new RecurrenceError(`${label} precisa ser um inteiro positivo (recebido: "${raw}")`)
  }
  return n
}

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base)
  d.setHours(hour, minute, 0, 0)
  return d
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Lista de "HH:MM" ordenada e sem repeticoes. */
function parseTimeList(raw: string | null): { hour: number; minute: number }[] {
  if (!raw) throw new RecurrenceError('Nenhum horario informado')
  const times = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseTime)
  if (times.length === 0) throw new RecurrenceError('Nenhum horario informado')
  const seen = new Set<string>()
  return times
    .filter((t) => {
      const key = `${t.hour}:${t.minute}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute)
}

/** "1,3,5@08:00" -> dias da semana + horario */
function parseWeekly(raw: string | null): { days: number[]; hour: number; minute: number } {
  if (!raw) throw new RecurrenceError('Recorrencia semanal exige "dias@HH:MM"')
  const [daysPart, timePart] = raw.split('@')
  if (!timePart) throw new RecurrenceError(`Recorrencia semanal invalida: "${raw}"`)
  const { hour, minute } = parseTime(timePart)
  const days = [
    ...new Set(
      daysPart
        .split(',')
        .map((d) => Number(d.trim()))
        .filter((d) => Number.isInteger(d))
    )
  ].sort((a, b) => a - b)
  if (days.length === 0 || days.some((d) => d < 0 || d > 6)) {
    throw new RecurrenceError(`Dias da semana invalidos em "${raw}" (use 0=dom ... 6=sab)`)
  }
  return { days, hour, minute }
}

/** "15@08:00" -> dia do mes + horario */
function parseMonthly(raw: string | null): { day: number; hour: number; minute: number } {
  if (!raw) throw new RecurrenceError('Recorrencia mensal exige "dia@HH:MM"')
  const [dayPart, timePart] = raw.split('@')
  if (!timePart) throw new RecurrenceError(`Recorrencia mensal invalida: "${raw}"`)
  const day = Number(dayPart.trim())
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RecurrenceError(`Dia do mes invalido em "${raw}"`)
  }
  return { day, ...parseTime(timePart) }
}

/**
 * Proximo disparo estritamente depois de `from`.
 * Retorna null quando a recorrencia se esgota (tipo "once").
 */
export function computeNextTrigger(spec: RecurrenceSpec, from: Date = new Date()): Date | null {
  switch (spec.type) {
    case 'once':
      return null

    case 'minutes':
      return new Date(from.getTime() + positiveInt(spec.value, 'Intervalo em minutos') * MINUTE)

    case 'hourly':
      return new Date(from.getTime() + positiveInt(spec.value, 'Intervalo em horas') * HOUR)

    case 'daily': {
      const { hour, minute } = parseTime(spec.value ?? '')
      const today = atTime(from, hour, minute)
      if (today.getTime() > from.getTime()) return today
      const tomorrow = new Date(from)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return atTime(tomorrow, hour, minute)
    }

    case 'custom_times': {
      const times = parseTimeList(spec.value)
      for (const t of times) {
        const candidate = atTime(from, t.hour, t.minute)
        if (candidate.getTime() > from.getTime()) return candidate
      }
      const next = new Date(from)
      next.setDate(next.getDate() + 1)
      return atTime(next, times[0].hour, times[0].minute)
    }

    case 'weekly': {
      const { days, hour, minute } = parseWeekly(spec.value)
      for (let offset = 0; offset <= 7; offset++) {
        const day = new Date(from)
        day.setDate(day.getDate() + offset)
        if (!days.includes(day.getDay())) continue
        const candidate = atTime(day, hour, minute)
        if (candidate.getTime() > from.getTime()) return candidate
      }
      return null
    }

    case 'monthly': {
      const { day, hour, minute } = parseMonthly(spec.value)
      for (let offset = 0; offset <= 12; offset++) {
        const probe = new Date(from.getFullYear(), from.getMonth() + offset, 1)
        // dia 31 em fevereiro cai no ultimo dia valido do mes
        const target = Math.min(day, daysInMonth(probe.getFullYear(), probe.getMonth()))
        const candidate = new Date(probe.getFullYear(), probe.getMonth(), target, hour, minute, 0, 0)
        if (candidate.getTime() > from.getTime()) return candidate
      }
      return null
    }

    default: {
      const exhaustive: never = spec.type
      throw new RecurrenceError(`Tipo de recorrencia desconhecido: ${String(exhaustive)}`)
    }
  }
}

/**
 * Quando o app fica horas fechado (ou o PC dorme), o next_trigger_at pode ficar
 * muito no passado. Isso avanca ate o proximo horario futuro sem disparar
 * uma avalanche de notificacoes atrasadas.
 */
export function catchUp(spec: RecurrenceSpec, from: Date, now: Date = new Date()): Date | null {
  let cursor = from
  for (let i = 0; i < 5000; i++) {
    const next = computeNextTrigger(spec, cursor)
    if (!next) return null
    if (next.getTime() > now.getTime()) return next
    cursor = next
  }
  // fallback defensivo: intervalos minusculos com janela enorme
  return computeNextTrigger(spec, now)
}

/** Rotulo legivel para a UI. */
export function describeRecurrence(spec: RecurrenceSpec): string {
  const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  try {
    switch (spec.type) {
      case 'once':
        return 'Uma vez'
      case 'minutes':
        return `A cada ${positiveInt(spec.value, 'Intervalo')} min`
      case 'hourly': {
        const n = positiveInt(spec.value, 'Intervalo')
        return n === 1 ? 'A cada hora' : `A cada ${n} horas`
      }
      case 'daily': {
        const { hour, minute } = parseTime(spec.value ?? '')
        return `Todo dia as ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      }
      case 'custom_times':
        return `Todo dia as ${parseTimeList(spec.value)
          .map((t) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`)
          .join(', ')}`
      case 'weekly': {
        const { days, hour, minute } = parseWeekly(spec.value)
        const label = days.map((d) => WEEKDAYS[d]).join(', ')
        return `${label} as ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      }
      case 'monthly': {
        const { day, hour, minute } = parseMonthly(spec.value)
        return `Dia ${day} as ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      }
      default:
        return 'Recorrencia'
    }
  } catch {
    return 'Recorrencia invalida'
  }
}

/** Valida um par tipo/valor sem calcular nada; usado no IPC antes de gravar. */
export function validateRecurrence(spec: RecurrenceSpec): void {
  switch (spec.type) {
    case 'once':
      return
    case 'minutes':
    case 'hourly':
      positiveInt(spec.value, 'Intervalo')
      return
    case 'daily':
      parseTime(spec.value ?? '')
      return
    case 'custom_times':
      parseTimeList(spec.value)
      return
    case 'weekly':
      parseWeekly(spec.value)
      return
    case 'monthly':
      parseMonthly(spec.value)
      return
    default:
      throw new RecurrenceError(`Tipo de recorrencia desconhecido: ${spec.type}`)
  }
}
