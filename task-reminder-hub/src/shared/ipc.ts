import type {
  AlertPayload,
  AppEvent,
  AppSettings,
  Attachment,
  AttachmentInput,
  BriefingState,
  Category,
  CategoryInput,
  HistoryEntry,
  NewsSource,
  ProductivityStats,
  TaskInput,
  TaskQuery,
  TaskWithMeta
} from './types'

/** Nomes dos canais — unica fonte de verdade para main e preload. */
export const CH = {
  tasksList: 'tasks:list',
  tasksGet: 'tasks:get',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksDelete: 'tasks:delete',
  tasksComplete: 'tasks:complete',
  tasksReopen: 'tasks:reopen',
  tasksSnooze: 'tasks:snooze',
  tasksReschedule: 'tasks:reschedule',
  tasksUpcoming: 'tasks:upcoming',
  tasksQuickCapture: 'tasks:quick-capture',
  tasksHistory: 'tasks:history',
  tasksStats: 'tasks:stats',

  attachmentsList: 'attachments:list',
  attachmentsAdd: 'attachments:add',
  attachmentsPick: 'attachments:pick',
  attachmentsRemove: 'attachments:remove',
  attachmentsOpen: 'attachments:open',
  attachmentsData: 'attachments:data',

  alertAction: 'alert:action',
  alertResize: 'alert:resize',

  settingsPickSound: 'settings:pick-sound',
  settingsTestAlert: 'settings:test-alert',

  categoriesList: 'categories:list',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesDelete: 'categories:delete',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  newsSources: 'news:sources',
  newsAddSource: 'news:add-source',
  newsUpdateSource: 'news:update-source',
  newsRemoveSource: 'news:remove-source',
  newsState: 'news:state',
  newsLoad: 'news:load',
  newsPlay: 'news:play',
  newsPause: 'news:pause',
  newsResume: 'news:resume',
  newsNext: 'news:next',
  newsPrevious: 'news:previous',
  newsSetRate: 'news:set-rate',
  newsStop: 'news:stop',

  windowOpenDashboard: 'window:open-dashboard',
  windowTogglePostit: 'window:toggle-postit',
  windowHideCapture: 'window:hide-capture',
  windowResizePostit: 'window:resize-postit',
  windowOpenExternal: 'window:open-external',

  appEvent: 'app:event'
} as const

/** Superficie exposta em window.api pelo preload. */
export interface Api {
  tasks: {
    list(query?: TaskQuery): Promise<TaskWithMeta[]>
    get(id: number): Promise<TaskWithMeta | null>
    create(input: TaskInput): Promise<TaskWithMeta>
    update(id: number, patch: Partial<TaskInput>): Promise<TaskWithMeta | null>
    remove(id: number): Promise<void>
    complete(id: number): Promise<TaskWithMeta | null>
    reopen(id: number): Promise<TaskWithMeta | null>
    snooze(id: number, minutes?: number): Promise<TaskWithMeta | null>
    reschedule(id: number, dueAt: string): Promise<TaskWithMeta | null>
    upcoming(limit?: number): Promise<TaskWithMeta[]>
    quickCapture(text: string): Promise<{ task: TaskWithMeta; warnings: string[] }>
    history(taskId: number): Promise<HistoryEntry[]>
    stats(): Promise<ProductivityStats>
  }
  attachments: {
    list(taskId: number): Promise<Attachment[]>
    add(taskId: number, files: AttachmentInput[]): Promise<Attachment[]>
    /** Abre o seletor de arquivos do sistema. */
    pick(taskId: number): Promise<Attachment[]>
    remove(id: number): Promise<void>
    open(id: number): Promise<void>
    /** Data URL para exibir imagem ou tocar áudio no renderer. */
    data(id: number): Promise<string | null>
  }
  alert: {
    action(taskId: number, action: 'concluir' | 'adiar' | 'abrir' | 'fechar'): Promise<void>
    resize(height: number): Promise<void>
  }
  categories: {
    list(): Promise<Category[]>
    create(input: CategoryInput): Promise<Category>
    update(id: number, patch: Partial<CategoryInput>): Promise<Category | null>
    remove(id: number): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    /** Escolhe um som próprio e já o adota nas configurações. */
    pickSound(): Promise<AppSettings>
    /** Dispara um alerta de exemplo com as configurações atuais. */
    testAlert(): Promise<AlertPayload>
  }
  news: {
    sources(): Promise<NewsSource[]>
    addSource(input: { name: string; feed_url: string; category_id?: number | null }): Promise<NewsSource>
    updateSource(id: number, patch: Partial<NewsSource>): Promise<void>
    removeSource(id: number): Promise<void>
    state(): Promise<BriefingState>
    load(): Promise<BriefingState>
    play(): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    next(): Promise<void>
    previous(): Promise<void>
    setRate(rate: number): Promise<void>
    stop(): Promise<void>
  }
  window: {
    openDashboard(): Promise<void>
    togglePostit(): Promise<void>
    hideCapture(): Promise<void>
    resizePostit(size: { width: number; height: number }): Promise<void>
    openExternal(url: string): Promise<void>
  }
  onEvent(listener: (event: AppEvent) => void): () => void
}
