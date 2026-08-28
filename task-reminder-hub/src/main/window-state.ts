import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Bounds {
  x?: number
  y?: number
  width: number
  height: number
}

type Store = Record<string, Bounds>

/**
 * Posicao/tamanho das janelas fica num JSON simples no userData — dado
 * volatil de UI, nao merece tabela no banco.
 */
function file(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function read(): Store {
  try {
    return JSON.parse(readFileSync(file(), 'utf-8')) as Store
  } catch {
    return {}
  }
}

export function loadBounds(key: string, fallback: Bounds): Bounds {
  return { ...fallback, ...read()[key] }
}

export function saveBounds(key: string, bounds: Bounds): void {
  try {
    writeFileSync(file(), JSON.stringify({ ...read(), [key]: bounds }, null, 2), 'utf-8')
  } catch (error) {
    console.error('[window-state] nao consegui salvar:', error)
  }
}
