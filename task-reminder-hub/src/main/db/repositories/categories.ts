import type { Category, CategoryInput } from '@shared/types'
import { getDatabase, toBool, fromBool } from '../index'

interface CategoryRow {
  id: number
  name: string
  color: string
  visible: number
  created_at: string
}

const map = (row: CategoryRow): Category => ({ ...row, visible: toBool(row.visible) })

export function listCategories(): Category[] {
  return (getDatabase().prepare('SELECT * FROM categories ORDER BY name').all() as CategoryRow[]).map(map)
}

export function getCategory(id: number): Category | null {
  const row = getDatabase().prepare('SELECT * FROM categories WHERE id = ?').get(id) as
    | CategoryRow
    | undefined
  return row ? map(row) : null
}

export function createCategory(input: CategoryInput): Category {
  const info = getDatabase()
    .prepare('INSERT INTO categories (name, color, visible) VALUES (?, ?, ?)')
    .run(input.name.trim(), input.color, fromBool(input.visible))
  return getCategory(Number(info.lastInsertRowid))!
}

export function updateCategory(id: number, patch: Partial<CategoryInput>): Category | null {
  const current = getCategory(id)
  if (!current) return null
  getDatabase()
    .prepare('UPDATE categories SET name = ?, color = ?, visible = ? WHERE id = ?')
    .run(
      patch.name?.trim() ?? current.name,
      patch.color ?? current.color,
      fromBool(patch.visible, current.visible),
      id
    )
  return getCategory(id)
}

export function deleteCategory(id: number): void {
  getDatabase().prepare('DELETE FROM categories WHERE id = ?').run(id)
}

/** Usada pela captura rapida: "#Loja" acha ou cria a categoria. */
export function findOrCreateByName(name: string, color = '#8B7FD1'): Category {
  const existing = getDatabase()
    .prepare('SELECT * FROM categories WHERE lower(name) = lower(?)')
    .get(name.trim()) as CategoryRow | undefined
  if (existing) return map(existing)
  return createCategory({ name, color })
}
