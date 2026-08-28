import { useState } from 'react'
import type { AppSettings } from '@shared/types'
import { ThemeSwitch } from '../../shared/ThemeSwitch'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

export function SettingsSection({ settings, onChange }: Props): React.JSX.Element {
  const [hotkey, setHotkey] = useState(settings.globalHotkey)

  const toggle = (
    key: 'launchAtLogin' | 'startMinimized' | 'postitVisible' | 'postitAlwaysOnTop',
    label: string,
    hint?: string
  ): React.JSX.Element => (
    <label className="switch-row">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(event) => onChange({ [key]: event.target.checked } as Partial<AppSettings>)}
      />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )

  return (
    <section className="section">
      <header className="section__head">
        <p className="section__sub section__title">
          Comportamento do app, atalho global e briefing.
        </p>
      </header>

      <div className="form-stack">
        <div>
          <span className="label">Aparência</span>
          <div className="switch-row" style={{ alignItems: 'center' }}>
            <ThemeSwitch value={settings.theme} onChange={(theme) => onChange({ theme })} />
            <span>
              {settings.theme === 'sistema' ? 'Seguindo o sistema' : `Modo ${settings.theme}`}
              <small>Vale para o dashboard, o post-it e a caixa de captura.</small>
            </span>
          </div>
        </div>

        {toggle('launchAtLogin', 'Iniciar com o Windows')}
        {toggle('startMinimized', 'Abrir minimizado na bandeja', 'Só o post-it aparece no boot.')}
        {toggle('postitVisible', 'Post-it flutuante sempre visível')}
        {toggle(
          'postitAlwaysOnTop',
          'Manter o post-it acima das outras janelas',
          'Desligado, ele se comporta como janela comum: clicar em outro app o manda para trás. Para trazê-lo de volta, use a bandeja.'
        )}

        <div>
          <span className="label">Atalho global de captura</span>
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
          <p className="section__sub" style={{ marginTop: 6 }}>
            Formato do Electron: <code>CommandOrControl</code>, <code>Alt</code>,{' '}
            <code>Shift</code>, <code>Space</code>, letras e números.
          </p>
        </div>

        <div className="form-row">
          <div>
            <span className="label">Adiar por (min)</span>
            <input
              className="field"
              type="number"
              min={1}
              value={settings.snoozeMinutes}
              onChange={(event) => onChange({ snoozeMinutes: Number(event.target.value) })}
            />
          </div>
          <div>
            <span className="label">Notícias por fonte</span>
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
          <div>
            <span className="label">Velocidade da voz</span>
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
        </div>

        <hr className="divider" />

        <label className="switch-row">
          <input
            type="checkbox"
            checked={settings.news.enabled}
            onChange={(event) => onChange({ news: { ...settings.news, enabled: event.target.checked } })}
          />
          <span>
            Buscar notícias ao iniciar
            <small>A busca roda em segundo plano, sem travar o boot do app.</small>
          </span>
        </label>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={settings.news.speakOnStartup}
            onChange={(event) =>
              onChange({ news: { ...settings.news, speakOnStartup: event.target.checked } })
            }
          />
          <span>Falar automaticamente ao ligar o PC</span>
        </label>
      </div>
    </section>
  )
}
