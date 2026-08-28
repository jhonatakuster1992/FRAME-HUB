import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { Attachment, AttachmentKind } from '@shared/types'
import * as repo from './db/repositories/attachments'

/** Teto por arquivo: prints e áudios de conversa cabem folgado. */
export const MAX_BYTES = 25 * 1024 * 1024

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a'
}

/**
 * Raiz dos arquivos. Injetada no boot (userData) em vez de lida do electron
 * aqui dentro, para o ciclo de vida dos arquivos poder ser testado.
 */
let raiz: string | null = null

export function configureStorage(dir: string): void {
  raiz = dir
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function storageDir(): string {
  if (!raiz) throw new Error('Armazenamento de anexos não configurado')
  if (!existsSync(raiz)) mkdirSync(raiz, { recursive: true })
  return raiz
}

export function filePath(fileName: string): string {
  return join(storageDir(), fileName)
}

export function kindFromMime(mime: string, fileName: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'imagem'
  if (mime.startsWith('audio/')) return 'audio'
  const ext = extname(fileName).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return 'imagem'
  if (['.mp3', '.ogg', '.wav', '.m4a', '.opus', '.webm'].includes(ext)) return 'audio'
  return 'arquivo'
}

function mimeFromExtension(fileName: string): string {
  const ext = extname(fileName).toLowerCase()
  const encontrado = Object.entries(EXTENSAO_POR_MIME).find(([, valor]) => valor === ext)
  if (encontrado) return encontrado[0]
  if (ext === '.opus') return 'audio/ogg'
  if (ext === '.jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

/** Grava os bytes com nome próprio: o nome original nunca vira caminho. */
export function saveBytes(
  taskId: number,
  input: { original_name: string; mime: string; bytes: Buffer }
): Attachment {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error(`Arquivo maior que ${Math.round(MAX_BYTES / 1024 / 1024)} MB`)
  }

  const original = basename(input.original_name || 'anexo')
  const mime = input.mime || mimeFromExtension(original)
  const ext = EXTENSAO_POR_MIME[mime] ?? extname(original) ?? ''
  const fileName = `${randomUUID()}${ext}`

  writeFileSync(filePath(fileName), input.bytes)

  return repo.insert({
    task_id: taskId,
    kind: kindFromMime(mime, original),
    file_name: fileName,
    original_name: original,
    mime,
    size_bytes: input.bytes.byteLength
  })
}

export function saveFromPath(taskId: number, sourcePath: string): Attachment {
  const stats = statSync(sourcePath)
  if (stats.size > MAX_BYTES) {
    throw new Error(`${basename(sourcePath)} é maior que ${Math.round(MAX_BYTES / 1024 / 1024)} MB`)
  }
  return saveBytes(taskId, {
    original_name: basename(sourcePath),
    mime: mimeFromExtension(sourcePath),
    bytes: readFileSync(sourcePath)
  })
}

function apagarArquivo(fileName: string): void {
  try {
    const caminho = filePath(fileName)
    if (existsSync(caminho)) unlinkSync(caminho)
  } catch (error) {
    console.error('[anexos] nao consegui apagar', fileName, error)
  }
}

export function removeAttachment(id: number): void {
  const anexo = repo.get(id)
  if (!anexo) return
  repo.remove(id)
  apagarArquivo(anexo.file_name)
}

/** Chamado antes de excluir a tarefa: o CASCADE some com a linha, não com o arquivo. */
export function removeForTask(taskId: number): void {
  for (const fileName of repo.fileNamesForTask(taskId)) apagarArquivo(fileName)
}

/** Data URL para o renderer exibir — o CSP não deixa carregar file://. */
export function dataUrl(id: number): string | null {
  const anexo = repo.get(id)
  if (!anexo) return null
  const caminho = filePath(anexo.file_name)
  if (!existsSync(caminho)) return null
  return `data:${anexo.mime};base64,${readFileSync(caminho).toString('base64')}`
}

/**
 * Arquivo sem linha no banco vira lixo permanente (queda no meio da gravação,
 * banco restaurado de backup). Varre uma vez no boot.
 */
export function pruneOrphans(): void {
  try {
    const conhecidos = repo.allFileNames()
    for (const fileName of readdirSync(storageDir())) {
      if (!conhecidos.has(fileName)) apagarArquivo(fileName)
    }
  } catch (error) {
    console.error('[anexos] varredura de órfãos falhou:', error)
  }
}
