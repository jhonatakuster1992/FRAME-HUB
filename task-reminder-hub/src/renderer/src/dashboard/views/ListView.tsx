import type { TaskWithMeta } from '@shared/types'
import { describeRecurrence } from '@shared/recurrence'
import { NoteCard } from '../../shared/NoteCard'
import { fmtRelative, isSameDay, addDays, startOfDay } from '../../shared/date'

interface Props {
  tasks: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
  onToggleDone: (task: TaskWithMeta) => void
  onSnooze: (task: TaskWithMeta) => void
  onDelete: (task: TaskWithMeta) => void
}

type Group = { title: string; tasks: TaskWithMeta[] }

/** Agrupa por horizonte de tempo — atrasadas primeiro, sem data por ultimo. */
function group(tasks: TaskWithMeta[]): Group[] {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const weekEnd = addDays(today, 7)

  const buckets: Record<string, TaskWithMeta[]> = {
    Atrasadas: [],
    Hoje: [],
    Amanhã: [],
    'Próximos 7 dias': [],
    Depois: [],
    'Sem data': [],
    Concluídas: []
  }

  for (const task of tasks) {
    if (task.status === 'concluida') {
      buckets['Concluídas'].push(task)
      continue
    }
    if (!task.due_at) {
      buckets['Sem data'].push(task)
      continue
    }
    const due = new Date(task.due_at)
    if (due < now && !isSameDay(due, now)) buckets['Atrasadas'].push(task)
    else if (isSameDay(due, now)) buckets['Hoje'].push(task)
    else if (isSameDay(due, tomorrow)) buckets['Amanhã'].push(task)
    else if (due < weekEnd) buckets['Próximos 7 dias'].push(task)
    else buckets['Depois'].push(task)
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => ({ title, tasks: items }))
}

export function ListView({
  tasks,
  onOpenTask,
  onToggleDone,
  onSnooze,
  onDelete
}: Props): React.JSX.Element {
  const groups = group(tasks)

  if (groups.length === 0) {
    return <div className="empty">Nenhuma tarefa por aqui.<br />Use o atalho global ou o botão “Nova tarefa”.</div>
  }

  return (
    <div className="list">
      {groups.map((groupItem) => (
        <section key={groupItem.title}>
          <h2 className="list__group-title">
            {groupItem.title} · {groupItem.tasks.length}
          </h2>
          <div className="list__items">
            {groupItem.tasks.map((task) => (
              <NoteCard
                key={task.id}
                color={task.category?.color}
                done={task.status === 'concluida'}
                className="task-card"
              >
                <button
                  className={`task-card__check${
                    task.status === 'concluida' ? ' task-card__check--done' : ''
                  }`}
                  onClick={() => onToggleDone(task)}
                  aria-label={task.status === 'concluida' ? 'Reabrir' : 'Concluir'}
                >
                  ✓
                </button>

                <div className="task-card__body" onClick={() => onOpenTask(task)}>
                  <div className="task-card__title note-card__title">{task.title}</div>
                  {task.description && <div className="task-card__desc">{task.description}</div>}
                  <div className="task-card__meta">
                    {task.category && (
                      <span className="chip">
                        <i className="dot" style={{ background: task.category.color }} />
                        {task.category.name}
                      </span>
                    )}
                    <span className={`prio prio--${task.priority}`}>{task.priority}</span>
                    {task.due_at && <span className="tabular">{fmtRelative(task.due_at)}</span>}
                    {task.reminder && task.reminder.recurrence_type !== 'once' && (
                      <span className="chip">
                        ↻{' '}
                        {describeRecurrence({
                          type: task.reminder.recurrence_type,
                          value: task.reminder.recurrence_value
                        })}
                      </span>
                    )}
                    {task.status === 'adiada' && <span className="chip">adiada</span>}
                  </div>
                </div>

                <div className="task-card__actions">
                  <button title="Adiar" onClick={() => onSnooze(task)}>
                    ⏱
                  </button>
                  <button title="Editar" onClick={() => onOpenTask(task)}>
                    ✎
                  </button>
                  <button title="Excluir" onClick={() => onDelete(task)}>
                    🗑
                  </button>
                </div>
              </NoteCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
