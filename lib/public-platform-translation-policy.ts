export const PLATFORM_TRANSLATION_FIELDS = ['short_description', 'description', 'pros', 'cons', 'seo_title', 'seo_description'] as const
export type PlatformTranslationField = (typeof PLATFORM_TRANSLATION_FIELDS)[number]
export type PlatformTranslation = { shortDescription: string | null; description: string | null; pros: string[]; cons: string[]; seoTitle: string | null; seoDescription: string | null }
export type PlatformTranslationRow = { platform_id: string; language: string; short_description: string | null; description: string | null; pros: unknown; cons: unknown; seo_title: string | null; seo_description: string | null }
export type TranslationFieldState = { resource_type?: string; resource_id: string; field_name: string; target_language: string; source_hash: string; translated_source_hash: string | null; source_revision: number; translated_revision: number | null; status: string; is_protected: boolean }
export type TranslationLanguage = { code: string; is_active: boolean; is_default: boolean; publication_status: string }

const EMPTY_TRANSLATION: PlatformTranslation = { shortDescription: null, description: null, pros: [], cons: [], seoTitle: null, seoDescription: null }

export function resolvePlatformTranslations({ platformIds, requestedLanguage, defaultLanguage, languages, translations, states }: { platformIds: string[]; requestedLanguage: string; defaultLanguage: string; languages: TranslationLanguage[]; translations: PlatformTranslationRow[]; states: TranslationFieldState[] }) {
  const publishedLanguages = new Set(languages.filter((item) => item.is_active && item.publication_status === 'published').map((item) => item.code))
  const requested = publishedLanguages.has(requestedLanguage) ? requestedLanguage : defaultLanguage
  const languageOrder = [...new Set([requested, defaultLanguage, 'es'])]
  const rows = new Map(translations.map((row) => [`${row.platform_id}:${row.language}`, row]))
  const stateMap = new Map(states.map((state) => [`${state.resource_id}:${state.target_language}:${state.field_name}`, state]))
  const result = new Map<string, PlatformTranslation>()
  for (const platformId of platformIds) {
    const resolved = { ...EMPTY_TRANSLATION, pros: [], cons: [] }
    for (const field of PLATFORM_TRANSLATION_FIELDS) {
      for (const language of languageOrder) {
        const value = rows.get(`${platformId}:${language}`)?.[field]
        if (!hasTranslationValue(field, value)) continue
        if (language !== defaultLanguage && !isPublishableTranslationState(stateMap.get(`${platformId}:${language}:${field}`))) continue
        assignField(resolved, field, value)
        break
      }
    }
    result.set(platformId, resolved)
  }
  return result
}

export function isPublishableTranslationState(state: TranslationFieldState | undefined) {
  if (!state) return false
  const statusAllowed = state.status === 'reviewed' || state.status === 'machine_translated' || (state.status === 'imported_unreviewed' && state.is_protected)
  return statusAllowed && state.translated_source_hash === state.source_hash && state.translated_revision === state.source_revision
}

function hasTranslationValue(field: PlatformTranslationField, value: unknown) {
  if (field === 'pros' || field === 'cons') return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim())
  return typeof value === 'string' && Boolean(value.trim())
}

function assignField(target: PlatformTranslation, field: PlatformTranslationField, value: unknown) {
  if (field === 'pros' || field === 'cons') { target[field] = (value as string[]).map((item) => item.trim()); return }
  const normalized = (value as string).trim()
  if (field === 'short_description') target.shortDescription = normalized
  else if (field === 'seo_title') target.seoTitle = normalized
  else if (field === 'seo_description') target.seoDescription = normalized
  else target.description = normalized
}
