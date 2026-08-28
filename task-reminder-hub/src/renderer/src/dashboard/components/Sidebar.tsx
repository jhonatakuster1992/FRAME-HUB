import { useState } from 'react'
import type { Category, TaskWithMeta } from '@shared/types'
import { api } from '../../shared/api'
import { NoteCard } from '../../shared/NoteCard'
import { fmtRelative } from '../../shared/date'
import { MiniCalendar } from './MiniCalendar'

interface Props {
  categories: Category[]
  hiddenCategories: Set<number>
  onToggleCategory: (id: number) => void
  counts: Map<number, number>
  selectedDate: Date
  onSelectDate: (date: Date) => void
  markedDays: Set<string>
  upcoming: TaskWithMeta[]
  onOpenTask: (task: TaskWithMeta) => void
  onOpenNews: () => void
  onOpenStats: () => void
  onOpenSettings: () => void
}

export function Sidebar({
  categories,
  hiddenCategories,
  onToggleCategory,
  counts,
  selectedDate,
  onSelectDate,
  markedDays,
  upcoming,
  onOpenTask,
  onOpenNews,
  onOpenStats,
  onOpenSettings
}: Props): React.JSX.Element {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8B7FD1')

  const addCategory = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setNewName('')
    await api.categories.create({ name, color: newColor })
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark" />
        <span className="brand__name">Task &amp; Reminder Hub</span>
      </div>

      <MiniCalendar selected={selectedDate} onSelect={onSelectDate} markedDays={markedDays} />

      <section>
        <h2 className="sidebar__section-title">Agendas</h2>
        {categories.map((category) => {
          const off = hiddenCategories.has(category.id)
          return (
            <button
              key={category.id}
              className={`cat-row${off ? ' cat-row--off' : ''}`}
              style={{ ['--cat-color' as string]: category.color }}
              onClick={() => onToggleCategory(category.id)}
              title={off ? 'Mostrar no calendário' : 'Ocultar do calendário'}
            >
              <span className="cat-row__box">{off ? '' : '✓'}</span>
              {category.name}
              <span className="cat-row__count">{counts.get(category.id) ?? 0}</span>
            </button>
          )
        })}

        <form className="cat-add" onSubmit={addCategory}>
          <input
            className="field"
            placeholder="Nova agenda"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <input
            className="field"
            type="color"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            aria-label="Cor da agenda"
          />
        </form>
      </section>

      <section>
        <h2 className="sidebar__section-title">Próximos</h2>
        <div className="upcoming">
          {upcoming.length === 0 && <p className="upcoming__empty">Nada agendado.</p>}
          {upcoming.map((task) => (
            <NoteCard
              key={task.id}
              color={task.category?.color}
              className="upcoming__item"
              onClick={() => onOpenTask(task)}
            >
              <div className="upcoming__title">{task.title}</div>
              <div className="upcoming__when">{fmtRelative(task.due_at)}</div>
            </NoteCard>
          ))}
        </div>
      </section>

      <div className="sidebar__foot">
        <button className="btn btn--ghost" onClick={onOpenNews}>
          🔊 Briefing de notícias
        </button>
        <button className="btn btn--ghost" onClick={onOpenStats}>
          📈 Produtividade
        </button>
        <button className="btn btn--ghost" onClick={onOpenSettings}>
          ⚙ Configurações
        </button>
      </div>
    </aside>
  )
}
