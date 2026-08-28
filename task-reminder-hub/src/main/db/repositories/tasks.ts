import type {
  Reminder,
  ReminderInput,
  Task,
  TaskInput,
  TaskQuery,
  TaskWithMeta
} from '@shared/types'
import { computeNextTrigger, validateRecurrence } from '@shared/recurrence'
import { getDatabase, nowIso, toBool, fromBool } from '../index'
import { getCategory } from './categories'
import * as history from './history'

interface TaskRow extends Omit<Task, never> {}
interface ReminderRow extends Omit<Reminder, 'enabled'> {
  enabled: number
}

const mapReminder = (row: ReminderRow): Reminder => ({ ...row, enabled: toBool(row.enabled) })

function withMeta(task: Task): TaskWithMeta {
  const reminderRow = getDatabase()
    .prepare('SELECT * FROM reminders WHERE task_id = ?')
    .get(task.id) as ReminderRow | undefined
  return {
    ...task,
    category: task.category_id ? getCategory(task.category_id) : null,
    reminder: reminderRow ? mapReminder(reminderRow) : null
  }
}

export function getTask(id: number): TaskWithMeta | null {
  const row = getDatabase().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
    | TaskRow
    | undefined
  return row ? withMeta(row) : null
}

export function listTasks(query: TaskQuery = {}): TaskWithMeta[] {
  const where: string[] = []
  const params: unknown[] = []

  if (query.search) {
    where.push(`(t.title LIKE ? OR IFNULL(t.description,'') LIKE ? OR IFNULL(c.name,'') LIKE ?)`)
    const like = `%${query.search}%`
    params.push(like, like, like)
  }
  if (query.categoryIds?.length) {
    where.push(`t.category_id IN (${query.categoryIds.map(() => '?').join(',')})`)
    params.push(...query.categoryIds)
  }
  if (query.statuses?.length) {
    where.push(`t.status IN (${query.statuses.map(() => '?').join(',')})`)
    params.push(...query.statuses)
  }
  if (query.from || query.to) {
    const range: string[] = []
    if (query.from && query.to) {
      range.push('(t.due_at >= ? AND t.due_at < ?)')
      params.push(query.from, query.to)
    } else if (query.from) {
      range.push('t.due_at >= ?')
      params.push(query.from)
    } else {
      range.push('t.due_at < ?')
      params.push(query.to)
    }
    if (query.includeUndated) range.push('t.due_at IS NULL')
    where.push(`(${range.join(' OR ')})`)
  }

  const sql = `
    SELECT t.* FROM tasks t
    LEFT JOIN categories c ON c.id = t.category_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY (t.due_at IS NULL), t.due_at,
             CASE t.priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
             t.created_at DESC
    ${query.limit ? 'LIMIT ?' : ''}`
  if (query.limit) params.push(query.limit)

  return (getDatabase().prepare(sql).all(...params) as TaskRow[]).map(withMeta)
}

/** Lista "Proximos" da sidebar: pendentes com data, ordenados pelo mais proximo. */
export function upcoming(limit = 8): TaskWithMeta[] {
  return (
    getDatabase()
      .prepare(
        `SELECT * FROM tasks
         WHERE status != 'concluida' AND due_at IS NOT NULL AND due_at >= ?
         ORDER BY due_at LIMIT ?`
      )
      .all(new Date(Date.now() - 3_600_000).toISOString(), limit) as TaskRow[]
  ).map(withMeta)
}

function resolveNextTrigger(input: ReminderInput, dueAt: string | null): string | null {
  if (input.next_trigger_at) return input.next_trigger_at
  if (input.recurrence_type === 'once') return dueAt
  const next = computeNextTrigger(
    { type: input.recurrence_type, value: input.recurrence_value ?? null },
    new Date()
  )
  return next ? next.toISOString() : dueAt
}

function upsertReminder(taskId: number, input: ReminderInput | null, dueAt: string | null): void {
  const db = getDatabase()
  if (!input) {
    db.prepare('DELETE FROM reminders WHERE task_id = ?').run(taskId)
    return
  }
  validateRecurrence({ type: input.recurrence_type, value: input.recurrence_value ?? null })
  db.prepare(
    `INSERT INTO reminders (task_id, recurrence_type, recurrence_value, next_trigger_at, enabled)
     VALUES (@task_id, @type, @value, @next, @enabled)
     ON CONFLICT(task_id) DO UPDATE SET
       recurrence_type  = excluded.recurrence_type,
       recurrence_value = excluded.recurrence_value,
       next_trigger_at  = excluded.next_trigger_at,
       enabled          = excluded.enabled`
  ).run({
    task_id: taskId,
    type: input.recurrence_type,
    value: input.recurrence_value ?? null,
    next: resolveNextTrigger(input, dueAt),
    enabled: fromBool(input.enabled)
  })
}

export function createTask(input: TaskInput): TaskWithMeta {
  const db = getDatabase()
  const timestamp = nowIso()
  const create = db.transaction((): number => {
    const info = db
      .prepare(
        `INSERT INTO tasks
           (title, description, category_id, priority, status, due_at, duration_minutes, created_at, updated_at)
         VALUES (@title, @description, @category_id, @priority, @status, @due_at, @duration, @ts, @ts)`
      )
      .run({
        title: input.title.trim(),
        description: input.description ?? null,
        category_id: input.category_id ?? null,
        priority: input.priority ?? 'media',
        status: input.status ?? 'pendente',
        due_at: input.due_at ?? null,
        duration: input.duration_minutes ?? 30,
        ts: timestamp
      })
    const id = Number(info.lastInsertRowid)
    upsertReminder(id, input.reminder ?? null, input.due_at ?? null)
    history.log(id, 'created')
    return id
  })
  return getTask(create())!
}

