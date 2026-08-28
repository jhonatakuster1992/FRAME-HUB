import { useEffect, useState } from 'react'
import type { BriefingState, Category, NewsSource } from '@shared/types'
import { api } from '../../shared/api'
import { NoteCard } from '../../shared/NoteCard'
import { useAppEvent, useEscape } from '../../shared/hooks'

interface Props {
  categories: Category[]
  onClose: () => void
}

/**
 * Briefing de noticias: fila de leitura + controles de voz + gestao de feeds.
 * O estado real vive no main (a fala e feita la); aqui so espelhamos.
 */
export function NewsPanel({ categories, onClose }: Props): React.JSX.Element {
  const [state, setState] = useState<BriefingState | null>(null)
  const [sources, setSources] = useState<NewsSource[]>([])
  const [showSources, setShowSources] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)

  useEscape(onClose)

  const loadSources = (): void => {
    void api.news.sources().then(setSources)
  }

  useEffect(() => {
    void api.news.state().then(setState)
    loadSources()
  }, [])

  useAppEvent((event) => {
    if (event.type === 'briefing-state') setState(event.state)
    if (event.type === 'data-changed' && event.scope === 'news') loadSources()
  })

  const addSource = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!url.trim()) return
    await api.news.addSource({
      name: name.trim() || new URL(url).hostname,
      feed_url: url.trim(),
      category_id: categoryId
    })
    setName('')
    setUrl('')
  }

  const speaking = state?.status === 'speaking'
  const busy = state?.status === 'loading'

  return (
    <aside className="drawer">
      <header className="drawer__head">
        <h2 className="drawer__title display">Briefing de notícias</h2>
        <button className="btn btn--ghost" onClick={() => setShowSources((value) => !value)}>
          {showSources ? 'Notícias' : 'Fontes'}
        </button>
        <button className="btn btn--ghost" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="drawer__body">
        {showSources ? (
          <>
            <form onSubmit={addSource} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="field"
                placeholder="Nome da fonte"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                className="field"
                placeholder="https://… (RSS ou news.google.com/rss/search?q=…)"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <div className="form-row">
                <select
                  className="field"
                  value={categoryId ?? ''}
                  onChange={(event) =>
                    setCategoryId(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn--primary" type="submit">
                  Adicionar
                </button>
              </div>
            </form>

            <div>
              {sources.map((source) => (
                <div key={source.id} className="source-row">
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(event) =>
                      void api.news.updateSource(source.id, { enabled: event.target.checked })
                    }
                  />
                  <span className="source-row__name" title={source.feed_url}>
                    {source.name}
                  </span>
                  <button
                    className="btn btn--ghost btn--danger"
                    onClick={() => void api.news.removeSource(source.id)}
                  >
                    remover
                  </button>
                </div>
              ))}
              {sources.length === 0 && (
                <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                  Nenhuma fonte cadastrada.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {state?.error && (
              <p style={{ fontSize: 12, color: 'var(--ceramica)' }}>{state.error}</p>
            )}
            {state && !state.ttsAvailable && (
              <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                Voz indisponível nesta plataforma — o briefing fica só em texto.
              </p>
            )}
            {busy && <p style={{ fontSize: 12.5 }}>Buscando notícias…</p>}
            {state && state.articles.length === 0 && !busy && (
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                Nada novo desde a última leitura.
              </p>
            )}

            {state?.articles.map((article, index) => (
              <NoteCard
                key={article.link}
                color={index === state.currentIndex ? 'var(--marmelada)' : 'var(--line-strong)'}
                className={`news-item${index === state.currentIndex ? ' news-item--current' : ''}`}
                onClick={() => void api.window.openExternal(article.link)}
              >
                <div className="news-item__title">{article.title}</div>
                <div className="news-item__meta">{article.source}</div>
                {article.summary && <div className="news-item__summary">{article.summary}</div>}
              </NoteCard>
            ))}
          </>
        )}
      </div>

      <div className="news-controls">
        <button className="btn" onClick={() => void api.news.load()} disabled={busy}>
          ⟳
        </button>
        <button className="btn" onClick={() => void api.news.previous()}>
          ⏮
        </button>
        {speaking ? (
          <button className="btn btn--primary" onClick={() => void api.news.pause()}>
            ⏸ Pausar
          </button>
        ) : (
          <button
            className="btn btn--primary"
            onClick={() =>
              void (state?.status === 'paused' ? api.news.resume() : api.news.play())
            }
            disabled={!state || state.articles.length === 0}
          >
            ▶ Ouvir
          </button>
        )}
        <button className="btn" onClick={() => void api.news.next()}>
          ⏭
        </button>
        <select
          className="field"
          style={{ width: 74 }}
          value={state?.rate ?? 1}
          onChange={(event) => void api.news.setRate(Number(event.target.value))}
          aria-label="Velocidade"
        >
          {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>
      </div>
    </aside>
  )
}
