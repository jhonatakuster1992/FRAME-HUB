import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppEvent, AppSettings, Category } from '@shared/types'
import { api } from './api'

/** Assina os eventos empurrados pelo main (dados mudaram, lembrete disparou...). */
export function useAppEvent(listener: (event: AppEvent) => void): void {
  const ref = useRef(listener)
  ref.current = listener
  useEffect(() => api.onEvent((event) => ref.current(event)), [])
}

export function useCategories(): [Category[], () => void] {
  const [categories, setCategories] = useState<Category[]>([])
  const reload = useCallback(() => {
    void api.categories.list().then(setCategories)
  }, [])

  useEffect(reload, [reload])
  useAppEvent((event) => {
    if (event.type === 'data-changed' && event.scope === 'categories') reload()
  })
  return [categories, reload]
}

export function useSettings(): [AppSettings | null, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void api.settings.get().then(setSettings)
  }, [])
  useAppEvent((event) => {
    if (event.type === 'data-changed' && event.scope === 'settings') {
      void api.settings.get().then(setSettings)
    }
  })

  const update = useCallback((patch: Partial<AppSettings>) => {
    void api.settings.update(patch).then(setSettings)
  }, [])
  return [settings, update]
}

/** Tema claro/escuro/sistema aplicado no <html data-theme>. */
export function useTheme(theme: AppSettings['theme'] | undefined): void {
  useEffect(() => {
    if (!theme) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const resolved = theme === 'sistema' ? (media.matches ? 'escuro' : 'claro') : theme
      document.documentElement.dataset.theme = resolved
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

/** Fecha modal / limpa campo no Esc. */
export function useEscape(handler: () => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
