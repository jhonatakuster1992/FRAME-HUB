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
  return (
    <nav className="nav">
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
