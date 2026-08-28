import type { TaskWithMeta } from '@shared/types'
import { describeRecurrence } from '@shared/recurrence'
import { NoteCard } from '../../shared/NoteCard'
import { Icon } from '../../shared/Icon'
import { fmtDayMonth, fmtRelative, fmtTime } from '../../shared/date'

interface Props {
  task: TaskWithMeta
  onOpen: (task: TaskWithMeta) => void
  onToggleDone: (task: TaskWithMeta) => void
  onSnooze: (task: TaskWithMeta) => void
  onDelete: (task: TaskWithMeta) => void
}

const PRIORITY_LABEL = { alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa' }

/** Card de tarefa: bloco colorido da agenda, título, horário e rodapé. */
export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onSnooze,
  onDelete
}: Props): React.JSX.Element {
  const color = task.category?.color ?? 'var(--violeta)'
  const done = task.status === 'concluida'
  const late = Boolean(task.due_at) && new Date(task.due_at!).getTime() < Date.now() && !done
  const recurring = task.reminder && task.reminder.recurrence_type !== 'once'

  const stop = (action: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    action()
  }

  return (
    <NoteCard done={done} className="jcard" onClick={() => onOpen(task)}>
      <div className="jcard__top">
        <div className="jcard__head">
          <span className="jcard__eyebrow">
            {task.category ? (
              <>
                <i className="dot" style={{ background: color }} />
                {task.category.name}
              </>
            ) : (
              'Sem agenda'
            )}
          </span>
          <h3 className="jcard__title note-card__title">{task.title}</h3>
        </div>
        <span className="jcard__tile" style={{ background: color }}>
          <Icon name={recurring ? 'repetir' : 'tarefas'} className="icon icon--lg" strokeWidth={2} />
        </span>
      </div>

      <div className={`jcard__accent${late ? ' jcard__accent--late' : ''}`}>
        {task.due_at
          ? `${fmtDayMonth(new Date(task.due_at))} · ${fmtTime(new Date(task.due_at))}`
          : 'Sem data marcada'}
      </div>

      <p className="jcard__desc">
        {task.description ??
          (recurring
            ? `Lembrete recorrente — ${describeRecurrence({
                type: task.reminder!.recurrence_type,
                value: task.reminder!.recurrence_value
              })}.`
            : PRIORITY_LABEL[task.priority] + '. Sem descrição.')}
      </p>

      <div className="jcard__foot">
        <span className="chip">
          {done ? 'Concluída' : task.status === 'adiada' ? 'Adiada' : task.priority}
        </span>

        {task.attachments > 0 && (
          <span className="chip chip--plain" title={`${task.attachments} anexo(s)`}>
            <Icon name="clipe" className="icon icon--sm" />
            {task.attachments}
          </span>
        )}

        <span className="jcard__place">{task.due_at ? fmtRelative(task.due_at) : '—'}</span>

        <div className="jcard__actions">
          <button title={done ? 'Reabrir' : 'Concluir'} onClick={stop(() => onToggleDone(task))}>
            <Icon name="check" className="icon icon--sm" />
          </button>
          <button title="Adiar" onClick={stop(() => onSnooze(task))}>
            <Icon name="relogio" className="icon icon--sm" />
          </button>
          <button title="Editar" onClick={stop(() => onOpen(task))}>
            <Icon name="editar" className="icon icon--sm" />
          </button>
          <button className="is-danger" title="Excluir" onClick={stop(() => onDelete(task))}>
            <Icon name="lixo" className="icon icon--sm" />
          </button>
        </div>
      </div>
    </NoteCard>
  )
}
