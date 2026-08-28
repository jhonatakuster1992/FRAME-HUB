import type { RecurrenceType } from '@shared/types'
import { parseTime } from '@shared/recurrence'

interface Props {
  type: RecurrenceType
  value: string | null
  onChange: (type: RecurrenceType, value: string | null) => void
}

const LABELS: Record<RecurrenceType, string> = {
  once: 'Uma vez',
  minutes: 'A cada X minutos',
  hourly: 'A cada X horas',
  daily: 'Todo dia',
  weekly: 'Semanal',
  monthly: 'Mensal',
  custom_times: 'Horários fixos'
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Valores padrao ao trocar de tipo — nunca deixa o campo em estado invalido. */
function defaultValue(type: RecurrenceType): string | null {
  switch (type) {
    case 'minutes':
      return '30'
    case 'hourly':
      return '1'
    case 'daily':
      return '09:00'
    case 'weekly':
      return '1@09:00'
    case 'monthly':
      return '1@09:00'
    case 'custom_times':
      return '09:00,18:00'
    default:
      return null
  }
}

function splitAt(value: string | null, fallbackLeft: string): [string, string] {
  const [left, right] = (value ?? '').split('@')
  return [left || fallbackLeft, right && /^\d{1,2}:\d{2}$/.test(right) ? right : '09:00']
}

export function RecurrenceEditor({ type, value, onChange }: Props): React.JSX.Element {
  const set = (nextValue: string | null): void => onChange(type, nextValue)

  return (
    <div>
      <label className="label">Recorrência do lembrete</label>
      <div className="form-row">
        <select
          className="field"
          value={type}
          onChange={(event) => {
            const next = event.target.value as RecurrenceType
            onChange(next, defaultValue(next))
          }}
        >
          {(Object.keys(LABELS) as RecurrenceType[]).map((key) => (
            <option key={key} value={key}>
              {LABELS[key]}
            </option>
          ))}
        </select>

        {(type === 'minutes' || type === 'hourly') && (
          <input
            className="field"
            type="number"
            min={1}
            value={value ?? ''}
            onChange={(event) => set(event.target.value)}
            aria-label={type === 'minutes' ? 'Minutos' : 'Horas'}
          />
        )}

        {type === 'daily' && (
          <input
            className="field"
            type="time"
            value={value ?? '09:00'}
            onChange={(event) => set(event.target.value)}
          />
        )}

        {type === 'monthly' && (
          <>
            <input
              className="field"
              type="number"
              min={1}
              max={31}
              value={splitAt(value, '1')[0]}
              onChange={(event) => set(`${event.target.value}@${splitAt(value, '1')[1]}`)}
              aria-label="Dia do mês"
            />
            <input
              className="field"
              type="time"
              value={splitAt(value, '1')[1]}
              onChange={(event) => set(`${splitAt(value, '1')[0]}@${event.target.value}`)}
            />
          </>
        )}

        {type === 'custom_times' && (
          <input
            className="field"
            value={value ?? ''}
            placeholder="08:00, 12:30, 18:00"
            onChange={(event) => set(event.target.value.replace(/\s/g, ''))}
          />
        )}
      </div>

      {type === 'weekly' && (
        <div className="form-row" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 2 }}>
            {WEEKDAYS.map((label, index) => {
              const [daysPart, time] = splitAt(value, '1')
              const days = daysPart.split(',').filter(Boolean).map(Number)
              const active = days.includes(index)
              return (
                <button
                  key={label}
                  type="button"
                  className="btn"
                  style={
                    active
                      ? { background: 'var(--accent)', color: '#2A1B02', borderColor: 'transparent' }
                      : undefined
                  }
                  onClick={() => {
                    const next = active ? days.filter((d) => d !== index) : [...days, index]
                    set(`${next.sort((a, b) => a - b).join(',') || '1'}@${time}`)
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <input
            className="field"
            type="time"
            style={{ flex: 1 }}
            value={splitAt(value, '1')[1]}
            onChange={(event) => {
              try {
                parseTime(event.target.value)
                set(`${splitAt(value, '1')[0]}@${event.target.value}`)
              } catch {
                /* input type=time so entrega HH:MM valido; guarda defensiva */
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
