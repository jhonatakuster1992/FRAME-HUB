import type { TaskWithMeta } from '@shared/types'
import { addDays, isSameDay, startOfDay } from '../../shared/date'
import { TaskCard } from '../components/TaskCard'

interface Props {
  tasks: TaskWithMeta[]
  density: 'grade' | 'linhas'
  onOpenTask: (task: TaskWithMeta) => void
  onToggleDone: (task: TaskWithMeta) => void
  onSnooze: (task: TaskWithMeta) => void
  onDelete: (task: TaskWithMeta) => void
}

type Group = { title: string; late?: boolean; tasks: TaskWithMeta[] }

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
    if (task.status === 'concluida') buckets['Concluídas'].push(task)
    else if (!task.due_at) buckets['Sem data'].push(task)
    else {
      const due = new Date(task.due_at)
      if (due < now && !isSameDay(due, now)) buckets['Atrasadas'].push(task)
      else if (isSameDay(due, now)) buckets['Hoje'].push(task)
      else if (isSameDay(due, tomorrow)) buckets['Amanhã'].push(task)
      else if (due < weekEnd) buckets['Próximos 7 dias'].push(task)
      else buckets['Depois'].push(task)
    }
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => ({ title, late: title === 'Atrasadas', tasks: items }))
}

export function ListView({
  tasks,
  density,
  onOpenTask,
  onToggleDone,
  onSnooze,
  onDelete
}: Props): React.JSX.Element {
  const groups = group(tasks)

  if (groups.length === 0) {
    return (
      <div className="empty">
        <b>Nada por aqui</b>
        Use o atalho global ou o botão “Nova tarefa” para capturar a primeira.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {groups.map((item) => (
        <section className="group" key={item.title}>
          <h2 className={`group__title${item.late ? ' group__title--late' : ''}`}>
            {item.title} · {item.tasks.length}
          </h2>
          <div className={`card-grid card-grid--${density}`}>
            {item.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                onToggleDone={onToggleDone}
                onSnooze={onSnooze}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
