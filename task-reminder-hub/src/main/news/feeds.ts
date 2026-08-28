import Parser from 'rss-parser'
import type { NewsArticle } from '@shared/types'
import * as news from '../db/repositories/news'

const parser = new Parser({
  timeout: 12_000,
  headers: { 'User-Agent': 'TaskReminderHub/0.1 (+local)' }
})

/** Tira HTML e espaco extra do resumo do feed. */
function clean(raw: string | undefined, limit = 320): string {
  if (!raw) return ''
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

/**
 * Busca todos os feeds ativos em paralelo e devolve so o que ainda nao foi
 * lido. Falha de um feed nao derruba os outros.
 */
export async function fetchUnreadArticles(maxPerSource: number): Promise<{
  articles: NewsArticle[]
  errors: string[]
}> {
  const sources = news.listSources().filter((s) => s.enabled)
  const errors: string[] = []

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.feed_url)
        return (feed.items ?? [])
          .filter((item) => item.link && !news.isRead(item.link))
          .slice(0, maxPerSource)
          .map<NewsArticle>((item) => ({
            title: clean(item.title, 160) || '(sem titulo)',
            link: item.link!,
            summary: clean(item.contentSnippet ?? item.content ?? item.summary),
            source: source.name,
            categoryId: source.category_id,
            publishedAt: item.isoDate ?? null
          }))
      } catch (error) {
        errors.push(`${source.name}: ${(error as Error).message}`)
        return []
      }
    })
  )

  const seen = new Set<string>()
  const articles = results.flat().filter((article) => {
    if (seen.has(article.link)) return false
    seen.add(article.link)
    return true
  })

  articles.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  return { articles, errors }
}

export function markArticleRead(url: string): void {
  news.markRead(url)
}
