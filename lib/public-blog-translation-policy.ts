import { isPublishableTranslationState, type TranslationFieldState, type TranslationLanguage } from './public-platform-translation-policy'

export const BLOG_TRANSLATION_FIELDS = ['title', 'excerpt', 'body_markdown', 'category', 'tags'] as const
export type BlogTranslationField = (typeof BLOG_TRANSLATION_FIELDS)[number]
export type BlogSource = { id: string; title: string; excerpt: string | null; bodyMarkdown: string; category: string | null; tags: string[] }
export type BlogTranslationRow = { blog_post_id: string; language: string; title: string | null; excerpt: string | null; body_markdown: string | null; category: string | null; tags: unknown }
export type ResolvedBlogTranslation = { title?: string; excerpt?: string; bodyMarkdown?: string; category?: string; tags?: string[] }

export function resolveBlogTranslations(input: { posts: BlogSource[]; requestedLanguage: string; defaultLanguage: string; languages: TranslationLanguage[]; translations: BlogTranslationRow[]; states: TranslationFieldState[] }) {
  const published = new Set(input.languages.filter((item) => item.is_active && item.publication_status === 'published').map((item) => item.code))
  const language = published.has(input.requestedLanguage) ? input.requestedLanguage : input.defaultLanguage
  const result = new Map<string, ResolvedBlogTranslation>()
  if (language === input.defaultLanguage) return result
  const rows = new Map(input.translations.map((row) => [`${row.blog_post_id}:${row.language}`, row]))
  const states = new Map(input.states.map((state) => [`${state.resource_id}:${state.target_language}:${state.field_name}`, state]))
  for (const post of input.posts) {
    const row = rows.get(`${post.id}:${language}`)
    if (!row) continue
    const resolved: ResolvedBlogTranslation = {}
    for (const field of BLOG_TRANSLATION_FIELDS) {
      if (!isPublishableTranslationState(states.get(`${post.id}:${language}:${field}`))) continue
      const value = row[field]
      if (field === 'tags') {
        if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim())) resolved.tags = value as string[]
      } else if (typeof value === 'string' && value.trim()) {
        const normalized = field === 'body_markdown' ? value : value.trim()
        if (field === 'title') resolved.title = normalized
        else if (field === 'excerpt') resolved.excerpt = normalized
        else if (field === 'body_markdown') resolved.bodyMarkdown = normalized
        else resolved.category = normalized
      }
    }
    result.set(post.id, resolved)
  }
  return result
}
