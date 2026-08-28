import { useEffect, useState } from 'react'
import type { ProductivityStats } from '@shared/types'
import { api } from '../../shared/api'
import { NoteCard } from '../../shared/NoteCard'

/** Padroes de produtividade a partir do historico de conclusoes/adiamentos. */
export function StatsSection(): React.JSX.Element {
  const [stats, setStats] = useState<ProductivityStats | null>(null)

  useEffect(() => {
    void api.tasks.stats().then(setStats)
  }, [])

  const byDay = stats?.completedByDay ?? []
  const max = Math.max(1, ...byDay.map((day) => day.count))
  const ratio =
    stats && stats.completed7d + stats.snoozed7d > 0
      ? Math.round((stats.completed7d / (stats.completed7d + stats.snoozed7d)) * 100)
      : 0

  return (
    <section className="section">
      <header className="section__head">
        <p className="section__sub section__title">
          Conclusões e adiamentos dos últimos 7 dias.
        </p>
      </header>

      <div className="section__grid">
        <NoteCard color="var(--done)" className="stat" interactive={false}>
          <div className="stat__value">{stats?.completed7d ?? 0}</div>
          <div className="stat__label">concluídas</div>
        </NoteCard>
        <NoteCard color="var(--c-violeta)" className="stat" interactive={false}>
          <div className="stat__value">{stats?.snoozed7d ?? 0}</div>
          <div className="stat__label">adiamentos</div>
        </NoteCard>
        <NoteCard color="var(--c-ambar)" className="stat" interactive={false}>
          <div className="stat__value">{ratio}%</div>
          <div className="stat__label">fechadas de primeira</div>
        </NoteCard>
      </div>

      <div>
        <h2 className="rail__title">Conclusões por dia</h2>
        {byDay.length === 0 ? (
          <p className="rail__empty">Nada concluído nos últimos 7 dias.</p>
        ) : (
          <>
            <div className="spark">
              {byDay.map((day) => (
                <div
                  key={day.date}
                  className="spark__bar"
                  style={{ height: `${Math.max((day.count / max) * 100, 4)}%` }}
                  title={`${day.date}: ${day.count}`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {byDay.map((day) => (
                <div key={day.date} className="spark__day" style={{ flex: 1 }}>
                  {day.date.slice(8)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {(stats?.topSnoozedTasks.length ?? 0) > 0 && (
        <div>
          <h2 className="rail__title">Mais adiadas</h2>
          <div className="rail__list">
            {stats?.topSnoozedTasks.map((task) => (
              <div key={task.task_id} className="source-row">
                <span className="source-row__name">{task.title}</span>
                <span className="chip chip--accent">{task.snoozes}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
