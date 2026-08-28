import { useEffect, useRef, useState } from 'react'
import type { TaskWithMeta } from '@shared/types'
import { fmtTime, fmtWeekday, isSameDay, isToday, minutesOfDay, startOfDay } from '../../shared/date'

const HOUR_H = 52
const SNAP_MIN = 15

interface Props {
  days: Date[]
  tasks: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
  onReschedule: (taskId: number, date: Date) => void
  /** Duplo clique em um horario vazio abre o formulario ja com a data. */
  onCreateAt: (date: Date) => void
}

/** Posicao do cursor dentro da coluna -> horario com snap de 15 min. */
function timeFromPointer(event: React.MouseEvent | React.DragEvent, day: Date): Date {
  const rect = event.currentTarget.getBoundingClientRect()
  const minutes = ((event.clientY - rect.top) / HOUR_H) * 60
  const snapped = Math.max(0, Math.min(Math.round(minutes / SNAP_MIN) * SNAP_MIN, 24 * 60 - SNAP_MIN))
  const target = startOfDay(day)
  target.setMinutes(snapped)
  return target
}

/** Grade horaria compartilhada por Dia e Semana. */
export function TimeGrid({
  days,
  tasks,
  onOpenTask,
  onReschedule,
  onCreateAt
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  // Linha do "agora" acompanha o relogio, sem animacao continua.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Abre a visao no horario comercial. Precisa de um frame: no mount a grade
  // ainda nao tem altura e o scrollTop seria clampado.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const drop = (event: React.DragEvent, day: Date): void => {
    event.preventDefault()
    setDropTarget(null)
    const taskId = Number(event.dataTransfer.getData('text/task-id'))
    if (!Number.isInteger(taskId)) return
    onReschedule(taskId, timeFromPointer(event, day))
  }

  return (
    <div
      className="grid-view"
      style={{ ['--cols' as string]: days.length, ['--hour-h' as string]: `${HOUR_H}px` }}
    >
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
            const key = day.toISOString()
            const dayTasks = tasks.filter(
              (task) => task.due_at && isSameDay(new Date(task.due_at), day)
            )
            return (
              <div
                key={key}
                className={`grid-view__col${dropTarget === key ? ' grid-view__col--drop' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDropTarget(key)
                }}
                onDragLeave={() => setDropTarget((current) => (current === key ? null : current))}
                onDrop={(event) => drop(event, day)}
                onDoubleClick={(event) => onCreateAt(timeFromPointer(event, day))}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="grid-view__slot" />
                ))}

                {isToday(day) && (
                  <div className="now-line" style={{ top: (minutesOfDay(now) / 60) * HOUR_H }} />
                )}

                {dayTasks.map((task) => {
                  const start = new Date(task.due_at!)
                  const top = (minutesOfDay(start) / 60) * HOUR_H
                  const height = Math.max((task.duration_minutes / 60) * HOUR_H, 24)
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
                      {height > 38 && <div className="grid-event__time">{fmtTime(start)}</div>}
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
