import { ipcMain, shell } from 'electron'
import { CH } from '@shared/ipc'
import type { AppSettings, CategoryInput, TaskInput, TaskQuery } from '@shared/types'
import { parseQuickCapture } from '@shared/quick-parse'
import * as tasks from '../db/repositories/tasks'
import * as categories from '../db/repositories/categories'
import * as history from '../db/repositories/history'
import * as news from '../db/repositories/news'
import { getSettings, updateSettings } from '../db/repositories/settings'
import type { Briefing } from '../news/briefing'
import * as windows from '../windows'

export interface IpcDeps {
  briefing: Briefing
  onSettingsChanged: (settings: AppSettings) => void
  onTasksChanged: () => void
}

/** Notifica todas as janelas + tray depois de mexer em tarefa. */
function tasksChanged(deps: IpcDeps): void {
  deps.onTasksChanged()
  windows.broadcast({ type: 'data-changed', scope: 'tasks' })
}

export function registerIpc(deps: IpcDeps): void {
  /* ------------------------------ tarefas ------------------------------ */
  ipcMain.handle(CH.tasksList, (_e, query: TaskQuery) => tasks.listTasks(query ?? {}))
  ipcMain.handle(CH.tasksGet, (_e, id: number) => tasks.getTask(id))
  ipcMain.handle(CH.tasksUpcoming, (_e, limit?: number) => tasks.upcoming(limit ?? 8))
  ipcMain.handle(CH.tasksHistory, (_e, taskId: number) => history.listForTask(taskId))
  ipcMain.handle(CH.tasksStats, () => history.stats())

  ipcMain.handle(CH.tasksCreate, (_e, input: TaskInput) => {
    const task = tasks.createTask(input)
    tasksChanged(deps)
    return task
  })

  ipcMain.handle(CH.tasksUpdate, (_e, id: number, patch: Partial<TaskInput>) => {
    const task = tasks.updateTask(id, patch)
    tasksChanged(deps)
    return task
  })

  ipcMain.handle(CH.tasksDelete, (_e, id: number) => {
    tasks.deleteTask(id)
    tasksChanged(deps)
  })

  ipcMain.handle(CH.tasksComplete, (_e, id: number) => {
    const task = tasks.completeTask(id)
    tasksChanged(deps)
    return task
  })

  ipcMain.handle(CH.tasksReopen, (_e, id: number) => {
    const task = tasks.reopenTask(id)
    tasksChanged(deps)
    return task
  })

  ipcMain.handle(CH.tasksSnooze, (_e, id: number, minutes?: number) => {
    const task = tasks.snoozeTask(id, minutes ?? getSettings().snoozeMinutes)
    tasksChanged(deps)
    return task
  })

  ipcMain.handle(CH.tasksReschedule, (_e, id: number, dueAt: string) => {
    const task = tasks.rescheduleTask(id, dueAt)
    tasksChanged(deps)
    return task
  })

  ipcMain.handle(CH.tasksQuickCapture, (_e, text: string) => {
    const parsed = parseQuickCapture(text)
    if (!parsed.title) throw new Error('Escreva ao menos um titulo')

    const category = parsed.categoryName
      ? categories.findOrCreateByName(parsed.categoryName)
      : null
    const dueAt = parsed.dueAt ? parsed.dueAt.toISOString() : null

    const task = tasks.createTask({
      title: parsed.title,
      category_id: category?.id ?? null,
      priority: parsed.priority ?? 'media',
      due_at: dueAt,
      reminder: parsed.recurrence
        ? { recurrence_type: parsed.recurrence.type, recurrence_value: parsed.recurrence.value }
        : dueAt
          ? { recurrence_type: 'once', next_trigger_at: dueAt }
          : null
    })

    tasksChanged(deps)
    if (parsed.categoryName) windows.broadcast({ type: 'data-changed', scope: 'categories' })
    return { task, warnings: parsed.warnings }
  })

  /* ----------------------------- categorias ---------------------------- */
  ipcMain.handle(CH.categoriesList, () => categories.listCategories())
  ipcMain.handle(CH.categoriesCreate, (_e, input: CategoryInput) => {
    const category = categories.createCategory(input)
    windows.broadcast({ type: 'data-changed', scope: 'categories' })
    return category
  })
  ipcMain.handle(CH.categoriesUpdate, (_e, id: number, patch: Partial<CategoryInput>) => {
    const category = categories.updateCategory(id, patch)
    windows.broadcast({ type: 'data-changed', scope: 'categories' })
    return category
  })
  ipcMain.handle(CH.categoriesDelete, (_e, id: number) => {
    categories.deleteCategory(id)
    windows.broadcast({ type: 'data-changed', scope: 'categories' })
    tasksChanged(deps)
  })

  /* ---------------------------- configuracoes -------------------------- */
  ipcMain.handle(CH.settingsGet, () => getSettings())
  ipcMain.handle(CH.settingsUpdate, (_e, patch: Partial<AppSettings>) => {
    const settings = updateSettings(patch)
    deps.onSettingsChanged(settings)
    windows.broadcast({ type: 'data-changed', scope: 'settings' })
    return settings
  })

  /* ------------------------------ noticias ----------------------------- */
  ipcMain.handle(CH.newsSources, () => news.listSources())
  ipcMain.handle(CH.newsAddSource, (_e, input: { name: string; feed_url: string; category_id?: number | null }) => {
    const source = news.addSource(input)
    windows.broadcast({ type: 'data-changed', scope: 'news' })
    return source
  })
  ipcMain.handle(CH.newsUpdateSource, (_e, id: number, patch) => {
    news.updateSource(id, patch)
    windows.broadcast({ type: 'data-changed', scope: 'news' })
  })
  ipcMain.handle(CH.newsRemoveSource, (_e, id: number) => {
    news.removeSource(id)
    windows.broadcast({ type: 'data-changed', scope: 'news' })
  })
  ipcMain.handle(CH.newsState, () => deps.briefing.getState())
  ipcMain.handle(CH.newsLoad, () => deps.briefing.load())
  ipcMain.handle(CH.newsPlay, () => void deps.briefing.play())
  ipcMain.handle(CH.newsPause, () => deps.briefing.pause())
  ipcMain.handle(CH.newsResume, () => deps.briefing.resume())
  ipcMain.handle(CH.newsNext, () => deps.briefing.next())
  ipcMain.handle(CH.newsPrevious, () => deps.briefing.previous())
  ipcMain.handle(CH.newsSetRate, (_e, rate: number) => {
    deps.briefing.setRate(rate)
    updateSettings({ news: { ...getSettings().news, rate } })
  })
  ipcMain.handle(CH.newsStop, () => deps.briefing.stop())

  /* ------------------------------- janelas ----------------------------- */
  ipcMain.handle(CH.windowOpenDashboard, () => windows.showDashboard())
  ipcMain.handle(CH.windowTogglePostit, () => {
    const visible = !windows.isPostitVisible()
    windows.setPostitVisible(visible)
    updateSettings({ postitVisible: visible })
  })
  ipcMain.handle(CH.windowHideCapture, () => windows.hideCapture())
  ipcMain.handle(CH.windowResizePostit, (_e, size: { width: number; height: number }) =>
    windows.resizePostit(size)
  )
  ipcMain.handle(CH.windowOpenExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })
}
