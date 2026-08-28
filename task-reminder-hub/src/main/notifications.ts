import { Notification, nativeImage } from 'electron'
import { join } from 'node:path'
import type { TaskWithMeta } from '@shared/types'

export const PROTOCOL = 'framehub'

/**
 * Acoes rapidas no toast.
 *
 * No Windows, botoes de toast so existem via XML nativo. Usamos
 * activationType="protocol", que faz o Windows abrir framehub://... — a
 * instancia unica do app recebe essa URL no argv e executa a acao
 * (ver handleProtocolUrl em src/main/index.ts). Exige AppUserModelID
 * definido e atalho no menu iniciar (o instalador NSIS cria).
 *
 * Fora do Windows caimos no Notification comum: clique = abrir a tarefa.
 */
function buildToastXml(task: TaskWithMeta, snoozeMinutes: number): string {
  const escape = (value: string): string =>
    value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)

  const body = task.description
    ? escape(task.description.slice(0, 140))
    : task.category
      ? escape(task.category.name)
      : 'Task & Reminder Hub'

  return `
    <toast activationType="protocol" launch="${PROTOCOL}://task/${task.id}/open">
      <visual>
        <binding template="ToastGeneric">
          <text>${escape(task.title)}</text>
          <text>${body}</text>
        </binding>
      </visual>
      <actions>
        <action content="Concluir" activationType="protocol"
                arguments="${PROTOCOL}://task/${task.id}/complete" />
        <action content="Adiar ${snoozeMinutes} min" activationType="protocol"
                arguments="${PROTOCOL}://task/${task.id}/snooze" />
        <action content="Abrir" activationType="protocol"
                arguments="${PROTOCOL}://task/${task.id}/open" />
      </actions>
    </toast>`
}

export interface NotifyOptions {
  snoozeMinutes: number
  iconPath?: string
  onClick?: (taskId: number) => void
}

export function notifyReminder(task: TaskWithMeta, options: NotifyOptions): void {
  if (!Notification.isSupported()) return

  const icon = options.iconPath ? nativeImage.createFromPath(options.iconPath) : undefined
  const notification =
    process.platform === 'win32'
      ? new Notification({ toastXml: buildToastXml(task, options.snoozeMinutes) })
      : new Notification({
          title: task.title,
          body: task.description ?? task.category?.name ?? 'Lembrete',
          icon,
          silent: false
        })

  notification.on('click', () => options.onClick?.(task.id))
  notification.show()
}

export function notifySimple(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

export function defaultIconPath(): string {
  return join(__dirname, '../../resources/icon.png')
}
