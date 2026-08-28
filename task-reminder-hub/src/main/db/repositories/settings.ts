import type { AppSettings } from '@shared/types'
import { getDatabase } from '../index'

export const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: true,
  startMinimized: true,
  globalHotkey: 'CommandOrControl+Alt+Space',
  postitVisible: true,
  theme: 'sistema',
  snoozeMinutes: 10,
  news: {
    enabled: true,
    speakOnStartup: true,
    rate: 1,
    maxArticlesPerSource: 5
  }
}

/** Merge raso + merge do bloco `news`, para nao perder chaves novas em updates. */
function merge(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return { ...base, ...patch, news: { ...base.news, ...(patch.news ?? {}) } }
}

export function getSettings(): AppSettings {
  const rows = getDatabase().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const stored = rows.reduce<Record<string, unknown>>((acc, row) => {
    try {
      acc[row.key] = JSON.parse(row.value)
    } catch {
      acc[row.key] = row.value
    }
    return acc
  }, {})
  return merge(DEFAULT_SETTINGS, stored as Partial<AppSettings>)
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = merge(getSettings(), patch)
  const stmt = getDatabase().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const many = getDatabase().transaction(() => {
    for (const [key, value] of Object.entries(next)) stmt.run(key, JSON.stringify(value))
  })
  many()
  return next
}
