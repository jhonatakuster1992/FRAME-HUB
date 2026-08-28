import { useMemo, useState } from 'react'
import {
  addMonths,
  fmtMonthYear,
  isSameDay,
  isToday,
  monthGrid,
  startOfMonth
} from '../../shared/date'

interface Props {
  selected: Date
  onSelect: (date: Date) => void
  /** Dias (YYYY-MM-DD local) que tem alguma tarefa — ganham o ponto. */
  markedDays: Set<string>
}

export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`

/** Mini calendario navegador da sidebar, como o do Google Agenda. */
export function MiniCalendar({ selected, onSelect, markedDays }: Props): React.JSX.Element {
  const [reference, setReference] = useState(() => startOfMonth(selected))
  const days = useMemo(() => monthGrid(reference), [reference])

  return (
    <div className="mini-cal">
      <div className="mini-cal__head">
        <span className="mini-cal__label">{fmtMonthYear(reference)}</span>
        <button
          className="mini-cal__nav"
          onClick={() => setReference(addMonths(reference, -1))}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <button
          className="mini-cal__nav"
          onClick={() => setReference(addMonths(reference, 1))}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="mini-cal__grid">
        {['d', 's', 't', 'q', 'q', 's', 's'].map((label, index) => (
          <div key={index} className="mini-cal__dow">
            {label}
          </div>
        ))}

        {days.map((day) => {
          const classes = ['mini-cal__day']
          if (day.getMonth() !== reference.getMonth()) classes.push('mini-cal__day--out')
          if (isToday(day)) classes.push('mini-cal__day--today')
          if (isSameDay(day, selected)) classes.push('mini-cal__day--selected')
          if (markedDays.has(dayKey(day))) classes.push('mini-cal__day--has')
          return (
            <button
              key={day.toISOString()}
              className={classes.join(' ')}
              onClick={() => onSelect(day)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
