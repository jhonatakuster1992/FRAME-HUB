import type { Priority, RecurrenceType } from './types'
import { parseTime } from './recurrence'

/**
 * Parser da captura rapida. A caixa da hotkey precisa criar uma tarefa
 * agendavel em uma linha, sem abrir formulario:
 *
 *   Ligar pro contador #Loja !alta @amanha 09:00
 *   Beber agua *30m
 *   Fechar caixa #Loja *diario 19:00
 *   Boleto do aluguel *mensal 5 09:00
 *
 * Tokens:
 *   #categoria      -> categoria (por nome, case-insensitive)
 *   !alta|media|baixa -> prioridade
 *   @<data/hora>    -> quando (hoje/amanha/dd-mm/dd-mm-aaaa + HH:MM)
 *   *<recorrencia>  -> 30m | 2h | diario HH:MM | semanal seg,qua HH:MM | mensal 15 HH:MM
 */

export interface QuickParseResult {
  title: string
  categoryName: string | null
  priority: Priority | null
  dueAt: Date | null
  recurrence: { type: RecurrenceType; value: string | null } | null
  warnings: string[]
}

const WEEKDAY_ALIASES: Record<string, number> = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1,
  ter: 2, terca: 2, terça: 2,
  qua: 3, quarta: 3,
  qui: 4, quinta: 4,
  sex: 5, sexta: 5,
  sab: 6, sabado: 6, sábado: 6
}

const PRIORITY_ALIASES: Record<string, Priority> = {
  alta: 'alta', a: 'alta', '3': 'alta',
  media: 'media', média: 'media', m: 'media', '2': 'media',
  baixa: 'baixa', b: 'baixa', '1': 'baixa'
}

function fmt(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Consome "@..." ate o proximo token de controle. */
function parseWhen(raw: string, now: Date): { date: Date | null; warning?: string } {
  const text = raw.trim().toLowerCase()
  if (!text) return { date: null }

  let rest = text
  const base = new Date(now)
  base.setSeconds(0, 0)
  let hasDate = false

  // Comparacao por palavra inteira: "qualquercoisa" nao pode virar "qua".
  const firstWord = rest.split(/\s+/)[0]
  const dropWord = (): void => {
    rest = rest.slice(firstWord.length).trim()
    hasDate = true
  }

  if (firstWord === 'hoje') {
    dropWord()
  } else if (firstWord === 'amanha' || firstWord === 'amanhã') {
    dropWord()
    base.setDate(base.getDate() + 1)
  } else if (WEEKDAY_ALIASES[firstWord] !== undefined) {
    const target = WEEKDAY_ALIASES[firstWord]
    dropWord()
    const delta = (target - base.getDay() + 7) % 7 || 7
    base.setDate(base.getDate() + delta)
  } else {
    const dm = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/.exec(rest)
    if (dm) {
      rest = rest.slice(dm[0].length).trim()
      const year = dm[3]
        ? dm[3].length === 2
          ? 2000 + Number(dm[3])
          : Number(dm[3])
        : base.getFullYear()
      base.setFullYear(year, Number(dm[2]) - 1, Number(dm[1]))
      hasDate = true
    }
  }

  const hm = /^(\d{1,2}):(\d{2})/.exec(rest)
  if (hm) {
    const { hour, minute } = parseTime(hm[0])
    base.setHours(hour, minute, 0, 0)
    // "@14:00" sem data e hoje; se ja passou, e amanha
    if (!hasDate && base.getTime() <= now.getTime()) base.setDate(base.getDate() + 1)
    return { date: base }
  }

  if (!hasDate) return { date: null, warning: `Nao entendi a data "${raw.trim()}"` }
  base.setHours(9, 0, 0, 0) // dia sem hora -> 09:00
  return { date: base }
}

/** Consome "*..." ate o proximo token de controle. */
function parseRecurrence(
  raw: string
): { recurrence: { type: RecurrenceType; value: string | null } | null; warning?: string } {
  const text = raw.trim().toLowerCase()
  if (!text) return { recurrence: null }

  const interval = /^(\d+)\s*(m|min|minutos?|h|hora|horas?)$/.exec(text)
  if (interval) {
    const n = interval[1]
    const unit = interval[2].startsWith('h') ? 'hourly' : 'minutes'
    return { recurrence: { type: unit, value: n } }
  }

  const daily = /^(diario|diária|diario|diariamente|todo dia)\s+(\d{1,2}:\d{2})$/.exec(text)
  if (daily) return { recurrence: { type: 'daily', value: daily[2] } }

  const weekly = /^(semanal|toda semana)\s+([a-zçã,\s]+?)\s+(\d{1,2}:\d{2})$/.exec(text)
  if (weekly) {
    const days = weekly[2]
      .split(',')
      .map((d) => WEEKDAY_ALIASES[d.trim()])
      .filter((d) => d !== undefined)
    if (days.length === 0) return { recurrence: null, warning: `Dias invalidos em "${raw.trim()}"` }
    const { hour, minute } = parseTime(weekly[3])
    return { recurrence: { type: 'weekly', value: `${days.join(',')}@${fmt(hour, minute)}` } }
  }

  const monthly = /^(mensal|todo mes|todo mês)\s+(\d{1,2})\s+(\d{1,2}:\d{2})$/.exec(text)
  if (monthly) {
    const { hour, minute } = parseTime(monthly[3])
    return { recurrence: { type: 'monthly', value: `${Number(monthly[2])}@${fmt(hour, minute)}` } }
  }

  const times = /^(\d{1,2}:\d{2})(\s*,\s*\d{1,2}:\d{2})+$/.exec(text)
  if (times) return { recurrence: { type: 'custom_times', value: text.replace(/\s+/g, '') } }

  return { recurrence: null, warning: `Nao entendi a recorrencia "${raw.trim()}"` }
}

export function parseQuickCapture(input: string, now: Date = new Date()): QuickParseResult {
  const warnings: string[] = []
  const result: QuickParseResult = {
    title: '',
    categoryName: null,
    priority: null,
    dueAt: null,
    recurrence: null,
    warnings
  }

  // Quebra a string em segmentos: texto livre + tokens iniciados por # ! @ *
  const segments = input.split(/(?=[#!@*])/g)
  const titleParts: string[] = []

  for (const segment of segments) {
    const marker = segment[0]
    const body = segment.slice(1)

    switch (marker) {
      case '#': {
        const [name, ...tail] = body.split(/\s+/)
        if (name) result.categoryName = name
        else titleParts.push(segment)
        if (tail.length) titleParts.push(tail.join(' '))
        break
      }
      case '!': {
        const [word, ...tail] = body.split(/\s+/)
        const priority = PRIORITY_ALIASES[word?.toLowerCase()]
        if (priority) result.priority = priority
        else titleParts.push(segment)
        if (tail.length) titleParts.push(tail.join(' '))
        break
      }
      case '@': {
        const { date, warning } = parseWhen(body, now)
        if (date) result.dueAt = date
        else {
          if (warning) warnings.push(warning)
          titleParts.push(segment)
        }
        break
      }
      case '*': {
        const { recurrence, warning } = parseRecurrence(body)
        if (recurrence) result.recurrence = recurrence
        else {
          if (warning) warnings.push(warning)
          titleParts.push(segment)
        }
        break
      }
      default:
        titleParts.push(segment)
    }
  }

  result.title = titleParts.join(' ').replace(/\s+/g, ' ').trim()
  return result
}
