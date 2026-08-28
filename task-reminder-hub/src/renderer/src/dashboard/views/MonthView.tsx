import { useState } from 'react'
import type { TaskWithMeta } from '@shared/types'
import { fmtTime, isSameDay, isToday, monthGrid, startOfDay } from '../../shared/date'

const MAX_PER_CELL = 3

interface Props {
  reference: Date
  tasks: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
  onReschedule: (taskId: number, date: Date) => void
  onOpenDay: (date: Date) => void
}

/** Visao mensal: 6 semanas, arrastar entre celulas reagenda mantendo a hora. */
export function MonthView({
  reference,
  tasks,
  onOpenTask,
  onReschedule,
  onOpenDay
}: Props): React.JSX.Element {
  const days = monthGrid(reference)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const handleDrop = (event: React.DragEvent, day: Date): void => {
    event.preventDefault()
    setDropTarget(null)
    const taskId = Number(event.dataTransfer.getData('text/task-id'))
    if (!Number.isInteger(taskId)) return

    const task = tasks.find((candidate) => candidate.id === taskId)
    const target = startOfDay(day)
    if (task?.due_at) {
      const previous = new Date(task.due_at)
      target.setHours(previous.getHours(), previous.getMinutes())
    } else {
      target.setHours(9, 0)
    }
    onReschedule(taskId, target)
  }

  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7))

  return (
    <div className="month">
      <div className="month__dow-row">
        {['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'].map((label) => (
          <div key={label} className="month__dow">
            {label}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div className="month__week" key={weekIndex}>
          {week.map((day) => {
            const dayTasks = tasks
              .filter((task) => task.due_at && isSameDay(new Date(task.due_at), day))
              .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
            const key = day.toISOString()
            return (
              <div
                key={key}
                className={[
                  'month__cell',
                  day.getMonth() !== reference.getMonth() ? 'month__cell--out' : '',
                  dropTarget === key ? 'month__cell--drop' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDropTarget(key)
                }}
                onDragLeave={() => setDropTarget((current) => (current === key ? null : current))}
                onDrop={(event) => handleDrop(event, day)}
                onDoubleClick={() => onOpenDay(day)}
              >
                <span className={`month__daynum${isToday(day) ? ' month__daynum--today' : ''}`}>
                  {day.getDate()}
                </span>

                {dayTasks.slice(0, MAX_PER_CELL).map((task) => (
                  <div
                    key={task.id}
                    className={`month__event${task.status === 'concluida' ? ' month__event--done' : ''}`}
                    style={{ ['--event-color' as string]: task.category?.color ?? 'var(--accent)' }}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData('text/task-id', String(task.id))
                    }
                    onClick={() => onOpenTask(task)}
                    title={task.title}
                  >
                    <i className="dot" style={{ background: task.category?.color ?? 'var(--accent)' }} />
                    <span className="tabular" style={{ fontSize: 10, opacity: 0.75 }}>
                      {fmtTime(new Date(task.due_at!))}
                    </span>
                    {task.title}
                  </div>
                ))}

                {dayTasks.length > MAX_PER_CELL && (
                  <button className="month__more" onClick={() => onOpenDay(day)}>
                    +{dayTasks.length - MAX_PER_CELL} mais
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
