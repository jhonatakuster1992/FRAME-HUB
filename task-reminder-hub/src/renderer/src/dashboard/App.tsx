import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TaskWithMeta } from '@shared/types'
import { api } from '../shared/api'
import { Icon } from '../shared/Icon'
import { useAppEvent, useCategories, useSettings, useTheme } from '../shared/hooks'
import {
  addDays,
  addMonths,
  endOfDay,
  fmtDayMonth,
  fmtFull,
  fmtMonthYear,
  monthGrid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekDays
} from '../shared/date'
import { Sidebar, type Section } from './components/Sidebar'
import { SearchPanel, type PeriodFilter } from './components/SearchPanel'
import { CategoryChips } from './components/CategoryChips'
import { RightRail } from './components/RightRail'
import { dayKey } from './components/MiniCalendar'
import { TaskDialog } from './components/TaskDialog'
import { BriefingSection } from './components/BriefingSection'
import { StatsSection } from './components/StatsSection'
import { SettingsSection } from './components/SettingsSection'
import { ListView } from './views/ListView'
import { TimeGrid } from './views/TimeGrid'
import { MonthView } from './views/MonthView'

type CalView = 'dia' | 'semana' | 'mes'
type SortKey = 'proximas' | 'prioridade' | 'recentes'

const CAL_VIEWS: { id: CalView; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' }
]

const PRIORITY_WEIGHT = { alta: 0, media: 1, baixa: 2 } as const

const SECTION_TITLES: Record<Section, { title: string; sub: string }> = {
  tarefas: { title: 'Buscar tarefas', sub: 'Capturadas, agendadas e com lembrete' },
  agenda: { title: 'Agenda', sub: 'Dia, semana e mês — arraste para reagendar' },
  briefing: { title: 'Briefing de notícias', sub: 'Das suas fontes, em voz' },
  produtividade: { title: 'Produtividade', sub: 'O que fecha e o que você adia' },
  ajustes: { title: 'Ajustes', sub: 'Atalho, inicialização e voz' }
}

/** Recorte de datas de cada filtro do painel de busca. */
function inPeriod(task: TaskWithMeta, period: PeriodFilter): boolean {
  if (period === 'todas') return true
  if (!task.due_at) return false
  const due = new Date(task.due_at)
  const today = startOfDay(new Date())

  switch (period) {
    case 'hoje':
      return due >= today && due < addDays(today, 1)
    case 'semana':
      return due >= today && due < addDays(today, 7)
    case 'mes':
      return due >= startOfMonth(new Date()) && due < addMonths(startOfMonth(new Date()), 1)
    case 'atrasadas':
      return due < new Date() && task.status !== 'concluida'
    default:
      return true
  }
}

