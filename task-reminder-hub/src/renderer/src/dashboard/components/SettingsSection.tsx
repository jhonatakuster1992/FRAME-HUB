import { useState } from 'react'
import type { AlertSettings, AppSettings } from '@shared/types'
import { api } from '../../shared/api'
import { Icon } from '../../shared/Icon'
import { ThemeSwitch } from '../../shared/ThemeSwitch'

const SONS: { valor: string; rotulo: string }[] = [
  { valor: 'sino.wav', rotulo: 'Sino (discreto)' },
  { valor: 'toque.wav', rotulo: 'Toque curto' },
  { valor: 'gota.wav', rotulo: 'Gota' },
  { valor: 'proprio', rotulo: 'Som próprio…' }
]

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

export function SettingsSection({ settings, onChange }: Props): React.JSX.Element {
  const [hotkey, setHotkey] = useState(settings.globalHotkey)

  const mudarAlerta = (patch: Partial<AlertSettings>): void =>
    onChange({ alerts: { ...settings.alerts, ...patch } })

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

        <h3 style={{ fontSize: 14 }}>Alerta dos lembretes</h3>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={settings.alerts.popupEnabled}
            onChange={(event) => mudarAlerta({ popupEnabled: event.target.checked })}
          />
          <span>
            Aviso na tela, por cima de qualquer janela
            <small>
              Desligado, o lembrete vira a notificação padrão do Windows (que fica na Central de
              Ações, mas não aparece sobre tela cheia).
            </small>
          </span>
        </label>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={settings.alerts.soundEnabled}
            onChange={(event) => mudarAlerta({ soundEnabled: event.target.checked })}
          />
          <span>
            Tocar um som a cada disparo
            <small>Lembrete recorrente toca de novo a cada repetição configurada.</small>
          </span>
        </label>

        <div className="form-row">
          <div>
            <span className="label">Som</span>
            <select
              className="field"
              value={settings.alerts.sound}
              onChange={(event) => {
                if (event.target.value === 'proprio') void api.settings.pickSound()
                else mudarAlerta({ sound: event.target.value })
              }}
            >
              {SONS.map((som) => (
                <option key={som.valor} value={som.valor}>
                  {som.valor === 'proprio' && settings.alerts.customSound
                    ? `Meu som: ${settings.alerts.customSound.replace(/^\d+-/, '')}`
                    : som.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Sumir depois de (s)</span>
            <input
              className="field"
              type="number"
              min={0}
              max={120}
              value={settings.alerts.popupSeconds}
              onChange={(event) => mudarAlerta({ popupSeconds: Number(event.target.value) })}
            />
          </div>
        </div>

        <div>
          <span className="label">Volume</span>
          <div className="volume">
            <Icon name="som" className="icon icon--sm" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.alerts.volume * 100)}
              onChange={(event) => mudarAlerta({ volume: Number(event.target.value) / 100 })}
            />
            <span className="volume__valor">{Math.round(settings.alerts.volume * 100)}%</span>
            <button className="btn btn--sm" onClick={() => void api.settings.testAlert()}>
              <Icon name="play" className="icon icon--sm" /> Testar
            </button>
          </div>
          <p className="section__sub" style={{ marginTop: 6 }}>
            0 segundos mantém o aviso na tela até você clicar. Passar o mouse por cima também
            cancela o sumiço automático.
          </p>
        </div>

        <hr className="divider" />

        <h3 style={{ fontSize: 14 }}>Notícias por voz</h3>

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
