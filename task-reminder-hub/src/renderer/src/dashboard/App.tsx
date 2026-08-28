import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TaskWithMeta } from '@shared/types'
import { api } from '../shared/api'
import { useAppEvent, useCategories, useSettings, useTheme } from '../shared/hooks'
import {
  addDays,
  addMonths,
  endOfDay,
  fmtFull,
  fmtDayMonth,
  fmtMonthYear,
  monthGrid,
  startOfDay,
  startOfWeek,
  weekDays
} from '../shared/date'
import { Sidebar } from './components/Sidebar'
import { dayKey } from './components/MiniCalendar'
import { TaskDialog } from './components/TaskDialog'
import { NewsPanel } from './components/NewsPanel'
import { SettingsDialog } from './components/SettingsDialog'
import { StatsPanel } from './components/StatsPanel'
import { ListView } from './views/ListView'
import { TimeGrid } from './views/TimeGrid'
import { MonthView } from './views/MonthView'

type View = 'lista' | 'dia' | 'semana' | 'mes'

const VIEWS: { id: View; label: string }[] = [
  { id: 'lista', label: 'Lista' },
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' }
]

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>('lista')
  const [reference, setReference] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<TaskWithMeta[]>([])
  const [monthTasks, setMonthTasks] = useState<TaskWithMeta[]>([])
  const [upcoming, setUpcoming] = useState<TaskWithMeta[]>([])
  const [hiddenCategories, setHiddenCategories] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<{ task: TaskWithMeta | null; date?: Date | null } | null>(null)
  const [panel, setPanel] = useState<'news' | 'stats' | 'settings' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [categories] = useCategories()
  const [settings, updateSettings] = useSettings()
  useTheme(settings?.theme)

  /** Janela de datas que a visao atual precisa carregar. */
  const range = useMemo(() => {
    switch (view) {
      case 'dia':
        return { from: startOfDay(reference), to: endOfDay(reference) }
      case 'semana': {
        const from = startOfWeek(reference)
        return { from, to: addDays(from, 7) }
      }
      case 'mes': {
        const grid = monthGrid(reference)
        return { from: grid[0], to: addDays(grid[41], 1) }
      }
      default:
        return null
    }
  }, [view, reference])

  const reload = useCallback(() => {
    void api.tasks
      .list({
        search: search.trim() || undefined,
        from: range?.from.toISOString(),
        to: range?.to.toISOString(),
        includeUndated: view === 'lista'
      })
      .then(setTasks)

    void api.tasks.upcoming(6).then(setUpcoming)

    // Marcadores do mini calendario cobrem o mes inteiro, independente da visao.
    const grid = monthGrid(reference)
    void api.tasks
      .list({ from: grid[0].toISOString(), to: addDays(grid[41], 1).toISOString() })
      .then(setMonthTasks)
  }, [range, search, view, reference])

  useEffect(reload, [reload])

  useAppEvent((event) => {
    if (event.type === 'data-changed' && event.scope === 'tasks') reload()
    if (event.type === 'reminder-fired') {
      setToast(`Lembrete: ${event.title}`)
      window.setTimeout(() => setToast(null), 4_000)
      reload()
    }
    if (event.type === 'focus-task') {
      void api.tasks.get(event.taskId).then((task) => {
        if (task) setEditing({ task })
      })
    }
  })

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => !task.category_id || !hiddenCategories.has(task.category_id)),
    [tasks, hiddenCategories]
  )

  const markedDays = useMemo(() => {
    const marks = new Set<string>()
    for (const task of monthTasks) {
      if (task.due_at) marks.add(dayKey(new Date(task.due_at)))
    }
    return marks
  }, [monthTasks])

  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const task of monthTasks) {
      if (task.category_id && task.status !== 'concluida') {
        map.set(task.category_id, (map.get(task.category_id) ?? 0) + 1)
      }
    }
    return map
  }, [monthTasks])

  const step = (direction: number): void => {
    if (view === 'mes') setReference(addMonths(reference, direction))
    else if (view === 'semana') setReference(addDays(reference, 7 * direction))
    else setReference(addDays(reference, direction))
  }

  const periodLabel = (): string => {
    switch (view) {
      case 'dia':
        return fmtFull(reference)
      case 'semana': {
        const days = weekDays(reference)
        return `${fmtDayMonth(days[0])} – ${fmtDayMonth(days[6])}`
      }
      case 'mes':
        return fmtMonthYear(reference)
      default:
        return 'Todas as tarefas'
    }
  }

  const reschedule = (taskId: number, date: Date): void => {
    void api.tasks.reschedule(taskId, date.toISOString()).then(reload)
  }

  const toggleDone = (task: TaskWithMeta): void => {
    const action = task.status === 'concluida' ? api.tasks.reopen : api.tasks.complete
    void action(task.id).then(reload)
  }

  return (
    <div className="app">
      <Sidebar
        categories={categories}
        hiddenCategories={hiddenCategories}
        onToggleCategory={(id) =>
          setHiddenCategories((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }
        counts={counts}
        selectedDate={reference}
        onSelectDate={(date) => {
          setReference(date)
          if (view === 'lista') setView('dia')
        }}
        markedDays={markedDays}
        upcoming={upcoming}
        onOpenTask={(task) => setEditing({ task })}
        onOpenNews={() => setPanel('news')}
        onOpenStats={() => setPanel('stats')}
        onOpenSettings={() => setPanel('settings')}
      />

      <main className="main">
        <header className="topbar">
          <button className="btn" onClick={() => setReference(new Date())}>
            Hoje
          </button>
          <div className="topbar__nav">
            <button onClick={() => step(-1)} aria-label="Anterior">
              ‹
            </button>
            <button onClick={() => step(1)} aria-label="Próximo">
              ›
            </button>
          </div>
          <h1 className="topbar__period">{periodLabel()}</h1>

          <div className="seg">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="search">
            <span className="search__icon">⌕</span>
            <input
              className="field"
              placeholder="Buscar tarefa ou agenda"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <button className="btn btn--primary" onClick={() => setEditing({ task: null })}>
            + Nova tarefa
          </button>
        </header>

        <div className={`view${view === 'lista' ? '' : ' view--grid'}`}>
          {view === 'lista' && (
            <ListView
              tasks={visibleTasks}
              onOpenTask={(task) => setEditing({ task })}
              onToggleDone={toggleDone}
              onSnooze={(task) => void api.tasks.snooze(task.id).then(reload)}
              onDelete={(task) => void api.tasks.remove(task.id).then(reload)}
            />
          )}

          {view === 'dia' && (
            <TimeGrid
              days={[reference]}
              tasks={visibleTasks}
              onOpenTask={(task) => setEditing({ task })}
              onReschedule={reschedule}
            />
          )}

          {view === 'semana' && (
            <TimeGrid
              days={weekDays(reference)}
              tasks={visibleTasks}
              onOpenTask={(task) => setEditing({ task })}
              onReschedule={reschedule}
            />
          )}

          {view === 'mes' && (
            <MonthView
              reference={reference}
              tasks={visibleTasks}
              onOpenTask={(task) => setEditing({ task })}
              onReschedule={reschedule}
              onOpenDay={(date) => {
                setReference(date)
                setView('dia')
              }}
            />
          )}
        </div>
      </main>

      {editing && (
        <TaskDialog
          task={editing.task}
          initialDate={editing.date}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}

      {panel === 'news' && <NewsPanel categories={categories} onClose={() => setPanel(null)} />}
      {panel === 'stats' && <StatsPanel onClose={() => setPanel(null)} />}
      {panel === 'settings' && settings && (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          onClose={() => setPanel(null)}
        />
      )}

      {toast && <div className="toast-strip">{toast}</div>}
    </div>
  )
}
