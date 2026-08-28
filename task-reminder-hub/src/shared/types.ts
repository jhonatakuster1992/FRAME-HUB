/**
 * Tipos de dominio compartilhados entre main, preload e renderer.
 * Toda a superficie de IPC e derivada daqui.
 */

export type Priority = 'baixa' | 'media' | 'alta'
export type TaskStatus = 'pendente' | 'concluida' | 'adiada'

export interface Category {
  id: number
  name: string
  color: string
  visible: boolean
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string | null
  category_id: number | null
  priority: Priority
  status: TaskStatus
  /** ISO 8601 UTC. Quando a tarefa aparece no calendario. Null = so na lista. */
  due_at: string | null
  duration_minutes: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

/** Tarefa com os campos derivados que a UI consome direto. */
export interface TaskWithMeta extends Task {
  category: Category | null
  reminder: Reminder | null
}

export type RecurrenceType =
  | 'once'
  | 'minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom_times'

export interface Reminder {
  id: number
  task_id: number
  recurrence_type: RecurrenceType
  /**
   * Semantica por tipo:
   *  once         -> null (usa next_trigger_at)
   *  minutes      -> "30"            (a cada 30 minutos)
   *  hourly       -> "2"             (a cada 2 horas)
   *  daily        -> "08:00"
   *  weekly       -> "1,3,5@08:00"   (0=domingo ... 6=sabado)
   *  monthly      -> "15@08:00"      (dia do mes; 31 cai no ultimo dia valido)
   *  custom_times -> "08:00,12:30,18:00"
   */
  recurrence_value: string | null
  next_trigger_at: string | null
  last_triggered_at: string | null
  enabled: boolean
}

export type HistoryAction = 'created' | 'completed' | 'snoozed' | 'rescheduled' | 'reopened'

export interface HistoryEntry {
  id: number
  task_id: number
  action: HistoryAction
  timestamp: string
  meta: string | null
}

export interface NewsSource {
  id: number
  category_id: number | null
  name: string
  feed_url: string
  enabled: boolean
}

export interface NewsArticle {
  title: string
  link: string
  summary: string
  source: string
  categoryId: number | null
  publishedAt: string | null
}

export interface BriefingState {
  status: 'idle' | 'loading' | 'ready' | 'speaking' | 'paused' | 'error'
  articles: NewsArticle[]
  currentIndex: number
  rate: number
  error?: string
  ttsAvailable: boolean
}

export interface AppSettings {
  launchAtLogin: boolean
  startMinimized: boolean
  globalHotkey: string
  postitVisible: boolean
  theme: 'claro' | 'escuro' | 'sistema'
  snoozeMinutes: number
  news: {
    enabled: boolean
    speakOnStartup: boolean
    rate: number
    maxArticlesPerSource: number
  }
}

/* ---------- payloads de entrada ---------- */

export interface TaskInput {
  title: string
  description?: string | null
  category_id?: number | null
  priority?: Priority
  status?: TaskStatus
  due_at?: string | null
  duration_minutes?: number
  reminder?: ReminderInput | null
}

export interface ReminderInput {
  recurrence_type: RecurrenceType
  recurrence_value?: string | null
  next_trigger_at?: string | null
  enabled?: boolean
}

export interface TaskQuery {
  search?: string
  categoryIds?: number[]
  statuses?: TaskStatus[]
  /** ISO; filtra por due_at dentro da janela (inclusivo/exclusivo) */
  from?: string
  to?: string
  includeUndated?: boolean
  limit?: number
}

export interface CategoryInput {
  name: string
  color: string
  visible?: boolean
}

export interface ProductivityStats {
  completed7d: number
  snoozed7d: number
  completedByDay: { date: string; count: number }[]
  topSnoozedTasks: { task_id: number; title: string; snoozes: number }[]
}

/** Evento que o main empurra para os renderers. */
export type AppEvent =
  | { type: 'data-changed'; scope: 'tasks' | 'categories' | 'settings' | 'news' }
  | { type: 'reminder-fired'; taskId: number; title: string }
  | { type: 'briefing-state'; state: BriefingState }
  | { type: 'focus-task'; taskId: number }
