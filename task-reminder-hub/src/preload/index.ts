import { contextBridge, ipcRenderer } from 'electron'
import { CH, type Api } from '@shared/ipc'
import type { AppEvent } from '@shared/types'

const invoke = ipcRenderer.invoke.bind(ipcRenderer)

const api: Api = {
  tasks: {
    list: (query) => invoke(CH.tasksList, query ?? {}),
    get: (id) => invoke(CH.tasksGet, id),
    create: (input) => invoke(CH.tasksCreate, input),
    update: (id, patch) => invoke(CH.tasksUpdate, id, patch),
    remove: (id) => invoke(CH.tasksDelete, id),
    complete: (id) => invoke(CH.tasksComplete, id),
    reopen: (id) => invoke(CH.tasksReopen, id),
    snooze: (id, minutes) => invoke(CH.tasksSnooze, id, minutes),
    reschedule: (id, dueAt) => invoke(CH.tasksReschedule, id, dueAt),
    upcoming: (limit) => invoke(CH.tasksUpcoming, limit),
    quickCapture: (text) => invoke(CH.tasksQuickCapture, text),
    history: (taskId) => invoke(CH.tasksHistory, taskId),
    stats: () => invoke(CH.tasksStats)
  },
  attachments: {
    list: (taskId) => invoke(CH.attachmentsList, taskId),
    add: (taskId, files) => invoke(CH.attachmentsAdd, taskId, files),
    pick: (taskId) => invoke(CH.attachmentsPick, taskId),
    remove: (id) => invoke(CH.attachmentsRemove, id),
    open: (id) => invoke(CH.attachmentsOpen, id),
    data: (id) => invoke(CH.attachmentsData, id)
  },
  alert: {
    action: (taskId, action) => invoke(CH.alertAction, taskId, action),
    resize: (height) => invoke(CH.alertResize, height)
  },
  categories: {
    list: () => invoke(CH.categoriesList),
    create: (input) => invoke(CH.categoriesCreate, input),
    update: (id, patch) => invoke(CH.categoriesUpdate, id, patch),
    remove: (id) => invoke(CH.categoriesDelete, id)
  },
  settings: {
    get: () => invoke(CH.settingsGet),
    update: (patch) => invoke(CH.settingsUpdate, patch),
    pickSound: () => invoke(CH.settingsPickSound),
    testAlert: () => invoke(CH.settingsTestAlert)
  },
  push: {
    test: () => invoke(CH.pushTest),
    status: () => invoke(CH.pushStatus),
    newTopic: () => invoke(CH.pushNewTopic)
  },
  news: {
    sources: () => invoke(CH.newsSources),
    addSource: (input) => invoke(CH.newsAddSource, input),
    updateSource: (id, patch) => invoke(CH.newsUpdateSource, id, patch),
    removeSource: (id) => invoke(CH.newsRemoveSource, id),
    state: () => invoke(CH.newsState),
    load: () => invoke(CH.newsLoad),
    play: () => invoke(CH.newsPlay),
    pause: () => invoke(CH.newsPause),
    resume: () => invoke(CH.newsResume),
    next: () => invoke(CH.newsNext),
    previous: () => invoke(CH.newsPrevious),
    setRate: (rate) => invoke(CH.newsSetRate, rate),
    stop: () => invoke(CH.newsStop)
  },
  window: {
    openDashboard: () => invoke(CH.windowOpenDashboard),
    togglePostit: () => invoke(CH.windowTogglePostit),
    hideCapture: () => invoke(CH.windowHideCapture),
    resizePostit: (size) => invoke(CH.windowResizePostit, size),
    openExternal: (url) => invoke(CH.windowOpenExternal, url)
  },
  onEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AppEvent): void =>
      listener(payload)
    ipcRenderer.on(CH.appEvent, handler)
    return () => ipcRenderer.removeListener(CH.appEvent, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
