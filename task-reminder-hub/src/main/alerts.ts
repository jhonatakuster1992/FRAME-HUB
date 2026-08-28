import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { AlertPayload, TaskWithMeta } from '@shared/types'
import { describeRecurrence } from '@shared/recurrence'
import { getSettings, updateSettings } from './db/repositories/settings'
import * as attachmentsRepo from './db/repositories/attachments'

/** Sons que vão junto com o app. */
export const SONS_INTERNOS = ['sino.wav', 'toque.wav', 'gota.wav'] as const

const MAX_SOM_BYTES = 5 * 1024 * 1024

function soundsDir(): string {
  return join(__dirname, '../../resources/sounds')
}

function customDir(): string {
  const dir = join(app.getPath('userData'), 'sons')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function mimeDoSom(caminho: string): string {
  switch (extname(caminho).toLowerCase()) {
    case '.mp3':
      return 'audio/mpeg'
    case '.ogg':
    case '.opus':
      return 'audio/ogg'
    case '.m4a':
      return 'audio/mp4'
    case '.webm':
      return 'audio/webm'
    default:
      return 'audio/wav'
  }
}

/** Cache: o mesmo som toca a cada disparo, não faz sentido reler do disco. */
let cache: { chave: string; dataUrl: string } | null = null

/** Som atual como data URL — o renderer não pode ler file:// por causa do CSP. */
export function soundDataUrl(): string | null {
  const { alerts } = getSettings()
  if (!alerts.soundEnabled) return null

  const caminho =
    alerts.sound === 'proprio' && alerts.customSound
      ? join(customDir(), alerts.customSound)
      : join(soundsDir(), SONS_INTERNOS.includes(alerts.sound as never) ? alerts.sound : 'sino.wav')

  if (cache?.chave === caminho) return cache.dataUrl
  if (!existsSync(caminho)) {
    console.error('[alerta] som nao encontrado:', caminho)
    return null
  }

  try {
    const dataUrl = `data:${mimeDoSom(caminho)};base64,${readFileSync(caminho).toString('base64')}`
    cache = { chave: caminho, dataUrl }
    return dataUrl
  } catch (error) {
    console.error('[alerta] falha ao ler o som:', error)
    return null
  }
}

export function invalidateSoundCache(): void {
  cache = null
}

/** Copia o som escolhido para o userData: o arquivo de origem pode sumir. */
export function adoptCustomSound(sourcePath: string): string {
  if (statSync(sourcePath).size > MAX_SOM_BYTES) {
    throw new Error(`O som precisa ter até ${MAX_SOM_BYTES / 1024 / 1024} MB`)
  }
  const nome = `${Date.now()}-${basename(sourcePath).replace(/[^\w.-]+/g, '_')}`
  copyFileSync(sourcePath, join(customDir(), nome))
  invalidateSoundCache()
  updateSettings({ alerts: { ...getSettings().alerts, sound: 'proprio', customSound: nome } })
  return nome
}

/** Alerta de exemplo do botão "Testar" nos Ajustes. */
export function buildTestPayload(): AlertPayload {
  const { alerts } = getSettings()
  return {
    taskId: -1,
    title: 'Exemplo de lembrete',
    description: 'É assim que o aviso aparece quando um lembrete dispara.',
    categoryName: 'Teste',
    categoryColor: '#4A21C7',
    dueAt: new Date().toISOString(),
    recurrence: null,
    attachments: 0,
    sound: soundDataUrl(),
    volume: alerts.volume,
    popupSeconds: alerts.popupSeconds,
    showPopup: alerts.popupEnabled
  }
}

export function buildPayload(task: TaskWithMeta): AlertPayload {
  const { alerts } = getSettings()
  return {
    taskId: task.id,
    title: task.title,
    description: task.description,
    categoryName: task.category?.name ?? null,
    categoryColor: task.category?.color ?? null,
    dueAt: task.due_at,
    recurrence:
      task.reminder && task.reminder.recurrence_type !== 'once'
        ? describeRecurrence({
            type: task.reminder.recurrence_type,
            value: task.reminder.recurrence_value
          })
        : null,
    attachments: attachmentsRepo.listForTask(task.id).length,
    sound: soundDataUrl(),
    volume: alerts.volume,
    popupSeconds: alerts.popupSeconds,
    showPopup: alerts.popupEnabled
  }
}
