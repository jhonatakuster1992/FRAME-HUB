import type { NewsSource } from '@shared/types'
import { getDatabase, toBool, fromBool } from '../index'

interface SourceRow extends Omit<NewsSource, 'enabled'> {
  enabled: number
}

const map = (row: SourceRow): NewsSource => ({ ...row, enabled: toBool(row.enabled) })

export function listSources(): NewsSource[] {
  return (
    getDatabase().prepare('SELECT * FROM news_sources ORDER BY name').all() as SourceRow[]
  ).map(map)
}

export function addSource(input: {
  name: string
  feed_url: string
  category_id?: number | null
}): NewsSource {
  const info = getDatabase()
    .prepare('INSERT INTO news_sources (category_id, name, feed_url) VALUES (?, ?, ?)')
    .run(input.category_id ?? null, input.name.trim(), input.feed_url.trim())
  return map(
    getDatabase()
      .prepare('SELECT * FROM news_sources WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as SourceRow
  )
}

export function updateSource(id: number, patch: Partial<NewsSource>): void {
  const current = getDatabase().prepare('SELECT * FROM news_sources WHERE id = ?').get(id) as
    | SourceRow
    | undefined
  if (!current) return
  getDatabase()
    .prepare('UPDATE news_sources SET name = ?, feed_url = ?, category_id = ?, enabled = ? WHERE id = ?')
    .run(
      patch.name ?? current.name,
      patch.feed_url ?? current.feed_url,
      patch.category_id !== undefined ? patch.category_id : current.category_id,
      fromBool(patch.enabled, toBool(current.enabled)),
      id
    )
}

export function removeSource(id: number): void {
  getDatabase().prepare('DELETE FROM news_sources WHERE id = ?').run(id)
}

export function isRead(articleUrl: string): boolean {
  return (
    getDatabase().prepare('SELECT 1 FROM news_read_log WHERE article_url = ?').get(articleUrl) !==
    undefined
  )
}

export function markRead(articleUrl: string): void {
  getDatabase()
    .prepare('INSERT OR IGNORE INTO news_read_log (article_url, read_at) VALUES (?, ?)')
    .run(articleUrl, new Date().toISOString())
}

/** Mantem o log enxuto: noticias lidas ha mais de N dias saem. */
export function pruneReadLog(days = 14): void {
  getDatabase()
    .prepare('DELETE FROM news_read_log WHERE read_at < ?')
    .run(new Date(Date.now() - days * 86_400_000).toISOString())
}
