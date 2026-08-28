import type { TaskWithMeta } from '@shared/types'
import { describeRecurrence } from '@shared/recurrence'
import { NoteCard } from '../../shared/NoteCard'
import { Icon } from '../../shared/Icon'
import { fmtRelative, fmtTime } from '../../shared/date'

interface Props {
  task: TaskWithMeta
  onOpen: (task: TaskWithMeta) => void
  onToggleDone: (task: TaskWithMeta) => void
  onSnooze: (task: TaskWithMeta) => void
  onDelete: (task: TaskWithMeta) => void
}

/** Card de tarefa: mesma anatomia na grade e na lista. */
export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onSnooze,
  onDelete
}: Props): React.JSX.Element {
  const color = task.category?.color ?? 'var(--accent)'
  const done = task.status === 'concluida'
  const late = Boolean(task.due_at) && new Date(task.due_at!).getTime() < Date.now() && !done

  return (
    <NoteCard color={color} done={done} className="tcard">
      <div className="tcard__head">
        <div className="tcard__heading" onClick={() => onOpen(task)} style={{ cursor: 'pointer' }}>
          <span className="tcard__cat">
            {task.category ? (
              <>
                <i className="dot" style={{ background: color }} />
                {task.category.name}
              </>
            ) : (
              'Sem agenda'
            )}
          </span>
          <div className="tcard__title note-card__title">{task.title}</div>
        </div>
        <span className="tcard__tile" style={{ background: color }}>
          <Icon name={task.reminder && task.reminder.recurrence_type !== 'once' ? 'repetir' : 'tarefas'} />
        </span>
      </div>

      {task.due_at && (
        <div className={`tcard__when${late ? ' tcard__when--late' : ''}`}>
          {fmtTime(new Date(task.due_at))} · {fmtRelative(task.due_at)}
        </div>
      )}

      {task.description && <p className="tcard__desc">{task.description}</p>}

      <div className="tcard__foot">
        <span className={`chip prio prio--${task.priority}`}>{task.priority}</span>

        {task.reminder && task.reminder.recurrence_type !== 'once' && (
          <span className="chip chip--accent">
            <Icon name="repetir" className="icon icon--sm" />
            {describeRecurrence({
              type: task.reminder.recurrence_type,
              value: task.reminder.recurrence_value
            })}
          </span>
        )}

        {task.status === 'adiada' && <span className="chip">adiada</span>}
        {!task.due_at && !done && <span className="chip">sem data</span>}

        <div className="tcard__actions">
          <button
            className="is-done"
            title={done ? 'Reabrir' : 'Concluir'}
            onClick={() => onToggleDone(task)}
          >
            <Icon name="check" className="icon icon--sm" />
          </button>
          <button title="Adiar" onClick={() => onSnooze(task)}>
            <Icon name="relogio" className="icon icon--sm" />
          </button>
          <button title="Editar" onClick={() => onOpen(task)}>
            <Icon name="editar" className="icon icon--sm" />
          </button>
          <button className="is-danger" title="Excluir" onClick={() => onDelete(task)}>
            <Icon name="lixo" className="icon icon--sm" />
          </button>
        </div>
      </div>
    </NoteCard>
  )
}
