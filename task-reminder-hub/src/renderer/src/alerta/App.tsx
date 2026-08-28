import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlertPayload } from '@shared/types'
import { api } from '../shared/api'
import { Icon } from '../shared/Icon'
import { useAppEvent, useSettings, useTheme } from '../shared/hooks'
import { fmtTime } from '../shared/date'

interface EmTela extends AlertPayload {
  /** Chave própria: a mesma tarefa pode disparar de novo antes de sumir. */
  chave: number
  saindo?: boolean
}

/**
 * Aviso de lembrete. Esta janela também é quem toca o som — por isso ela
 * existe mesmo com a popup desligada, só que sem aparecer.
 */
export function App(): React.JSX.Element {
  const [fila, setFila] = useState<EmTela[]>([])
  const [settings] = useSettings()
  useTheme(settings?.theme)
  const raiz = useRef<HTMLDivElement>(null)
  const sequencia = useRef(0)

  const tocar = useCallback((alerta: AlertPayload) => {
    if (!alerta.sound) return
    const audio = new Audio(alerta.sound)
    audio.volume = Math.min(Math.max(alerta.volume, 0), 1)
    void audio.play().catch((erro) => console.error('[alerta] som não tocou:', erro))
  }, [])

  const remover = useCallback((chave: number) => {
    setFila((atual) => atual.map((item) => (item.chave === chave ? { ...item, saindo: true } : item)))
    window.setTimeout(
      () => setFila((atual) => atual.filter((item) => item.chave !== chave)),
      180
    )
  }, [])

  useAppEvent((evento) => {
    if (evento.type === 'alert') {
      tocar(evento.alert)
      if (!evento.alert.showPopup) return
      sequencia.current += 1
      setFila((atual) => [...atual, { ...evento.alert, chave: sequencia.current }])
    }
    if (evento.type === 'alert-dismiss') {
      setFila((atual) =>
        atual.map((item) => (item.taskId === evento.taskId ? { ...item, saindo: true } : item))
      )
      window.setTimeout(
        () => setFila((atual) => atual.filter((item) => item.taskId !== evento.taskId)),
        180
      )
    }
  })

  // A janela acompanha a altura da pilha; vazia, some da tela.
  useEffect(() => {
    if (fila.length === 0) {
      void api.alert.action(-1, 'fechar').catch(() => undefined)
      return
    }
    const altura = raiz.current?.offsetHeight ?? 160
    void api.alert.resize(altura)
  }, [fila])

  const agir = (item: EmTela, acao: 'concluir' | 'adiar' | 'abrir'): void => {
    remover(item.chave)
    if (item.taskId > 0) void api.alert.action(item.taskId, acao)
  }

  return (
    <div className="alertas" ref={raiz}>
      {fila.map((item) => (
        <article
          key={item.chave}
          className={`alerta${item.saindo ? ' alerta--saindo' : ''}`}
          style={{ ['--alerta-cor' as string]: item.categoryColor ?? 'var(--violeta)' }}
          onMouseEnter={() => setFila((atual) => atual.map((a) => (a.chave === item.chave ? { ...a, popupSeconds: 0 } : a)))}
        >
          <div className="alerta__faixa" />
          <div className="alerta__corpo">
            <header className="alerta__topo">
              <span className="alerta__marca">
                <Icon name="sino" className="icon icon--sm" />
              </span>
              <span className="alerta__agenda">{item.categoryName ?? 'Lembrete'}</span>
              <button
                className="alerta__fechar"
                onClick={() => {
                  remover(item.chave)
                  if (item.taskId > 0) void api.alert.action(item.taskId, 'fechar')
                }}
                aria-label="Fechar"
              >
                <Icon name="fechar" className="icon icon--sm" />
              </button>
            </header>

            <h1 className="alerta__titulo">{item.title}</h1>
            {item.description && <p className="alerta__desc">{item.description}</p>}

            <div className="alerta__meta">
              {item.dueAt && (
                <span className="tabular">
                  <Icon name="relogio" className="icon icon--sm" /> {fmtTime(new Date(item.dueAt))}
                </span>
              )}
              {item.recurrence && <span className="chip chip--plain">{item.recurrence}</span>}
              {item.attachments > 0 && (
                <span className="chip chip--plain">
                  {item.attachments} anexo{item.attachments > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="alerta__acoes">
              <button className="btn btn--primary" onClick={() => agir(item, 'concluir')}>
                <Icon name="check" className="icon icon--sm" /> Concluir
              </button>
              <button className="btn btn--soft" onClick={() => agir(item, 'adiar')}>
                <Icon name="relogio" className="icon icon--sm" /> Adiar
              </button>
              <button className="btn" onClick={() => agir(item, 'abrir')} title="Abrir no app">
                <Icon name="externo" className="icon icon--sm" />
              </button>
            </div>
          </div>

          {item.popupSeconds > 0 && (
            <div
              className="alerta__barra"
              style={{ animationDuration: `${item.popupSeconds}s` }}
              onAnimationEnd={() => remover(item.chave)}
            />
          )}
        </article>
      ))}
    </div>
  )
}
