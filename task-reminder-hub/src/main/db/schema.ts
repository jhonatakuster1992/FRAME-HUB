/**
 * Migracoes do banco. Cada entrada roda uma unica vez, em ordem, dentro de
 * uma transacao; o id fica gravado em schema_migrations.
 * Nunca edite uma migracao ja publicada — acrescente outra.
 */
export interface Migration {
  id: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_initial',
    sql: `
      CREATE TABLE categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE,
        color      TEXT    NOT NULL,
        visible    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      );

      CREATE TABLE tasks (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        title            TEXT    NOT NULL,
        description      TEXT,
        category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        priority         TEXT    NOT NULL DEFAULT 'media'
                                 CHECK (priority IN ('baixa','media','alta')),
        status           TEXT    NOT NULL DEFAULT 'pendente'
                                 CHECK (status IN ('pendente','concluida','adiada')),
        due_at           TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        completed_at     TEXT
      );
      CREATE INDEX idx_tasks_due     ON tasks(due_at);
      CREATE INDEX idx_tasks_status  ON tasks(status);
      CREATE INDEX idx_tasks_cat     ON tasks(category_id);

      -- Um lembrete por tarefa: mantem a UI (e o agendador) simples.
      CREATE TABLE reminders (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id           INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
        recurrence_type   TEXT    NOT NULL
                                  CHECK (recurrence_type IN
                                    ('once','minutes','hourly','daily','weekly','monthly','custom_times')),
        recurrence_value  TEXT,
        next_trigger_at   TEXT,
        last_triggered_at TEXT,
        enabled           INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_reminders_next ON reminders(next_trigger_at) WHERE enabled = 1;

      CREATE TABLE history (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        action    TEXT    NOT NULL
                          CHECK (action IN ('created','completed','snoozed','rescheduled','reopened')),
        timestamp TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        meta      TEXT
      );
      CREATE INDEX idx_history_task ON history(task_id);
      CREATE INDEX idx_history_time ON history(timestamp);

      CREATE TABLE news_sources (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        name        TEXT    NOT NULL,
        feed_url    TEXT    NOT NULL UNIQUE,
        enabled     INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE news_read_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        article_url TEXT    NOT NULL UNIQUE,
        read_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      );
      CREATE INDEX idx_news_read_at ON news_read_log(read_at);

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `
  },
  {
    id: '002_attachments',
    sql: `
      CREATE TABLE attachments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        kind          TEXT    NOT NULL CHECK (kind IN ('imagem','audio','arquivo')),
        file_name     TEXT    NOT NULL UNIQUE,
        original_name TEXT    NOT NULL,
        mime          TEXT    NOT NULL DEFAULT '',
        size_bytes    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      );
      CREATE INDEX idx_attachments_task ON attachments(task_id);
    `
  }
]

/** Categorias e feeds de estreia — so entram em banco vazio. */
export const SEED = {
  categories: [
    { name: 'Pessoal', color: '#7C3AED' },
    { name: 'Loja', color: '#F59E0B' },
    { name: 'Freelance', color: '#10B981' },
    { name: 'Notícias', color: '#0EA5E9' }
  ],
  newsSources: [
    { name: 'Google Notícias — IA', feed_url: 'https://news.google.com/rss/search?q=intelig%C3%AAncia+artificial&hl=pt-BR&gl=BR&ceid=BR:pt-419' },
    { name: 'Google Notícias — Games', feed_url: 'https://news.google.com/rss/search?q=games&hl=pt-BR&gl=BR&ceid=BR:pt-419' }
  ]
}
