import type { TaskWithMeta } from '@shared/types'
import { NoteCard } from '../../shared/NoteCard'
import { fmtRelative } from '../../shared/date'
import { MiniCalendar } from './MiniCalendar'

interface Props {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  markedDays: Set<string>
  upcoming: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
}

/** Coluna da direita: mini calendario navegador + o que vem primeiro. */
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
            <NoteCard
              key={task.id}
              color={task.category?.color}
              className="rail__item"
              onClick={() => onOpenTask(task)}
            >
              <div className="rail__item-title">{task.title}</div>
              <div className="rail__item-when">{fmtRelative(task.due_at)}</div>
            </NoteCard>
          ))}
        </div>
      </div>
    </aside>
  )
}
