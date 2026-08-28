import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import type { AppEvent } from '@shared/types'
import { CH } from '@shared/ipc'
import { loadBounds, saveBounds } from '../window-state'

const PRELOAD = join(__dirname, '../preload/index.js')
const RENDERER_DIR = join(__dirname, '../renderer')

let dashboard: BrowserWindow | null = null
let postit: BrowserWindow | null = null
let capture: BrowserWindow | null = null

/** Em dev o renderer vem do servidor do electron-vite; em prod, do disco. */
function loadPage(window: BrowserWindow, page: 'dashboard' | 'postit' | 'capture'): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer) void window.loadURL(`${devServer}/${page}.html`)
  else void window.loadFile(join(RENDERER_DIR, `${page}.html`))
}

function openLinksExternally(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

/* ------------------------------ dashboard ------------------------------ */

export function createDashboard(show = true): BrowserWindow {
  if (dashboard && !dashboard.isDestroyed()) {
    if (show) showDashboard()
    return dashboard
  }

  const bounds = loadBounds('dashboard', { width: 1280, height: 820 })
  dashboard = new BrowserWindow({
    ...bounds,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: '#F3F4FB',
    title: 'Task & Reminder Hub',
    autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, sandbox: false }
  })

  openLinksExternally(dashboard)
  dashboard.on('close', () => {
    if (dashboard) saveBounds('dashboard', dashboard.getBounds())
  })
  dashboard.on('closed', () => {
    dashboard = null
  })
  if (show) dashboard.once('ready-to-show', () => dashboard?.show())

  loadPage(dashboard, 'dashboard')
  return dashboard
}

export function showDashboard(): void {
  const window = dashboard && !dashboard.isDestroyed() ? dashboard : createDashboard(false)
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

export function getDashboard(): BrowserWindow | null {
  return dashboard && !dashboard.isDestroyed() ? dashboard : null
}

/* -------------------------------- post-it ------------------------------- */

export function createPostit(): BrowserWindow {
  if (postit && !postit.isDestroyed()) return postit

  const work = screen.getPrimaryDisplay().workAreaSize
  const bounds = loadBounds('postit', {
    width: 320,
    height: 420,
    x: work.width - 360,
    y: 80
  })

  postit = new BrowserWindow({
    ...bounds,
    minWidth: 260,
    minHeight: 220,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    // Janela comum: clicar em outro app manda o post-it para tras.
    // So fica na frente de tudo se o usuario ligar isso nos Ajustes.
    alwaysOnTop: false,
    show: false,
    hasShadow: false,
    webPreferences: { preload: PRELOAD, sandbox: false }
  })

  openLinksExternally(postit)
  const persist = (): void => {
    if (postit && !postit.isDestroyed()) saveBounds('postit', postit.getBounds())
  }
  postit.on('moved', persist)
  postit.on('resized', persist)
  postit.on('closed', () => {
    postit = null
  })
  postit.once('ready-to-show', () => postit?.showInactive())

  loadPage(postit, 'postit')
  return postit
}

export function getPostit(): BrowserWindow | null {
  return postit && !postit.isDestroyed() ? postit : null
}

export function setPostitVisible(visible: boolean): void {
  if (visible) {
    const window = getPostit() ?? createPostit()
    window.showInactive()
  } else {
    getPostit()?.hide()
  }
}

export function isPostitVisible(): boolean {
  return getPostit()?.isVisible() ?? false
}

export function setPostitAlwaysOnTop(onTop: boolean): void {
  getPostit()?.setAlwaysOnTop(onTop, 'floating')
}

/** Sem barra de tarefas, e por aqui que o post-it soterrado volta a aparecer. */
export function showPostit(): void {
  const window = getPostit() ?? createPostit()
  window.show()
  window.focus()
}

export function resizePostit(size: { width: number; height: number }): void {
  const window = getPostit()
  if (!window) return
  const [width] = window.getSize()
  window.setSize(width, Math.round(size.height))
}

/* --------------------------- captura rapida ----------------------------- */

export function createCapture(): BrowserWindow {
  if (capture && !capture.isDestroyed()) return capture

  capture = new BrowserWindow({
    width: 640,
    height: 190,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: { preload: PRELOAD, sandbox: false }
  })

  capture.setAlwaysOnTop(true, 'screen-saver')
  capture.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  openLinksExternally(capture)
  capture.on('blur', () => capture?.hide())
  capture.on('closed', () => {
    capture = null
  })

  loadPage(capture, 'capture')
  return capture
}

/** Centraliza no monitor onde o cursor esta — respeita setup multi-tela. */
export function toggleCapture(): void {
  const window = getCapture() ?? createCapture()
  if (window.isVisible()) {
    window.hide()
    return
  }
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const [width, height] = window.getSize()
  window.setPosition(
    Math.round(display.workArea.x + (display.workArea.width - width) / 2),
    Math.round(display.workArea.y + display.workArea.height * 0.28 - height / 2)
  )
  window.show()
  window.focus()
}

export function getCapture(): BrowserWindow | null {
  return capture && !capture.isDestroyed() ? capture : null
}

export function hideCapture(): void {
  getCapture()?.hide()
}

/* ------------------------------ broadcast ------------------------------- */

export function broadcast(event: AppEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(CH.appEvent, event)
  }
}

export function closeAll(): void {
  for (const window of [dashboard, postit, capture]) {
    if (window && !window.isDestroyed()) window.destroy()
  }
  dashboard = postit = capture = null
}
