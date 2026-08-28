import { useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useEscape } from '../../shared/hooks'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose: () => void
}

export function SettingsDialog({ settings, onChange, onClose }: Props): React.JSX.Element {
  const [hotkey, setHotkey] = useState(settings.globalHotkey)
  useEscape(onClose)

  const toggle = (
    key: keyof Pick<AppSettings, 'launchAtLogin' | 'startMinimized' | 'postitVisible'>,
    label: string,
    hint?: string
  ): React.JSX.Element => (
    <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13 }}>
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(event) => onChange({ [key]: event.target.checked } as Partial<AppSettings>)}
        style={{ marginTop: 2 }}
      />
      <span>
        {label}
        {hint && (
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-faint)' }}>{hint}</span>
        )}
      </span>
    </label>
  )

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <header className="modal__head">
          <h2 className="modal__title display">Configurações</h2>
          <button className="btn btn--ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal__body">
          {toggle('launchAtLogin', 'Iniciar com o Windows')}
          {toggle('startMinimized', 'Abrir minimizado na bandeja', 'Só o post-it aparece no boot.')}
          {toggle('postitVisible', 'Post-it flutuante sempre visível')}

          <div>
            <label className="label">Atalho global de captura</label>
            <div className="form-row">
              <input
                className="field"
                value={hotkey}
                onChange={(event) => setHotkey(event.target.value)}
                placeholder="CommandOrControl+Alt+Space"
              />
              <button
                className="btn"
                style={{ flex: 'none' }}
                onClick={() => onChange({ globalHotkey: hotkey.trim() })}
              >
                Aplicar
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 5 }}>
              Formato do Electron: <code>CommandOrControl</code>, <code>Alt</code>,{' '}
              <code>Shift</code>, <code>Space</code>, letras e números.
            </p>
          </div>

          <div className="form-row">
            <div>
              <label className="label">Tema</label>
              <select
                className="field"
                value={settings.theme}
                onChange={(event) =>
                  onChange({ theme: event.target.value as AppSettings['theme'] })
                }
              >
                <option value="sistema">Sistema</option>
                <option value="claro">Claro</option>
                <option value="escuro">Escuro</option>
              </select>
            </div>
            <div>
              <label className="label">Adiar por (min)</label>
              <input
                className="field"
                type="number"
                min={1}
                value={settings.snoozeMinutes}
                onChange={(event) => onChange({ snoozeMinutes: Number(event.target.value) })}
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '4px 0' }} />

          <h3 style={{ fontSize: 13 }}>Notícias por voz</h3>
          <label style={{ display: 'flex', gap: 9, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.news.enabled}
              onChange={(event) => onChange({ news: { ...settings.news, enabled: event.target.checked } })}
            />
            Buscar notícias ao iniciar
          </label>
          <label style={{ display: 'flex', gap: 9, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.news.speakOnStartup}
              onChange={(event) =>
                onChange({ news: { ...settings.news, speakOnStartup: event.target.checked } })
              }
            />
            Falar automaticamente ao ligar o PC
          </label>
          <div className="form-row">
            <div>
              <label className="label">Velocidade da voz</label>
              <select
                className="field"
                value={settings.news.rate}
                onChange={(event) =>
                  onChange({ news: { ...settings.news, rate: Number(event.target.value) } })
                }
              >
                {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notícias por fonte</label>
              <input
                className="field"
                type="number"
                min={1}
                max={20}
                value={settings.news.maxArticlesPerSource}
                onChange={(event) =>
                  onChange({
                    news: { ...settings.news, maxArticlesPerSource: Number(event.target.value) }
                  })
                }
              />
            </div>
          </div>
        </div>

        <footer className="modal__foot">
          <span className="spacer" />
          <button className="btn btn--primary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}