export function updateTask(id: number, patch: Partial<TaskInput>): TaskWithMeta | null {
  const current = getTask(id)
  if (!current) return null
  const db = getDatabase()

  const apply = db.transaction(() => {
    const dueAt = patch.due_at !== undefined ? patch.due_at : current.due_at
    db.prepare(
      `UPDATE tasks SET title = @title, description = @description, category_id = @category_id,
         priority = @priority, status = @status, due_at = @due_at,
         duration_minutes = @duration, updated_at = @ts
       WHERE id = @id`
    ).run({
      id,
      title: (patch.title ?? current.title).trim(),
      description: patch.description !== undefined ? patch.description : current.description,
      category_id: patch.category_id !== undefined ? patch.category_id : current.category_id,
      priority: patch.priority ?? current.priority,
      status: patch.status ?? current.status,
      due_at: dueAt,
      duration: patch.duration_minutes ?? current.duration_minutes,
      ts: nowIso()
    })
    if (patch.reminder !== undefined) upsertReminder(id, patch.reminder, dueAt)
    if (patch.due_at !== undefined && patch.due_at !== current.due_at) {
      history.log(id, 'rescheduled', { from: current.due_at, to: patch.due_at })
    }
  })
  apply()
  return getTask(id)
}

export function deleteTask(id: number): void {
  getDatabase().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function completeTask(id: number): TaskWithMeta | null {
  const db = getDatabase()
  const task = getTask(id)
  if (!task) return null

  const apply = db.transaction(() => {
    const timestamp = nowIso()
    db.prepare(
      `UPDATE tasks SET status = 'concluida', completed_at = ?, updated_at = ? WHERE id = ?`
    ).run(timestamp, timestamp, id)
    history.log(id, 'completed')

    // Lembrete recorrente sobrevive a conclusao: reabre no proximo disparo.
    const reminder = task.reminder
    if (reminder && reminder.recurrence_type !== 'once' && reminder.enabled) {
      const next = computeNextTrigger(
        { type: reminder.recurrence_type, value: reminder.recurrence_value },
        new Date()
      )
      db.prepare('UPDATE reminders SET next_trigger_at = ? WHERE task_id = ?').run(
        next ? next.toISOString() : null,
        id
      )
    }
  })
  apply()
  return getTask(id)
}

export function reopenTask(id: number): TaskWithMeta | null {
  getDatabase()
    .prepare(`UPDATE tasks SET status = 'pendente', completed_at = NULL, updated_at = ? WHERE id = ?`)
    .run(nowIso(), id)
  history.log(id, 'reopened')
  return getTask(id)
}

/** Adia a tarefa por N minutos (a acao "Adiar" do toast). */
export function snoozeTask(id: number, minutes: number): TaskWithMeta | null {
  const task = getTask(id)
  if (!task) return null
  const db = getDatabase()
  const target = new Date(Date.now() + minutes * 60_000).toISOString()

  const apply = db.transaction(() => {
    db.prepare(`UPDATE tasks SET status = 'adiada', updated_at = ? WHERE id = ?`).run(nowIso(), id)
    if (task.reminder) {
      db.prepare('UPDATE reminders SET next_trigger_at = ? WHERE task_id = ?').run(target, id)
    } else {
      db.prepare(
        `INSERT INTO reminders (task_id, recurrence_type, recurrence_value, next_trigger_at)
         VALUES (?, 'once', NULL, ?)`
      ).run(id, target)
    }
    history.log(id, 'snoozed', { minutes })
  })
  apply()
  return getTask(id)
}

/** Drag-and-drop no calendario. */
export function rescheduleTask(id: number, dueAt: string): TaskWithMeta | null {
  const task = getTask(id)
  if (!task) return null
  const db = getDatabase()
  const apply = db.transaction(() => {
    db.prepare('UPDATE tasks SET due_at = ?, updated_at = ? WHERE id = ?').run(dueAt, nowIso(), id)
    if (task.reminder?.recurrence_type === 'once') {
      db.prepare('UPDATE reminders SET next_trigger_at = ? WHERE task_id = ?').run(dueAt, id)
    }
    history.log(id, 'rescheduled', { from: task.due_at, to: dueAt })
  })
  apply()
  return getTask(id)
}

/* ---------- usados pelo agendador ---------- */

export function dueReminders(now: Date = new Date()): { task: TaskWithMeta; reminder: Reminder }[] {
  const rows = getDatabase()
    .prepare(
      `SELECT r.* FROM reminders r
       JOIN tasks t ON t.id = r.task_id
       WHERE r.enabled = 1 AND r.next_trigger_at IS NOT NULL AND r.next_trigger_at <= ?
         AND t.status != 'concluida'`
    )
    .all(now.toISOString()) as ReminderRow[]

  return rows
    .map((row) => {
      const task = getTask(row.task_id)
      return task ? { task, reminder: mapReminder(row) } : null
    })
    .filter((entry): entry is { task: TaskWithMeta; reminder: Reminder } => entry !== null)
}

export function setNextTrigger(taskId: number, next: string | null, triggeredAt: string): void {
  getDatabase()
    .prepare('UPDATE reminders SET next_trigger_at = ?, last_triggered_at = ? WHERE task_id = ?')
    .run(next, triggeredAt, taskId)
}

export function countPending(): number {
  return (
    getDatabase()
      .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status != 'concluida'`)
      .get() as { n: number }
  ).n
}
