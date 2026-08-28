import { useLayoutEffect, useRef } from 'react'
import type { AppSettings } from '@shared/types'
import { BrandMark, NavIcon, type NavIconName } from '../../shared/Icon'
import { ThemeSwitch } from '../../shared/ThemeSwitch'

export type Section = NavIconName

const ITEMS: { id: Section; label: string }[] = [
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'produtividade', label: 'Produtividade' },
  { id: 'ajustes', label: 'Ajustes' }
]

interface Props {
  section: Section
  onSection: (section: Section) => void
  pendingCount: number
  hotkey: string
  collapsed: boolean
  theme: AppSettings['theme'] | undefined
  onTheme: (theme: AppSettings['theme']) => void
}

export function Sidebar({
  section,
  onSection,
  pendingCount,
  hotkey,
  collapsed,
  theme,
  onTheme
}: Props): React.JSX.Element {
  const navRef = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // As faixas violeta sao pintadas em volta da aba ativa, entao precisam da
  // posicao real dela — medir e mais seguro que calcular por altura fixa
  // (janela baixa, rotulo maior ou fonte diferente moveriam o item).
  useLayoutEffect(() => {
    const nav = navRef.current
    const item = activeRef.current
    if (!nav || !item) return

    const apply = (): void => {
      const navBox = nav.getBoundingClientRect()
      const itemBox = item.getBoundingClientRect()
      nav.style.setProperty('--active-top', `${itemBox.top - navBox.top}px`)
      nav.style.setProperty('--active-h', `${itemBox.height}px`)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(nav)
    observer.observe(item)
    return () => observer.disconnect()
  }, [section, collapsed])

  return (
    <nav className="nav" ref={navRef}>
      <span className="nav__fill nav__fill--top" />
      <span className="nav__fill nav__fill--mid" />
      <span className="nav__fill nav__fill--bottom" />

      <div className="nav__brand">
        <BrandMark size={collapsed ? 40 : 44} />
        {!collapsed && (
          <span className="nav__wordmark">
            <span className="nav__name">Tasker</span>
            <span className="nav__tagline">tarefas &amp; lembretes</span>
          </span>
        )}
      </div>

      <div className="nav__items">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            ref={section === item.id ? activeRef : undefined}
            className={`nav__item${section === item.id ? ' nav__item--active' : ''}`}
            onClick={() => onSection(item.id)}
            aria-current={section === item.id ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
          >
            <NavIcon name={item.id} />
            {!collapsed && item.label}
            {!collapsed && item.id === 'tarefas' && pendingCount > 0 && (
              <span className="nav__badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="nav__foot">
        {!collapsed && (
          <p className="nav__credit">
            <b>Captura rápida</b>
            <kbd>{hotkey.replace('CommandOrControl', 'Ctrl')}</kbd> em qualquer lugar
            <br />
            do Windows — digita, Enter, some.
          </p>
        )}
        <div className="nav__foot-row">
          <ThemeSwitch value={theme} onChange={onTheme} tone="nav" />
          {!collapsed && <span className="nav__dots" />}
        </div>
      </div>
    </nav>
  )
}
