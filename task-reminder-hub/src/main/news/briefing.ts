import type { BriefingState } from '@shared/types'
import { getSettings } from '../db/repositories/settings'
import { pruneReadLog } from '../db/repositories/news'
import { fetchUnreadArticles, markArticleRead } from './feeds'
import { createTtsEngine, type TtsEngine } from './tts'

/**
 * Briefing falado: busca em segundo plano (nunca bloqueia o boot do app),
 * le titulo + resumo de cada noticia em sequencia e marca como lida para
 * nao repetir no proximo reinicio do dia.
 */
export class Briefing {
  private tts: TtsEngine = createTtsEngine()
  private state: BriefingState = {
    status: 'idle',
    articles: [],
    currentIndex: 0,
    rate: 1,
    ttsAvailable: false
  }
  /** Marca a "geracao" da reproducao: qualquer mudanca invalida o loop antigo. */
  private runId = 0

  constructor(private readonly emit: (state: BriefingState) => void) {
    this.state.ttsAvailable = this.tts.available
    this.state.rate = getSettings().news.rate
  }

  getState(): BriefingState {
    return { ...this.state, articles: [...this.state.articles] }
  }

  private update(patch: Partial<BriefingState>): void {
    this.state = { ...this.state, ...patch }
    this.emit(this.getState())
  }

  /** Carrega as noticias novas. Nao fala nada por conta propria. */
  async load(): Promise<BriefingState> {
    const settings = getSettings()
    if (!settings.news.enabled) {
      this.update({ status: 'idle', articles: [], currentIndex: 0 })
      return this.getState()
    }

    this.update({ status: 'loading', error: undefined })
    try {
      pruneReadLog()
      const { articles, errors } = await fetchUnreadArticles(settings.news.maxArticlesPerSource)
      this.update({
        status: 'ready',
        articles,
        currentIndex: 0,
        rate: settings.news.rate,
        error: errors.length ? errors.join(' · ') : undefined
      })
    } catch (error) {
      this.update({ status: 'error', error: (error as Error).message })
    }
    return this.getState()
  }

  /** Rotina de boot: carrega e, se configurado, ja comeca a falar. */
  async runOnStartup(): Promise<void> {
    const settings = getSettings()
    if (!settings.news.enabled) return
    await this.load()
    if (settings.news.speakOnStartup && this.state.articles.length > 0) void this.play()
  }

  async play(fromIndex?: number): Promise<void> {
    if (this.state.articles.length === 0) return
    const startAt = fromIndex ?? this.state.currentIndex
    const runId = ++this.runId
    this.update({ status: 'speaking', currentIndex: startAt })

    for (let i = startAt; i < this.state.articles.length; i++) {
      if (runId !== this.runId) return // pausado/pulado/parado
      const article = this.state.articles[i]
      this.update({ currentIndex: i })

      const text = `${article.title}. ${article.summary}`
      try {
        if (this.tts.available) await this.tts.speak(text, this.state.rate)
      } catch (error) {
        console.error('[briefing] falha ao falar:', error)
      }
      if (runId !== this.runId) return
      markArticleRead(article.link)
    }

    if (runId === this.runId) this.update({ status: 'ready', currentIndex: 0 })
  }

  pause(): void {
    this.runId++
    this.tts.stop()
    this.update({ status: 'paused' })
  }

  resume(): void {
    if (this.state.status !== 'paused') return
    void this.play(this.state.currentIndex)
  }

  next(): void {
    const target = Math.min(this.state.currentIndex + 1, this.state.articles.length - 1)
    const wasSpeaking = this.state.status === 'speaking'
    this.runId++
    this.tts.stop()
    const current = this.state.articles[this.state.currentIndex]
    if (current) markArticleRead(current.link)
    this.update({ currentIndex: target })
    if (wasSpeaking) void this.play(target)
  }

  previous(): void {
    const target = Math.max(this.state.currentIndex - 1, 0)
    const wasSpeaking = this.state.status === 'speaking'
    this.runId++
    this.tts.stop()
    this.update({ currentIndex: target })
    if (wasSpeaking) void this.play(target)
  }

  setRate(rate: number): void {
    const clamped = Math.min(Math.max(rate, 0.5), 2)
    const wasSpeaking = this.state.status === 'speaking'
    this.runId++
    this.tts.stop()
    this.update({ rate: clamped })
    if (wasSpeaking) void this.play(this.state.currentIndex)
  }

  stop(): void {
    this.runId++
    this.tts.stop()
    this.update({ status: 'ready', currentIndex: 0 })
  }
}
