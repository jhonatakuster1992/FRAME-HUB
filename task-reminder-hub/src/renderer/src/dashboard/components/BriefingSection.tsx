import { useEffect, useState } from 'react'
import type { BriefingState, Category, NewsSource } from '@shared/types'
import { api } from '../../shared/api'
import { NoteCard } from '../../shared/NoteCard'
import { Icon } from '../../shared/Icon'
import { useAppEvent } from '../../shared/hooks'

interface Props {
  categories: Category[]
}

/**
 * Briefing falado: fila de leitura, controles de voz e gestao de fontes.
 * O estado real vive no main (a fala acontece la); aqui so espelhamos.
 */
export function BriefingSection({ categories }: Props): React.JSX.Element {
  const [state, setState] = useState<BriefingState | null>(null)
  const [sources, setSources] = useState<NewsSource[]>([])
  const [tab, setTab] = useState<'noticias' | 'fontes'>('noticias')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)

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
    let fallback = url.trim()
    try {
      fallback = new URL(url).hostname
    } catch {
      /* url solta: usa o texto mesmo como nome */
    }
    await api.news.addSource({
      name: name.trim() || fallback,
      feed_url: url.trim(),
      category_id: categoryId
    })
    setName('')
    setUrl('')
  }

  const speaking = state?.status === 'speaking'
  const busy = state?.status === 'loading'

  const statusLabel = (): string => {
    if (busy) return 'Buscando notícias…'
    if (speaking) return `Lendo ${(state?.currentIndex ?? 0) + 1} de ${state?.articles.length ?? 0}`
    if (state?.status === 'paused') return 'Pausado'
    if (state?.articles.length) return `${state.articles.length} não lidas`
    return 'Nada novo desde a última leitura'
  }

  return (
    <section className="section">
      <header className="section__head">
        <p className="section__sub section__title">
          Buscado em segundo plano ao ligar o PC e lido em voz alta, por categoria.
        </p>
        <div className="seg seg--quiet">
          <button aria-pressed={tab === 'noticias'} onClick={() => setTab('noticias')}>
            Notícias
          </button>
          <button aria-pressed={tab === 'fontes'} onClick={() => setTab('fontes')}>
            Fontes
          </button>
        </div>
      </header>

      <div className="player">
        <button className="player__btn" onClick={() => void api.news.load()} disabled={busy} title="Atualizar">
          <Icon name="recarregar" />
        </button>
        <button className="player__btn" onClick={() => void api.news.previous()} title="Anterior">
          <Icon name="anterior" />
        </button>
        {speaking ? (
          <button className="player__main" onClick={() => void api.news.pause()} title="Pausar">
            <Icon name="pause" className="icon icon--lg" />
          </button>
        ) : (
          <button
            className="player__main"
            onClick={() => void (state?.status === 'paused' ? api.news.resume() : api.news.play())}
            disabled={!state || state.articles.length === 0}
            title="Ouvir"
          >
            <Icon name="play" className="icon icon--lg" />
          </button>
        )}
        <button className="player__btn" onClick={() => void api.news.next()} title="Pular">
          <Icon name="proximo" />
        </button>

        <select
          className="select"
          value={state?.rate ?? 1}
          onChange={(event) => void api.news.setRate(Number(event.target.value))}
          aria-label="Velocidade da voz"
        >
          {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
            <option key={rate} value={rate}>
              {rate}× velocidade
            </option>
          ))}
        </select>

        <span className="player__status">{statusLabel()}</span>
      </div>

      {state && !state.ttsAvailable && (
        <p className="section__sub">
          <Icon name="alerta" className="icon icon--sm" /> Voz indisponível nesta plataforma — o
          briefing fica só em texto.
        </p>
      )}
      {state?.error && (
        <p className="section__sub" style={{ color: 'var(--danger)' }}>
          {state.error}
        </p>
      )}

      {tab === 'noticias' ? (
        <div className="section__grid">
          {state?.articles.map((article, index) => (
            <NoteCard
              key={article.link}
              color={index === state.currentIndex ? 'var(--accent)' : 'var(--line-strong)'}
              className={`news-item${index === state.currentIndex ? ' news-item--current' : ''}`}
              onClick={() => void api.window.openExternal(article.link)}
            >
              <div className="news-item__title">{article.title}</div>
              <div className="news-item__meta">{article.source}</div>
              {article.summary && <div className="news-item__summary">{article.summary}</div>}
            </NoteCard>
          ))}
          {state?.articles.length === 0 && !busy && (
            <div className="empty">
              <b>Sem novidades</b>
              Tudo que essas fontes publicaram já foi lido.
            </div>
          )}
        </div>
      ) : (
        <>
          <form className="panel" onSubmit={addSource} style={{ boxShadow: 'none' }}>
            <div className="panel__field panel__field--grow">
              <Icon name="briefing" className="icon icon--sm" />
              <input
                placeholder="Nome da fonte"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="panel__field panel__field--grow">
              <Icon name="externo" className="icon icon--sm" />
              <input
                placeholder="https://… RSS ou news.google.com/rss/search?q=…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <select
              className="select"
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
              <Icon name="mais" className="icon icon--sm" /> Adicionar
            </button>
          </form>

          <div className="rail__list">
            {sources.map((source) => (
              <div key={source.id} className="source-row">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={(event) =>
                    void api.news.updateSource(source.id, { enabled: event.target.checked })
                  }
                  aria-label={`Ativar ${source.name}`}
                />
                <span className="source-row__name" title={source.feed_url}>
                  {source.name}
                </span>
                <button
                  className="btn btn--ghost btn--danger"
                  onClick={() => void api.news.removeSource(source.id)}
                >
                  <Icon name="lixo" className="icon icon--sm" /> remover
                </button>
              </div>
            ))}
            {sources.length === 0 && <p className="rail__empty">Nenhuma fonte cadastrada.</p>}
          </div>
        </>
      )}
    </section>
  )
}
