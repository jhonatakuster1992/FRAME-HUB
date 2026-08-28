import { app, globalShortcut, powerMonitor } from 'electron'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import { createDatabase, setDatabase, closeDatabase } from './db'
import * as alerts from './alerts'
import { configureStorage, pruneOrphans } from './attachments'
import { getSettings, updateSettings } from './db/repositories/settings'
import * as tasks from './db/repositories/tasks'
import { registerIpc } from './ipc'
import { Briefing } from './news/briefing'
import { notifyReminder, defaultIconPath, PROTOCOL } from './notifications'
import { startScheduler, stopScheduler, tick, type SchedulerDeps } from './scheduler'
import { createTray, destroyTray, refreshTray } from './tray'
import * as windows from './windows'

const APP_ID = 'com.jhonatakuster.taskreminderhub'

// A UI e toda em pt-BR; fixar o locale mantem os campos nativos de data/hora
// e o Intl coerentes mesmo em um Windows configurado em outro idioma.
app.commandLine.appendSwitch('lang', 'pt-BR')

// Instancia unica: o app vive na bandeja, um segundo clique so traz a janela.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  app.setAppUserModelId(APP_ID)
  registerProtocol()

  let briefing: Briefing

  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) handleProtocolUrl(url)
    else windows.showDashboard()
  })

  // macOS: mesma acao chega por open-url
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })

  app.whenReady().then(() => {
    setDatabase(createDatabase(join(app.getPath('userData'), 'task-hub.db')))
    const settings = getSettings()

    briefing = new Briefing((state) => windows.broadcast({ type: 'briefing-state', state }))

    registerIpc({
      briefing,
      onSettingsChanged: applySettings,
      onTasksChanged: refreshTray,
      buildTestAlert: alerts.buildTestPayload
    })

    // Arquivo sem linha no banco vira lixo permanente; varre uma vez no boot.
    configureStorage(join(app.getPath('userData'), 'anexos'))
    pruneOrphans()

    createTray()
    windows.createDashboard(!shouldStartHidden(settings))
    if (settings.postitVisible) windows.createPostit()
    windows.createCapture()
    // Nasce escondida: é ela quem toca o som, mesmo com a popup desligada.
    windows.createAlert()

    applySettings(settings)

    const schedulerDeps: SchedulerDeps = {
      onFire: (task) => {
        const payload = alerts.buildPayload(task)

        // A popup própria e o toast do Windows dizem a mesma coisa; mostrar
        // os dois seria aviso em dobro. A popup ganha quando está ligada.
        windows.broadcast({ type: 'alert', alert: payload })
        if (payload.showPopup) {
          windows.showAlert()
        } else {
          notifyReminder(task, {
            snoozeMinutes: getSettings().snoozeMinutes,
            iconPath: defaultIconPath(),
            onClick: (taskId) => {
              windows.showDashboard()
              windows.broadcast({ type: 'focus-task', taskId })
            }
          })
        }

        windows.broadcast({ type: 'reminder-fired', taskId: task.id, title: task.title })
        refreshTray()
      }
    }
    startScheduler(schedulerDeps)

    // Voltando de suspensao, a varredura roda na hora em vez de esperar o tick.
    // Usa as mesmas deps: com um onFire vazio os lembretes venceriam calados.
    powerMonitor.on('resume', () => tick(schedulerDeps))

    // Briefing nunca bloqueia o boot: sai numa microtarefa propria.
    setTimeout(() => void briefing.runOnStartup(), 2_000)

    app.on('activate', () => windows.showDashboard())
  })

  // App de bandeja: fechar a janela nao encerra o processo.
  app.on('window-all-closed', () => {
    /* mantido vivo de proposito */
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    stopScheduler()
    destroyTray()
    windows.closeAll()
    closeDatabase()
  })
}

function shouldStartHidden(settings: AppSettings): boolean {
  return process.argv.includes('--hidden') || settings.startMinimized
}

function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

/** Aplica configuracoes que tocam o SO (hotkey, auto-start, post-it). */
function applySettings(settings: AppSettings): void {
  globalShortcut.unregisterAll()
  if (settings.globalHotkey) {
    const ok = globalShortcut.register(settings.globalHotkey, () => windows.toggleCapture())
    if (!ok) {
      console.error(`[hotkey] atalho "${settings.globalHotkey}" ja esta em uso`)
      // Volta ao padrao para o usuario nao ficar sem captura rapida.
      const fallback = 'CommandOrControl+Alt+Space'
      if (settings.globalHotkey !== fallback && globalShortcut.register(fallback, () => windows.toggleCapture())) {
        updateSettings({ globalHotkey: fallback })
      }
    }
  }

  app.setLoginItemSettings({
    openAtLogin: settings.launchAtLogin,
    args: settings.startMinimized ? ['--hidden'] : []
  })

  windows.setPostitVisible(settings.postitVisible)
  windows.setPostitAlwaysOnTop(settings.postitAlwaysOnTop)
  refreshTray()
}

/**
 * Botoes do toast do Windows chegam aqui como framehub://task/<id>/<acao>.
 * (Ver src/main/notifications.ts.)
 */
function handleProtocolUrl(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return
  }
  if (parsed.protocol !== `${PROTOCOL}:`) return

  const [resource, id, action] = [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)]
  if (resource !== 'task') return
  const taskId = Number(id)
  if (!Number.isInteger(taskId)) return

  switch (action) {
    case 'complete':
      tasks.completeTask(taskId)
      break
    case 'snooze':
      tasks.snoozeTask(taskId, getSettings().snoozeMinutes)
      break
    case 'open':
    default:
      windows.showDashboard()
      windows.broadcast({ type: 'focus-task', taskId })
      break
  }

  windows.broadcast({ type: 'data-changed', scope: 'tasks' })
  refreshTray()
}
