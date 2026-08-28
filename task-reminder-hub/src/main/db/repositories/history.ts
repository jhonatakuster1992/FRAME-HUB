import type { HistoryAction, HistoryEntry, ProductivityStats } from '@shared/types'
import { getDatabase } from '../index'

export function log(taskId: number, action: HistoryAction, meta?: unknown): void {
  getDatabase()
    .prepare('INSERT INTO history (task_id, action, timestamp, meta) VALUES (?, ?, ?, ?)')
    .run(taskId, action, new Date().toISOString(), meta === undefined ? null : JSON.stringify(meta))
}

export function listForTask(taskId: number): HistoryEntry[] {
  return getDatabase()
    // id como desempate: dois eventos podem cair no mesmo milissegundo
    .prepare('SELECT * FROM history WHERE task_id = ? ORDER BY timestamp DESC, id DESC')
    .all(taskId) as HistoryEntry[]
}

/** Alimenta o painel "padroes de produtividade" do dashboard. */
export function stats(days = 7): ProductivityStats {
  const db = getDatabase()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const count = (action: HistoryAction): number =>
    (
      db
        .prepare('SELECT COUNT(*) AS n FROM history WHERE action = ? AND timestamp >= ?')
        .get(action, since) as { n: number }
    ).n

  const completedByDay = db
    .prepare(
      `SELECT substr(timestamp, 1, 10) AS date, COUNT(*) AS count
       FROM history WHERE action = 'completed' AND timestamp >= ?
       GROUP BY date ORDER BY date`
    )
    .all(since) as { date: string; count: number }[]

  const topSnoozedTasks = db
    .prepare(
      `SELECT h.task_id, t.title, COUNT(*) AS snoozes
       FROM history h JOIN tasks t ON t.id = h.task_id
       WHERE h.action = 'snoozed' AND h.timestamp >= ?
       GROUP BY h.task_id ORDER BY snoozes DESC LIMIT 5`
    )
    .all(since) as { task_id: number; title: string; snoozes: number }[]

  return {
    completed7d: count('completed'),
    snoozed7d: count('snoozed'),
    completedByDay,
    topSnoozedTasks
  }
}
