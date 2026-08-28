import Database from 'better-sqlite3'
import { MIGRATIONS, SEED } from './schema'

export type DB = Database.Database

let instance: DB | null = null

/**
 * Abre (ou cria) o banco, aplica migracoes pendentes e semeia o conteudo
 * inicial. `filePath` pode ser ':memory:' nos testes.
 */
export function createDatabase(filePath: string): DB {
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`)

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r) => (r as { id: string }).id)
  )

  const run = db.transaction((migrations: typeof MIGRATIONS) => {
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migration.id)
    }
  })
  run(MIGRATIONS)

  seed(db)
  return db
}

function seed(db: DB): void {
  const categoryCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
  if (categoryCount.n === 0) {
    const insert = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
    const many = db.transaction(() => {
      for (const c of SEED.categories) insert.run(c.name, c.color)
    })
    many()
  }

  const sourceCount = db.prepare('SELECT COUNT(*) AS n FROM news_sources').get() as { n: number }
  if (sourceCount.n === 0) {
    const newsCategory = db
      .prepare('SELECT id FROM categories WHERE name = ?')
      .get('Notícias') as { id: number } | undefined
    const insert = db.prepare(
      'INSERT INTO news_sources (category_id, name, feed_url) VALUES (?, ?, ?)'
    )
    const many = db.transaction(() => {
      for (const s of SEED.newsSources) insert.run(newsCategory?.id ?? null, s.name, s.feed_url)
    })
    many()
  }
}

export function setDatabase(db: DB): void {
  instance = db
}

export function getDatabase(): DB {
  if (!instance) throw new Error('Banco nao inicializado — chame setDatabase() no boot do main')
  return instance
}

export function closeDatabase(): void {
  instance?.close()
  instance = null
}

/** better-sqlite3 guarda booleanos como 0/1. */
export const toBool = (value: unknown): boolean => value === 1 || value === true
export const fromBool = (value: boolean | undefined, fallback = true): number =>
  (value ?? fallback) ? 1 : 0
export const nowIso = (): string => new Date().toISOString()
