import { useEffect, useRef, useState } from 'react'
import type { TaskWithMeta } from '@shared/types'
import { fmtTime, fmtWeekday, isToday, minutesOfDay, isSameDay, startOfDay } from '../../shared/date'

const HOUR_H = 48
const SNAP_MIN = 15

interface Props {
  days: Date[]
  tasks: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
  onReschedule: (taskId: number, date: Date) => void
}

/**
 * Grade horaria compartilhada por Dia e Semana. Arrastar um evento
 * reagenda: a coluna vira o dia, o Y vira a hora (snap de 15 min).
 */
export function TimeGrid({ days, tasks, onOpenTask, onReschedule }: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  // Linha do "agora" acompanha o relogio, sem animacao continua.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Abre a visao ja no horario comercial em vez de meia-noite. Precisa de um
  // frame: no mount a grade ainda nao tem altura e o scrollTop seria clampado.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const dropAt = (event: React.DragEvent, day: Date): void => {
    event.preventDefault()
    setDropTarget(null)
    const taskId = Number(event.dataTransfer.getData('text/task-id'))
    if (!Number.isInteger(taskId)) return

    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = ((event.clientY - rect.top) / HOUR_H) * 60
    const snapped = Math.max(0, Math.round(minutes / SNAP_MIN) * SNAP_MIN)
    const target = startOfDay(day)
    target.setMinutes(snapped)
    onReschedule(taskId, target)
  }

  return (
    <div className="grid-view" style={{ ['--cols' as string]: days.length, ['--hour-h' as string]: `${HOUR_H}px` }}>
      <div className="grid-view__head">
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`grid-view__day-head${isToday(day) ? ' grid-view__day-head--today' : ''}`}
          >
            <div className="grid-view__dow">{fmtWeekday(day)}</div>
            <div className="grid-view__daynum">{day.getDate()}</div>
          </div>
        ))}
      </div>

      <div className="grid-view__scroll" ref={scrollRef}>
        <div className="grid-view__body">
          <div className="grid-view__gutter">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="grid-view__hour-label">
                {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayTasks = tasks.filter(
              (task) => task.due_at && isSameDay(new Date(task.due_at), day)
            )
            return (
              <div
                key={day.toISOString()}
                className="grid-view__col"
                onDragOver={(event) => {
                  event.preventDefault()
                  setDropTarget(day.toISOString())
                }}
                onDragLeave={() => setDropTarget((current) => (current === day.toISOString() ? null : current))}
                onDrop={(event) => dropAt(event, day)}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className={`grid-view__slot${
                      dropTarget === day.toISOString() ? ' grid-view__slot--drop' : ''
                    }`}
                  />
                ))}

                {isToday(day) && (
                  <div className="now-line" style={{ top: (minutesOfDay(now) / 60) * HOUR_H }} />
                )}

                {dayTasks.map((task) => {
                  const start = new Date(task.due_at!)
                  const top = (minutesOfDay(start) / 60) * HOUR_H
                  const height = Math.max((task.duration_minutes / 60) * HOUR_H, 22)
                  return (
                    <div
                      key={task.id}
                      className={`grid-event${task.status === 'concluida' ? ' grid-event--done' : ''}`}
                      style={{
                        top,
                        height,
                        ['--event-color' as string]: task.category?.color ?? 'var(--accent)'
                      }}
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData('text/task-id', String(task.id))
                      }
                      onClick={() => onOpenTask(task)}
                      title={`${task.title} — ${fmtTime(start)}`}
                    >
                      <div className="grid-event__title">{task.title}</div>
                      {height > 34 && <div className="grid-event__time">{fmtTime(start)}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
