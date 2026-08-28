import schedule from 'node-schedule'
import { catchUp } from '@shared/recurrence'
import type { TaskWithMeta } from '@shared/types'
import * as tasks from '../db/repositories/tasks'

/**
 * Um unico job de 30 em 30 segundos varre os lembretes vencidos, em vez de
 * criar um job por lembrete. Sobrevive a suspensao do PC, a mudanca de
 * horario e a milhares de lembretes sem estourar timers.
 */
export interface SchedulerDeps {
  onFire: (task: TaskWithMeta) => void
}

const TICK_RULE = '*/30 * * * * *'
let job: schedule.Job | null = null

export function startScheduler(deps: SchedulerDeps): void {
  stopScheduler()
  job = schedule.scheduleJob(TICK_RULE, () => tick(deps))
  tick(deps) // varredura imediata no boot (lembretes vencidos enquanto o app estava fechado)
}

export function stopScheduler(): void {
  job?.cancel()
  job = null
}

/** Chamado tambem no resume do powerMonitor. */
export function tick(deps: SchedulerDeps, now: Date = new Date()): void {
  let due: ReturnType<typeof tasks.dueReminders>
  try {
    due = tasks.dueReminders(now)
  } catch (error) {
    console.error('[scheduler] falha ao ler lembretes vencidos:', error)
    return
  }

  for (const { task, reminder } of due) {
    try {
      deps.onFire(task)
    } catch (error) {
      console.error(`[scheduler] falha ao disparar lembrete da tarefa ${task.id}:`, error)
    }

    // Recalcula o proximo disparo a partir de agora; catchUp evita
    // avalanche de notificacoes atrasadas depois de horas offline.
    const base = reminder.next_trigger_at ? new Date(reminder.next_trigger_at) : now
    const next =
      reminder.recurrence_type === 'once'
        ? null
        : catchUp({ type: reminder.recurrence_type, value: reminder.recurrence_value }, base, now)

    tasks.setNextTrigger(task.id, next ? next.toISOString() : null, now.toISOString())
  }
}
