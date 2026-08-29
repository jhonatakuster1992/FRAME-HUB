import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { CH } from '@shared/ipc'
import type {
  AppSettings,
  AttachmentInput,
  CategoryInput,
  TaskInput,
  TaskQuery
} from '@shared/types'
import { parseQuickCapture } from '@shared/quick-parse'
import * as tasks from '../db/repositories/tasks'
import * as categories from '../db/repositories/categories'
import * as history from '../db/repositories/history'
import * as news from '../db/repositories/news'
import * as attachmentsRepo from '../db/repositories/attachments'
import * as attachments from '../attachments'
import * as alerts from '../alerts'
import * as push from '../push'
import { getSettings, updateSettings } from '../db/repositories/settings'
import type { AlertPayload } from '@shared/types'
import type { Briefing } from '../news/briefing'
import * as windows from '../windows'

export interface IpcDeps {
  briefing: Briefing
  onSettingsChanged: (settings: AppSettings) => void
  onTasksChanged: () => void
  /** Monta um alerta de exemplo com as configurações atuais. */
  buildTestAlert: () => AlertPayload
}

const OPCOES_ANEXO: Electron.OpenDialogOptions = {
  title: 'Anexar à tarefa',
  properties: ['openFile', 'multiSelections'],
  filters: [
    { name: 'Imagens e áudio', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'ogg', 'opus', 'm4a', 'wav', 'webm'] },
    { name: 'Todos os arquivos', extensions: ['*'] }
  ]
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
    // O CASCADE apaga as linhas dos anexos, mas não os arquivos em disco.
    attachments.removeForTask(id)
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

  /* ------------------------------- anexos ------------------------------ */
  ipcMain.handle(CH.attachmentsList, (_e, taskId: number) => attachmentsRepo.listForTask(taskId))

  ipcMain.handle(CH.attachmentsAdd, (_e, taskId: number, files: AttachmentInput[]) => {
    const salvos = files.map((file) =>
      attachments.saveBytes(taskId, {
        original_name: file.original_name,
        mime: file.mime,
        bytes: Buffer.from(file.data, 'base64')
      })
    )
    tasksChanged(deps)
    return salvos
  })

  ipcMain.handle(CH.attachmentsPick, async (event, taskId: number) => {
    const janela = BrowserWindow.fromWebContents(event.sender)
    const escolha = await (janela
      ? dialog.showOpenDialog(janela, OPCOES_ANEXO)
      : dialog.showOpenDialog(OPCOES_ANEXO))
    if (escolha.canceled) return []

    const salvos = escolha.filePaths.map((caminho) => attachments.saveFromPath(taskId, caminho))
    tasksChanged(deps)
    return salvos
  })

  ipcMain.handle(CH.attachmentsRemove, (_e, id: number) => {
    attachments.removeAttachment(id)
    tasksChanged(deps)
  })

  ipcMain.handle(CH.attachmentsOpen, async (_e, id: number) => {
    const anexo = attachmentsRepo.get(id)
    if (anexo) await shell.openPath(attachments.filePath(anexo.file_name))
  })

  ipcMain.handle(CH.attachmentsData, (_e, id: number) => attachments.dataUrl(id))

  /* ------------------------------- alerta ------------------------------ */
  ipcMain.handle(
    CH.alertAction,
    (_e, taskId: number, action: 'concluir' | 'adiar' | 'abrir' | 'fechar') => {
      if (action === 'concluir') tasks.completeTask(taskId)
      if (action === 'adiar') tasks.snoozeTask(taskId, getSettings().snoozeMinutes)
      if (action === 'abrir') {
        windows.showDashboard()
        windows.broadcast({ type: 'focus-task', taskId })
      }
      // taskId <= 0 é o renderer avisando que a fila esvaziou. Sem isso a
      // janela ficaria vazia e transparente por cima de tudo, comendo cliques.
      if (taskId <= 0) {
        windows.hideAlert()
        return
      }

      if (action !== 'fechar') tasksChanged(deps)
      windows.broadcast({ type: 'alert-dismiss', taskId })
    }
  )

  ipcMain.handle(CH.alertResize, (_e, height: number) => windows.resizeAlert(height))

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
    if (patch.alerts) alerts.invalidateSoundCache()
    deps.onSettingsChanged(settings)
    windows.broadcast({ type: 'data-changed', scope: 'settings' })
    return settings
  })

  ipcMain.handle(CH.settingsPickSound, async (event) => {
    const janela = BrowserWindow.fromWebContents(event.sender)
    const opcoes: Electron.OpenDialogOptions = {
      title: 'Escolher som do alerta',
      properties: ['openFile'],
      filters: [{ name: 'Áudio', extensions: ['wav', 'mp3', 'ogg', 'opus', 'm4a', 'webm'] }]
    }
    const escolha = await (janela
      ? dialog.showOpenDialog(janela, opcoes)
      : dialog.showOpenDialog(opcoes))
    if (escolha.canceled || escolha.filePaths.length === 0) return getSettings()

    alerts.adoptCustomSound(escolha.filePaths[0])
    const settings = getSettings()
    deps.onSettingsChanged(settings)
    windows.broadcast({ type: 'data-changed', scope: 'settings' })
    return settings
  })

  ipcMain.handle(CH.pushTest, () => push.enviarTeste(getSettings().push))
  ipcMain.handle(CH.pushStatus, () => push.ultimoEnvio())
  ipcMain.handle(CH.pushNewTopic, () => {
    const settings = updateSettings({ push: { ...getSettings().push, topic: push.novoTopico() } })
    windows.broadcast({ type: 'data-changed', scope: 'settings' })
    return settings
  })

  ipcMain.handle(CH.settingsTestAlert, () => {
    const payload = deps.buildTestAlert()
    windows.broadcast({ type: 'alert', alert: payload })
    if (payload.showPopup) windows.showAlert()
    return payload
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
