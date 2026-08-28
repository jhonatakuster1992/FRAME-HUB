import { useCallback, useEffect, useState } from 'react'
import type { TaskWithMeta } from '@shared/types'
import { api } from '../shared/api'
import { NoteCard } from '../shared/NoteCard'
import { useAppEvent, useSettings, useTheme } from '../shared/hooks'
import { fmtRelative } from '../shared/date'

/**
 * Post-it flutuante: as pendencias mais proximas + captura embutida.
 * Sempre visivel, sem moldura, densidade baixa de proposito.
 */
export function App(): React.JSX.Element {
  const [tasks, setTasks] = useState<TaskWithMeta[]>([])
  const [draft, setDraft] = useState('')
  const [flash, setFlash] = useState(false)
  const [settings] = useSettings()
  useTheme(settings?.theme)

  const reload = useCallback(() => {
    void api.tasks
      .list({ statuses: ['pendente', 'adiada'], limit: 12, includeUndated: true })
      .then(setTasks)
  }, [])

  useEffect(reload, [reload])

  useAppEvent((event) => {
    if (event.type === 'data-changed' && event.scope === 'tasks') reload()
    if (event.type === 'reminder-fired') {
      reload()
      setFlash(true)
      window.setTimeout(() => setFlash(false), 2_000)
    }
  })

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      await api.tasks.quickCapture(text)
    } catch (error) {
      console.error(error)
      setDraft(text)
    }
    reload()
  }

  // A cor da aba segue a categoria da tarefa mais proxima.
  const activeColor = tasks[0]?.category?.color ?? 'var(--marmelada)'

  return (
    <div className={`postit${flash ? ' postit--flash' : ''}`}>
      <div className="postit__bar" style={{ background: activeColor }} />

      <header className="postit__head">
        <span className="postit__title">Post-it</span>
        <div className="postit__actions">
          <button
            className="postit__icon-btn"
            title="Abrir dashboard"
            onClick={() => void api.window.openDashboard()}
          >
            ▤
          </button>
          <button
            className="postit__icon-btn"
            title="Esconder post-it"
            onClick={() => void api.window.togglePostit()}
          >
            ✕
          </button>
        </div>
      </header>

      <div className="postit__list">
        {tasks.length === 0 && (
          <p className="postit__empty">
            Nada pendente.
            <br />
            Escreva abaixo para capturar.
          </p>
        )}

        {tasks.map((task) => {
          const late = task.due_at ? new Date(task.due_at).getTime() < Date.now() : false
          return (
            <NoteCard key={task.id} color={task.category?.color} className="postit-item">
              <div className="postit-item__top">
                <span className="postit-item__title">{task.title}</span>
                {task.due_at && (
                  <span className={`postit-item__when${late ? ' postit-item__when--late' : ''}`}>
                    {fmtRelative(task.due_at)}
                  </span>
                )}
              </div>
              <div className="postit-item__row">
                {task.category && (
                  <span className="postit-item__cat">
                    <i className="dot" style={{ background: task.category.color }} />
                    {task.category.name}
                  </span>
                )}
                <button
                  className="mini-btn"
                  onClick={() => void api.tasks.complete(task.id).then(reload)}
                >
                  Concluir
                </button>
                <button
                  className="mini-btn mini-btn--snooze"
                  onClick={() => void api.tasks.snooze(task.id).then(reload)}
                >
                  Adiar
                </button>
              </div>
            </NoteCard>
          )
        })}
      </div>

      <form className="postit__capture" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Capturar…  #Loja !alta @amanha 09:00"
          aria-label="Captura rápida"
        />
        <p className="postit__hint">#categoria · !prioridade · @quando · *recorrência</p>
      </form>
    </div>
  )
}
