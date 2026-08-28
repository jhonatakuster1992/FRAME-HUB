import { useEffect, useState } from 'react'
import type { ProductivityStats } from '@shared/types'
import { api } from '../../shared/api'
import { NoteCard } from '../../shared/NoteCard'
import { useEscape } from '../../shared/hooks'

/** Padroes de produtividade a partir do historico de conclusoes/adiamentos. */
export function StatsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [stats, setStats] = useState<ProductivityStats | null>(null)
  useEscape(onClose)

  useEffect(() => {
    void api.tasks.stats().then(setStats)
  }, [])

  const max = Math.max(1, ...(stats?.completedByDay.map((day) => day.count) ?? [1]))

  return (
    <aside className="drawer">
      <header className="drawer__head">
        <h2 className="drawer__title display">Produtividade · 7 dias</h2>
        <button className="btn btn--ghost" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="drawer__body">
        <div className="stat-grid">
          <NoteCard color="var(--musgo)" className="stat" interactive={false}>
            <div className="stat__value">{stats?.completed7d ?? 0}</div>
            <div className="stat__label">concluídas</div>
          </NoteCard>
          <NoteCard color="var(--uva)" className="stat" interactive={false}>
            <div className="stat__value">{stats?.snoozed7d ?? 0}</div>
            <div className="stat__label">adiamentos</div>
          </NoteCard>
        </div>

        <div>
          <h3 style={{ fontSize: 12, color: 'var(--text-faint)' }}>Conclusões por dia</h3>
          <div className="spark">
            {(stats?.completedByDay ?? []).map((day) => (
              <div
                key={day.date}
                className="spark__bar"
                style={{ height: `${(day.count / max) * 100}%` }}
                title={`${day.date}: ${day.count}`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(stats?.completedByDay ?? []).map((day) => (
              <div key={day.date} className="spark__day" style={{ flex: 1 }}>
                {day.date.slice(8)}
              </div>
            ))}
          </div>
          {stats?.completedByDay.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
              Nada concluído nos últimos 7 dias.
            </p>
          )}
        </div>

        {(stats?.topSnoozedTasks.length ?? 0) > 0 && (
          <div>
            <h3 style={{ fontSize: 12, color: 'var(--text-faint)' }}>Mais adiadas</h3>
            {stats?.topSnoozedTasks.map((task) => (
              <div key={task.task_id} className="source-row">
                <span className="source-row__name">{task.title}</span>
                <span className="chip">{task.snoozes}×</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
