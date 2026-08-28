import type { Attachment, AttachmentKind } from '@shared/types'
import { getDatabase } from '../index'

export function listForTask(taskId: number): Attachment[] {
  return getDatabase()
    .prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at, id')
    .all(taskId) as Attachment[]
}

export function get(id: number): Attachment | null {
  return (getDatabase().prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
    | Attachment
    | undefined) ?? null
}

export function countByTask(taskIds: number[]): Map<number, number> {
  if (taskIds.length === 0) return new Map()
  const rows = getDatabase()
    .prepare(
      `SELECT task_id, COUNT(*) AS total FROM attachments
       WHERE task_id IN (${taskIds.map(() => '?').join(',')}) GROUP BY task_id`
    )
    .all(...taskIds) as { task_id: number; total: number }[]
  return new Map(rows.map((row) => [row.task_id, row.total]))
}

export function insert(input: {
  task_id: number
  kind: AttachmentKind
  file_name: string
  original_name: string
  mime: string
  size_bytes: number
}): Attachment {
  const info = getDatabase()
    .prepare(
      `INSERT INTO attachments (task_id, kind, file_name, original_name, mime, size_bytes)
       VALUES (@task_id, @kind, @file_name, @original_name, @mime, @size_bytes)`
    )
    .run(input)
  return get(Number(info.lastInsertRowid))!
}

export function remove(id: number): void {
  getDatabase().prepare('DELETE FROM attachments WHERE id = ?').run(id)
}

/** Nomes em disco de uma tarefa — usados para apagar os arquivos junto. */
export function fileNamesForTask(taskId: number): string[] {
  return (
    getDatabase()
      .prepare('SELECT file_name FROM attachments WHERE task_id = ?')
      .all(taskId) as { file_name: string }[]
  ).map((row) => row.file_name)
}

/** Todos os nomes em disco — para varrer arquivos órfãos no boot. */
export function allFileNames(): Set<string> {
  return new Set(
    (getDatabase().prepare('SELECT file_name FROM attachments').all() as {
      file_name: string
    }[]).map((row) => row.file_name)
  )
}
