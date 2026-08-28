import type { AppSettings } from '@shared/types'
import { BrandMark, Icon, type IconName } from '../../shared/Icon'
import { ThemeSwitch } from '../../shared/ThemeSwitch'

export type Section = 'tarefas' | 'agenda' | 'briefing' | 'produtividade' | 'ajustes'

const ITEMS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'tarefas', label: 'Tarefas', icon: 'tarefas' },
  { id: 'agenda', label: 'Agenda', icon: 'agenda' },
  { id: 'briefing', label: 'Briefing', icon: 'briefing' },
  { id: 'produtividade', label: 'Produtividade', icon: 'grafico' },
  { id: 'ajustes', label: 'Ajustes', icon: 'ajustes' }
]

interface Props {
  section: Section
  onSection: (section: Section) => void
  pendingCount: number
  hotkey: string
  theme: AppSettings['theme'] | undefined
  onTheme: (theme: AppSettings['theme']) => void
}

/** Barra lateral: navegacao entre secoes + escolha de tema. */
export function Sidebar({
  section,
  onSection,
  pendingCount,
  hotkey,
  theme,
  onTheme
}: Props): React.JSX.Element {
  return (
    <nav className="nav">
      <div className="nav__brand">
        <BrandMark size={36} />
        <span className="nav__wordmark">
          <span className="nav__name">Task Hub</span>
          <span className="nav__tagline">tarefas &amp; lembretes</span>
        </span>
      </div>

      <div className="nav__items">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav__item${section === item.id ? ' nav__item--active' : ''}`}
            onClick={() => onSection(item.id)}
            aria-current={section === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            {item.label}
            {item.id === 'tarefas' && pendingCount > 0 && (
              <span className="nav__badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="nav__foot">
        <p className="nav__hint">
          <b>Captura rápida</b>
          <br />
          <kbd>{hotkey.replace('CommandOrControl', 'Ctrl')}</kbd> em qualquer lugar do Windows.
        </p>
        <ThemeSwitch value={theme} onChange={onTheme} tone="nav" />
      </div>
    </nav>
  )
}