export function App(): React.JSX.Element {
  const [section, setSection] = useState<Section>('tarefas')
  const [collapsed, setCollapsed] = useState(false)
  const [calView, setCalView] = useState<CalView>('semana')
  const [reference, setReference] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<PeriodFilter>('todas')
  const [showCompleted, setShowCompleted] = useState(false)
  const [includeUndated, setIncludeUndated] = useState(true)
  const [sort, setSort] = useState<SortKey>('proximas')
  const [density, setDensity] = useState<'grade' | 'linhas'>('grade')
  const [tasks, setTasks] = useState<TaskWithMeta[]>([])
  const [monthTasks, setMonthTasks] = useState<TaskWithMeta[]>([])
  const [upcoming, setUpcoming] = useState<TaskWithMeta[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ task: TaskWithMeta | null; date?: Date | null } | null>(
    null
  )
  const [toast, setToast] = useState<string | null>(null)

  const [categories] = useCategories()
  const [settings, updateSettings] = useSettings()
  useTheme(settings?.theme)

  const isAgenda = section === 'agenda'

  /** Janela de datas que a visão de agenda precisa carregar. */
  const range = useMemo(() => {
    if (!isAgenda) return null
    switch (calView) {
      case 'dia':
        return { from: startOfDay(reference), to: endOfDay(reference) }
      case 'semana': {
        const from = startOfWeek(reference)
        return { from, to: addDays(from, 7) }
      }
      default: {
        const grid = monthGrid(reference)
        return { from: grid[0], to: addDays(grid[41], 1) }
      }
    }
  }, [isAgenda, calView, reference])

  const reload = useCallback(() => {
    void api.tasks
      .list({
        search: search.trim() || undefined,
        from: range?.from.toISOString(),
        to: range?.to.toISOString(),
        includeUndated: !range
      })
      .then(setTasks)

    void api.tasks.upcoming(5).then(setUpcoming)

    const grid = monthGrid(reference)
    void api.tasks
      .list({ from: grid[0].toISOString(), to: addDays(grid[41], 1).toISOString() })
      .then(setMonthTasks)
  }, [range, search, reference])

  useEffect(reload, [reload])

  useAppEvent((event) => {
    if (event.type === 'data-changed' && event.scope === 'tasks') reload()
    if (event.type === 'reminder-fired') {
      setToast(event.title)
      window.setTimeout(() => setToast(null), 4_000)
      reload()
    }
    if (event.type === 'focus-task') {
      void api.tasks.get(event.taskId).then((task) => {
        if (task) setEditing({ task })
      })
    }
  })

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (categoryFilter !== null && task.category_id !== categoryFilter) return false
      if (isAgenda) return true
      if (!showCompleted && task.status === 'concluida') return false
      if (!includeUndated && !task.due_at) return false
      return inPeriod(task, period)
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sort === 'prioridade') {
        const delta = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
        if (delta !== 0) return delta
      }
      if (sort === 'recentes') return b.created_at.localeCompare(a.created_at)
      if (!a.due_at && !b.due_at) return b.created_at.localeCompare(a.created_at)
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return a.due_at.localeCompare(b.due_at)
    })
    return sorted
  }, [tasks, categoryFilter, isAgenda, showCompleted, includeUndated, period, sort])

  const markedDays = useMemo(() => {
    const marks = new Set<string>()
    for (const task of monthTasks) if (task.due_at) marks.add(dayKey(new Date(task.due_at)))
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

  const overdue = useMemo(
    () =>
      upcoming.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length,
    [upcoming]
  )

  const step = (direction: number): void => {
    if (calView === 'mes') setReference(addMonths(reference, direction))
    else if (calView === 'semana') setReference(addDays(reference, 7 * direction))
    else setReference(addDays(reference, direction))
  }

  const periodLabel = (): string => {
    if (calView === 'dia') return fmtFull(reference)
    if (calView === 'mes') return fmtMonthYear(reference)
    const days = weekDays(reference)
    return `${fmtDayMonth(days[0])} – ${fmtDayMonth(days[6])}`
  }

  const reschedule = (taskId: number, date: Date): void => {
    void api.tasks.reschedule(taskId, date.toISOString()).then(reload)
  }

  const toggleDone = (task: TaskWithMeta): void => {
    const action = task.status === 'concluida' ? api.tasks.reopen : api.tasks.complete
    void action(task.id).then(reload)
  }

  const showsRail = isAgenda
  const header = SECTION_TITLES[section]

  return (
    <div className={`shell${collapsed ? ' shell--compacta' : ''}`}>
      <Sidebar
        section={section}
        onSection={setSection}
        pendingCount={monthTasks.filter((task) => task.status !== 'concluida').length}
        hotkey={settings?.globalHotkey ?? 'Ctrl+Alt+Space'}
        collapsed={collapsed}
        theme={settings?.theme}
        onTheme={(theme) => updateSettings({ theme })}
      />

      <div className="content">
        <header className="topbar">
          <button
            className="topbar__menu"
            onClick={() => setCollapsed((value) => !value)}
            aria-label="Recolher menu"
          >
            <Icon name="menu" className="icon icon--lg" strokeWidth={2.2} />
          </button>
          <div>
            <h1 className="topbar__title">{header.title}</h1>
            <p className="topbar__sub">{header.sub}</p>
          </div>

          <div className="topbar__search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Busque alguma coisa aqui…"
              aria-label="Buscar"
            />
            <Icon name="busca" className="icon icon--sm topbar__search-icon" />
          </div>

          <button
            className="round-btn"
            title={`${overdue} tarefa(s) atrasada(s)`}
            onClick={() => {
              setSection('tarefas')
              setPeriod('atrasadas')
            }}
          >
            <Icon name="sino" />
            {overdue > 0 && <span className="round-btn__badge">{overdue}</span>}
          </button>

          <button
            className="round-btn"
            title="Post-it flutuante"
            onClick={() => void api.window.togglePostit()}
          >
            <Icon name="janela" />
          </button>

          <button className="btn btn--primary" onClick={() => setEditing({ task: null })}>
            <Icon name="mais" className="icon icon--sm" /> Nova tarefa
          </button>
        </header>

        <div
          className={['body', showsRail ? '' : 'body--full', isAgenda ? 'body--fixa' : '']
            .filter(Boolean)
            .join(' ')}
        >
          <div className="main-col">
            {section === 'tarefas' && (
              <>
                <SearchPanel
                  period={period}
                  onPeriod={setPeriod}
                  search={search}
                  onSearch={setSearch}
                  onClear={() => {
                    setSearch('')
                    setPeriod('todas')
                    setCategoryFilter(null)
                  }}
                  onSubmit={reload}
                />

                <CategoryChips
                  categories={categories}
                  selected={categoryFilter}
                  total={tasks.length}
                  counts={counts}
                  onSelect={setCategoryFilter}
                  allowCreate
                />

                <div className="results">
                  <div>
                    <h2 className="results__count">
                      Mostrando {visibleTasks.length} tarefa{visibleTasks.length === 1 ? '' : 's'}
                    </h2>
                    <p className="results__hint">Conforme seus filtros e agendas ativas</p>
                  </div>

                  <div className="results__tools">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={showCompleted}
                        onChange={(event) => setShowCompleted(event.target.checked)}
                      />
                      <span className="switch__track" />
                      Concluídas
                    </label>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={includeUndated}
                        onChange={(event) => setIncludeUndated(event.target.checked)}
                      />
                      <span className="switch__track" />
                      Sem data
                    </label>

                    <select
                      className="select"
                      value={sort}
                      onChange={(event) => setSort(event.target.value as SortKey)}
                      aria-label="Ordenar por"
                    >
                      <option value="proximas">Mais próximas</option>
                      <option value="prioridade">Prioridade</option>
                      <option value="recentes">Mais recentes</option>
                    </select>

                    <div className="view-toggle">
                      <button
                        aria-pressed={density === 'linhas'}
                        onClick={() => setDensity('linhas')}
                        title="Lista"
                      >
                        <Icon name="linhas" className="icon icon--sm" />
                      </button>
                      <button
                        aria-pressed={density === 'grade'}
                        onClick={() => setDensity('grade')}
                        title="Grade"
                      >
                        <Icon name="grade" className="icon icon--sm" />
                      </button>
                    </div>
                  </div>
                </div>

                <ListView
                  tasks={visibleTasks}
                  density={density}
                  onOpenTask={(task) => setEditing({ task })}
                  onToggleDone={toggleDone}
                  onSnooze={(task) => void api.tasks.snooze(task.id).then(reload)}
                  onDelete={(task) => void api.tasks.remove(task.id).then(reload)}
                />
              </>
            )}

            {isAgenda && (
              <>
                <div className="searchpanel">
                  <button className="btn btn--soft" onClick={() => setReference(new Date())}>
                    Hoje
                  </button>
                  <button
                    className="round-btn"
                    style={{ width: 40, height: 40, boxShadow: 'none' }}
                    onClick={() => step(-1)}
                    aria-label="Período anterior"
                  >
                    <Icon name="esquerda" className="icon icon--sm" />
                  </button>
                  <button
                    className="round-btn"
                    style={{ width: 40, height: 40, boxShadow: 'none' }}
                    onClick={() => step(1)}
                    aria-label="Próximo período"
                  >
                    <Icon name="direita" className="icon icon--sm" />
                  </button>
                  <span
                    className="searchpanel__seg"
                    style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}
                  >
                    {periodLabel()}
                  </span>
                  <div className="seg" style={{ marginLeft: 'auto' }}>
                    {CAL_VIEWS.map((item) => (
                      <button
                        key={item.id}
                        aria-pressed={calView === item.id}
                        onClick={() => setCalView(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <CategoryChips
                  categories={categories}
                  selected={categoryFilter}
                  total={tasks.length}
                  counts={counts}
                  onSelect={setCategoryFilter}
                />

                {calView === 'mes' ? (
                  <MonthView
                    reference={reference}
                    tasks={visibleTasks}
                    onOpenTask={(task) => setEditing({ task })}
                    onReschedule={reschedule}
                    onOpenDay={(date) => {
                      setReference(date)
                      setCalView('dia')
                    }}
                  />
                ) : (
                  <TimeGrid
                    days={calView === 'dia' ? [reference] : weekDays(reference)}
                    tasks={visibleTasks}
                    onOpenTask={(task) => setEditing({ task })}
                    onReschedule={reschedule}
                    onCreateAt={(date) => setEditing({ task: null, date })}
                  />
                )}
              </>
            )}

            {section === 'briefing' && <BriefingSection categories={categories} />}
            {section === 'produtividade' && <StatsSection />}
            {section === 'ajustes' && settings && (
              <SettingsSection settings={settings} onChange={updateSettings} />
            )}
          </div>

          {showsRail && (
            <RightRail
              selectedDate={reference}
              onSelectDate={(date) => {
                setReference(date)
                setSection('agenda')
                if (calView === 'mes') setCalView('dia')
              }}
              markedDays={markedDays}
              upcoming={upcoming}
              onOpenTask={(task) => setEditing({ task })}
            />
          )}
        </div>
      </div>

      {editing && (
        <TaskDialog
          task={editing.task}
          initialDate={editing.date}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}

      {toast && (
        <div className="toast-strip">
          <Icon name="sino" className="icon icon--sm" />
          Lembrete: {toast}
        </div>
      )}
    </div>
  )
}
