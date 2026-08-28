import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'
import * as tasks from './db/repositories/tasks'
import { getSettings, updateSettings } from './db/repositories/settings'
import * as windows from './windows'

let tray: Tray | null = null

function iconPath(): string {
  return join(__dirname, '../../resources/tray.png')
}

/** Icone minusculo embutido: evita quebrar se resources/ nao existir. */
function fallbackIcon(): Electron.NativeImage {
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAX0lEQVR42mNkYPhfz0AEYBxVSF+F' +
    'jIyM/xkYGBj+//8PxjA+TAxdHqYPmxq8CvFZgM8SbBbhCwZ8CvFZjM8F+CzGZzE+F+CzGJ/F+FyA' +
    'z2J8FuNzAT6LB58LAFLKKGnJ0ZBvAAAAAElFTkSuQmCC'
  return nativeImage.createFromDataURL(`data:image/png;base64,${png}`)
}

export function createTray(): Tray {
  if (tray && !tray.isDestroyed()) return tray

  const image = nativeImage.createFromPath(iconPath())
  tray = new Tray(image.isEmpty() ? fallbackIcon() : image)
  tray.setToolTip('Task & Reminder Hub')
  tray.on('click', () => refreshTray())
  tray.on('double-click', () => windows.showDashboard())
  refreshTray()
  return tray
}

/** Menu reconstruido a cada mudanca: mostra as pendencias mais proximas. */
export function refreshTray(): void {
  if (!tray || tray.isDestroyed()) return

  const settings = getSettings()
  const upcoming = tasks.upcoming(6)
  const pending = tasks.countPending()

  const taskItems: Electron.MenuItemConstructorOptions[] = upcoming.length
    ? upcoming.map((task) => ({
        label: `${task.category ? `[${task.category.name}] ` : ''}${task.title}`,
        submenu: [
          { label: 'Abrir', click: () => openTask(task.id) },
          { label: 'Concluir', click: () => completeFromTray(task.id) },
          {
            label: `Adiar ${settings.snoozeMinutes} min`,
            click: () => snoozeFromTray(task.id, settings.snoozeMinutes)
          }
        ]
      }))
    : [{ label: 'Nada agendado por enquanto', enabled: false }]

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `${pending} pendente(s)`, enabled: false },
      { type: 'separator' },
      { label: 'Nova tarefa (captura rapida)', click: () => windows.toggleCapture() },
      { label: 'Abrir dashboard', click: () => windows.showDashboard() },
      {
        label: 'Post-it flutuante',
        type: 'checkbox',
        checked: windows.isPostitVisible(),
        click: (item) => {
          windows.setPostitVisible(item.checked)
          updateSettings({ postitVisible: item.checked })
        }
      },
      { type: 'separator' },
      ...taskItems,
      { type: 'separator' },
      {
        label: 'Iniciar com o Windows',
        type: 'checkbox',
        checked: settings.launchAtLogin,
        click: (item) => {
          updateSettings({ launchAtLogin: item.checked })
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            args: settings.startMinimized ? ['--hidden'] : []
          })
          refreshTray()
        }
      },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() }
    ])
  )
  tray.setToolTip(`Task & Reminder Hub — ${pending} pendente(s)`)
}

/* As acoes do tray precisam refletir na UI aberta, entao passam pelo broadcast. */
function openTask(taskId: number): void {
  windows.showDashboard()
  windows.broadcast({ type: 'focus-task', taskId })
}

function completeFromTray(taskId: number): void {
  tasks.completeTask(taskId)
  windows.broadcast({ type: 'data-changed', scope: 'tasks' })
  refreshTray()
}

function snoozeFromTray(taskId: number, minutes: number): void {
  tasks.snoozeTask(taskId, minutes)
  windows.broadcast({ type: 'data-changed', scope: 'tasks' })
  refreshTray()
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
