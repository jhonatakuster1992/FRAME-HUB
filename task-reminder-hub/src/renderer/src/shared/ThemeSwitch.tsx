import type { AppSettings } from '@shared/types'
import { Icon, type IconName } from './Icon'

const OPTIONS: { value: AppSettings['theme']; label: string; icon: IconName }[] = [
  { value: 'claro', label: 'Modo claro', icon: 'sol' },
  { value: 'escuro', label: 'Modo escuro', icon: 'lua' },
  { value: 'sistema', label: 'Seguir o sistema', icon: 'auto' }
]

interface Props {
  value: AppSettings['theme'] | undefined
  onChange: (theme: AppSettings['theme']) => void
  /** 'nav' herda as cores da barra lateral; 'bar' usa as da superficie. */
  tone?: 'bar' | 'nav'
}

/** Escolha explicita de tema — claro, escuro ou o que o sistema disser. */
export function ThemeSwitch({ value, onChange, tone = 'bar' }: Props): React.JSX.Element {
  return (
    <div className={`theme-switch theme-switch--${tone}`} role="group" aria-label="Tema">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          aria-label={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <Icon name={option.icon} className="icon icon--sm" />
        </button>
      ))}
    </div>
  )
}
