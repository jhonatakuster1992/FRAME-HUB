import { useEffect, useState } from 'react'
import type { Category, HistoryEntry, Priority, RecurrenceType, TaskInput, TaskWithMeta } from '@shared/types'
import { api } from '../../shared/api'
import { useEscape } from '../../shared/hooks'
import { fmtRelative, toLocalInput, fromLocalInput } from '../../shared/date'
import { RecurrenceEditor } from './RecurrenceEditor'

interface Props {
  task: TaskWithMeta | null
  /** Data pre-preenchida ao criar a partir do calendario. */
  initialDate?: Date | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

const ACTION_LABELS: Record<string, string> = {
  created: 'criada',
  completed: 'concluída',
  snoozed: 'adiada',
  rescheduled: 'reagendada',
  reopened: 'reaberta'
}

export function TaskDialog({
  task,
  initialDate,
  categories,
  onClose,
  onSaved
}: Props): React.JSX.Element {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(task?.category_id ?? null)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'media')
  const [dueAt, setDueAt] = useState(
    toLocalInput(task?.due_at ?? (initialDate ? initialDate.toISOString() : null))
  )
  const [duration, setDuration] = useState(task?.duration_minutes ?? 30)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    task?.reminder?.recurrence_type ?? 'once'
  )
  const [recurrenceValue, setRecurrenceValue] = useState<string | null>(
    task?.reminder?.recurrence_value ?? null
  )
  const [hasReminder, setHasReminder] = useState(Boolean(task?.reminder))
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscape(onClose)

  useEffect(() => {
    if (task) void api.tasks.history(task.id).then(setHistory)
  }, [task])

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)

    const iso = fromLocalInput(dueAt)
    const payload: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      category_id: categoryId,
      priority,
      due_at: iso,
      duration_minutes: duration,
      reminder: hasReminder
        ? {
            recurrence_type: recurrenceType,
            recurrence_value: recurrenceValue,
            next_trigger_at: recurrenceType === 'once' ? iso : null
          }
        : null
    }

    try {
      if (task) await api.tasks.update(task.id, payload)
      else await api.tasks.create(payload)
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message.replace(/^Error invoking remote method '[^']+': /, ''))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!task) return
    await api.tasks.remove(task.id)
    onSaved()
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal" onSubmit={save}>
        <header className="modal__head">
          <h2 className="modal__title display">{task ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal__body">
          <div>
            <label className="label" htmlFor="task-title">
              Título
            </label>
            <input
              id="task-title"
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="O que precisa acontecer?"
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="task-desc">
              Descrição
            </label>
            <textarea
              id="task-desc"
              className="field"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="form-row">
            <div>
              <label className="label">Agenda</label>
              <select
                className="field"
                value={categoryId ?? ''}
                onChange={(event) =>
                  setCategoryId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Sem agenda</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select
                className="field"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div>
              <label className="label">Quando</label>
              <input
                className="field"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div style={{ maxWidth: 130 }}>
              <label className="label">Duração (min)</label>
              <input
                className="field"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={hasReminder}
              onChange={(event) => setHasReminder(event.target.checked)}
            />
            Avisar com notificação
          </label>

          {hasReminder && (
            <RecurrenceEditor
              type={recurrenceType}
              value={recurrenceValue}
              onChange={(type, value) => {
                setRecurrenceType(type)
                setRecurrenceValue(value)
              }}
            />
          )}

          {task?.reminder?.next_trigger_at && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
              Próximo aviso: {fmtRelative(task.reminder.next_trigger_at)}
            </p>
          )}

          {error && <p style={{ color: 'var(--ceramica)', fontSize: 12.5, margin: 0 }}>{error}</p>}

          {history.length > 0 && (
            <details>
              <summary style={{ fontSize: 12, color: 'var(--text-faint)', cursor: 'pointer' }}>
                Histórico ({history.length})
              </summary>
              <ul style={{ fontSize: 12, color: 'var(--text-soft)', paddingLeft: 18, marginTop: 6 }}>
                {history.slice(0, 12).map((entry) => (
                  <li key={entry.id}>
                    {ACTION_LABELS[entry.action] ?? entry.action} · {fmtRelative(entry.timestamp)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <footer className="modal__foot">
          {task && (
            <button type="button" className="btn btn--danger" onClick={remove}>
              Excluir
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!title.trim() || saving}>
            {task ? 'Salvar' : 'Criar'}
          </button>
        </footer>
      </form>
    </div>
  )
}
