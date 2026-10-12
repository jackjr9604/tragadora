import { isPublishableTranslationState, type TranslationFieldState, type TranslationLanguage } from './public-platform-translation-policy'

export const TOOL_TRANSLATION_FIELDS = ['name', 'short_description', 'category_label', 'badge', 'price_label', 'availability', 'promo_label', 'seo_title', 'seo_description'] as const
export type ToolTranslationField = (typeof TOOL_TRANSLATION_FIELDS)[number]

export type ToolTranslationRow = { tool_id: string; language: string } & Partial<Record<ToolTranslationField, string | null>>
export type ToolSource = { id: string; name: string; short_description: string | null; category: string | null; badge: string | null; price_label: string | null; availability: string | null; promo_label: string | null; tool_type: string; is_ours: boolean }
export type ResolvedToolTranslation = Partial<Pick<ToolSource, 'name' | 'short_description' | 'badge' | 'price_label' | 'availability' | 'promo_label'>> & { category_label?: string | null; seo_title?: string | null; seo_description?: string | null }

export function resolveToolTranslations(input: { tools: ToolSource[]; requestedLanguage: string; defaultLanguage: string; languages: TranslationLanguage[]; translations: ToolTranslationRow[]; states: TranslationFieldState[] }) {
  const published = new Set(input.languages.filter((item) => item.is_active && item.publication_status === 'published').map((item) => item.code))
  const language = published.has(input.requestedLanguage) ? input.requestedLanguage : input.defaultLanguage
  const rows = new Map(input.translations.map((row) => [`${row.tool_id}:${row.language}`, row]))
  const states = new Map(input.states.map((state) => [`${state.resource_id}:${state.target_language}:${state.field_name}`, state]))
  const resolved = new Map<string, ResolvedToolTranslation>()
  if (language === input.defaultLanguage) return resolved

  for (const tool of input.tools) {
    const row = rows.get(`${tool.id}:${language}`)
    if (!row) continue
    const value: ResolvedToolTranslation = {}
    for (const field of TOOL_TRANSLATION_FIELDS) {
      if (field === 'name' && tool.tool_type !== 'internal' && !tool.is_ours) continue
      const translated = row[field]
      const state = states.get(`${tool.id}:${language}:${field}`)
      if (typeof translated !== 'string' || !translated.trim() || !isPublishableTranslationState(state)) continue
      Object.assign(value, { [field]: translated.trim() })
    }
    resolved.set(tool.id, value)
  }
  return resolved
}
