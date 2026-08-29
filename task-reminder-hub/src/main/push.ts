import { randomBytes } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import type { PushSettings, PushStatus, TaskWithMeta } from '@shared/types'
import { describeRecurrence } from '@shared/recurrence'
import * as attachmentsRepo from './db/repositories/attachments'
import { filePath } from './attachments'

/** Teto do ntfy.sh para anexo. Acima disso, manda só o texto. */
export const MAX_ANEXO_PUSH = 15 * 1024 * 1024

const TIMEOUT_MS = 8_000

/** Regra do ntfy para nome de tópico. */
export const TOPICO_VALIDO = /^[A-Za-z0-9_-]{1,64}$/

export function novoTopico(): string {
  return `tasker-${randomBytes(9).toString('base64url')}`
}

export class PushError extends Error {}

export interface Mensagem {
  title: string
  message: string
  priority: number
  tags: string[]
}

/** Texto da notificação — puro, para poder testar sem rede. */
export function montarMensagem(task: TaskWithMeta): Mensagem {
  const partes: string[] = []
  if (task.description) partes.push(task.description)
  if (task.category) partes.push(`Agenda: ${task.category.name}`)
  if (task.reminder && task.reminder.recurrence_type !== 'once') {
    partes.push(
      describeRecurrence({
        type: task.reminder.recurrence_type,
        value: task.reminder.recurrence_value
      })
    )
  }
  if (task.priority === 'alta') partes.push('Prioridade alta')

  return {
    title: task.title,
    // Prioridade 4 (alta) faz o celular vibrar e acordar a tela — sem isso o
    // aviso pode chegar mudo no relógio.
    priority: 4,
    tags: ['bell'],
    message: partes.join(' · ') || 'Lembrete'
  }
}

/** Valida e normaliza o destino; erra cedo em vez de falhar no disparo. */
export function montarDestino(settings: PushSettings): { base: string; topic: string } {
  const base = settings.server.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) throw new PushError('O servidor precisa começar com http:// ou https://')

  const topic = settings.topic.trim()
  if (!TOPICO_VALIDO.test(topic)) {
    throw new PushError('Tópico inválido: use letras, números, hífen ou sublinhado (até 64)')
  }
  return { base, topic }
}

/** URL do envio com anexo: título e texto vão em query param (UTF-8 seguro). */
export function urlComAnexo(
  destino: { base: string; topic: string },
  mensagem: Mensagem,
  fileName: string
): string {
  const params = new URLSearchParams({
    title: mensagem.title,
    message: mensagem.message,
    priority: String(mensagem.priority),
    tags: mensagem.tags.join(','),
    filename: fileName
  })
  return `${destino.base}/${destino.topic}?${params.toString()}`
}

function cabecalhos(settings: PushSettings, extras: Record<string, string> = {}): Record<string, string> {
  return settings.token ? { ...extras, Authorization: `Bearer ${settings.token}` } : extras
}

/** Primeiro print da tarefa, se couber no limite do servidor. */
function imagemDaTarefa(taskId: number): { nome: string; bytes: Buffer } | null {
  const imagem = attachmentsRepo.listForTask(taskId).find((anexo) => anexo.kind === 'imagem')
  if (!imagem) return null
  try {
    const caminho = filePath(imagem.file_name)
    if (statSync(caminho).size > MAX_ANEXO_PUSH) return null
    return { nome: imagem.original_name, bytes: readFileSync(caminho) }
  } catch {
    return null
  }
}

let ultimo: PushStatus | null = null

export function ultimoEnvio(): PushStatus | null {
  return ultimo
}

async function despachar(settings: PushSettings, task: TaskWithMeta | null): Promise<void> {
  const destino = montarDestino(settings)
  const mensagem = task
    ? montarMensagem(task)
    : {
        title: 'Teste do Tasker',
        message: 'Se este aviso chegou, o celular e o relógio estão no ar.',
        priority: 4,
        tags: ['bell']
      }

  const imagem = task && settings.includeImage ? imagemDaTarefa(task.id) : null

  const resposta = imagem
    ? await fetch(urlComAnexo(destino, mensagem, imagem.nome), {
        method: 'PUT',
        headers: cabecalhos(settings),
        body: new Uint8Array(imagem.bytes),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    : // Sem anexo, o corpo vai em JSON: acento não passa em cabeçalho HTTP.
      await fetch(destino.base, {
        method: 'POST',
        headers: cabecalhos(settings, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ topic: destino.topic, ...mensagem }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })

  if (!resposta.ok) {
    throw new PushError(`Servidor respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 140)}`)
  }
}

async function registrar(promessa: Promise<void>): Promise<PushStatus> {
  try {
    await promessa
    ultimo = { ok: true, at: new Date().toISOString() }
  } catch (erro) {
    ultimo = { ok: false, at: new Date().toISOString(), error: (erro as Error).message }
    console.error('[push] falhou:', erro)
  }
  return ultimo
}

/**
 * Envia o lembrete. Nunca lança: falha de rede não pode derrubar o disparo
 * local — o aviso na tela e o som já aconteceram.
 */
export function enviarLembrete(settings: PushSettings, task: TaskWithMeta): Promise<PushStatus> {
  return registrar(despachar(settings, task))
}

export function enviarTeste(settings: PushSettings): Promise<PushStatus> {
  return registrar(despachar(settings, null))
}
