import type { TaskWithMeta } from '@shared/types'
import { Icon } from '../../shared/Icon'
import { fmtRelative } from '../../shared/date'
import { MiniCalendar } from './MiniCalendar'

interface Props {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  markedDays: Set<string>
  upcoming: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
}

/** Coluna da direita: mini calendário e o que vem primeiro. */
export function RightRail({
  selectedDate,
  onSelectDate,
  markedDays,
  upcoming,
  onOpenTask
}: Props): React.JSX.Element {
  return (
    <aside className="rail">
      <div className="rail__card">
        <MiniCalendar selected={selectedDate} onSelect={onSelectDate} markedDays={markedDays} />
      </div>

      <div className="rail__card">
        <h2 className="rail__title">Próximos</h2>
        <div className="rail__list">
          {upcoming.length === 0 && <p className="rail__empty">Nada agendado à frente.</p>}
          {upcoming.map((task) => (
            <div key={task.id} className="rail__item" onClick={() => onOpenTask(task)}>
              <span
                className="rail__tile"
                style={{ background: task.category?.color ?? 'var(--violeta)' }}
              >
                <Icon name="tarefas" className="icon icon--sm" strokeWidth={2.2} />
              </span>
              <span style={{ minWidth: 0 }}>
                <div className="rail__item-title">{task.title}</div>
                <div className="rail__item-when">{fmtRelative(task.due_at)}</div>
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
