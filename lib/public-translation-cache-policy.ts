import type { TranslationResourceType } from './admin-translation-inventory-policy'

export const PUBLIC_TRANSLATION_CACHE_TTL_SECONDS = 60
export const PUBLIC_TRANSLATION_CACHE_TAG = 'public-translations'
export const PUBLIC_TRANSLATION_CACHE_VERSION = 'public-translation-rows-v1'

export type PublicTranslationCacheScope = {
  resourceType: TranslationResourceType
  resourceIds: string[]
  effectiveLanguage: string
  defaultLanguage?: string
}

export type NormalizedPublicTranslationCacheScope = Readonly<{
  resourceType: TranslationResourceType
  resourceIds: readonly string[]
  effectiveLanguage: string
  defaultLanguage?: string
}>

export type PublicTranslationStateRow = {
  resource_type: string
  resource_id: string
  field_name: string
  target_language: string
  source_hash: string
  translated_source_hash: string | null
  source_revision: number
  translated_revision: number | null
  status: string
  is_protected: boolean
  publication_status?: string
}

export type PublicTranslationRows<TranslationRow> = Readonly<{
  translations: readonly TranslationRow[]
  states: readonly PublicTranslationStateRow[]
}>

export type PublicTranslationCacheOptions = Readonly<{
  revalidate: number
  tags: string[]
}>

export type PublicTranslationCacheFactory = <Value>(
  loader: () => Promise<Value>,
  keyParts: string[],
  options: PublicTranslationCacheOptions
) => () => Promise<Value>

export function normalizePublicTranslationCacheScope(
  scope: PublicTranslationCacheScope
): NormalizedPublicTranslationCacheScope {
  const resourceIds = [...new Set(scope.resourceIds.map((id) => id.trim()).filter(Boolean))].sort()
  const effectiveLanguage = normalizeLanguage(scope.effectiveLanguage)
  const defaultLanguage = scope.defaultLanguage ? normalizeLanguage(scope.defaultLanguage) : undefined

  if (!effectiveLanguage) throw new Error('The effective public translation language is required.')

  return Object.freeze({
    resourceType: scope.resourceType,
    resourceIds: Object.freeze(resourceIds),
    effectiveLanguage,
    ...(defaultLanguage ? { defaultLanguage } : {}),
  })
}

export function publicTranslationCacheKey(scope: NormalizedPublicTranslationCacheScope): string[] {
  return [
    PUBLIC_TRANSLATION_CACHE_VERSION,
    `type:${scope.resourceType}`,
    `language:${scope.effectiveLanguage}`,
    `default:${scope.defaultLanguage ?? '-'}`,
    `ids:${JSON.stringify(scope.resourceIds)}`,
  ]
}

export function publicTranslationCacheTags(scope: NormalizedPublicTranslationCacheScope): string[] {
  return [
    PUBLIC_TRANSLATION_CACHE_TAG,
    `${PUBLIC_TRANSLATION_CACHE_TAG}:${scope.resourceType}`,
    `${PUBLIC_TRANSLATION_CACHE_TAG}:${scope.resourceType}:${scope.effectiveLanguage}`,
  ]
}

export function publicTranslationResourceTag(resourceType: TranslationResourceType) {
  return `${PUBLIC_TRANSLATION_CACHE_TAG}:${resourceType}`
}

export function publicTranslationLanguageTag(resourceType: TranslationResourceType, language: string) {
  return `${publicTranslationResourceTag(resourceType)}:${normalizeLanguage(language)}`
}

export function createPublicTranslationRowsLoader<TranslationRow>(input: {
  cacheFactory: PublicTranslationCacheFactory
  loadTranslations: (scope: NormalizedPublicTranslationCacheScope) => Promise<readonly TranslationRow[]>
  loadStates: (scope: NormalizedPublicTranslationCacheScope) => Promise<readonly PublicTranslationStateRow[]>
}) {
  return async (requestedScope: PublicTranslationCacheScope): Promise<PublicTranslationRows<TranslationRow>> => {
    const scope = normalizePublicTranslationCacheScope(requestedScope)
    if (!scope.resourceIds.length) return { translations: [], states: [] }

    const cached = input.cacheFactory(
      async () => {
        // Errors deliberately escape this scope. Callers may apply a fallback,
        // but a transient database failure must never become a cached empty result.
        const [translations, states] = await Promise.all([
          input.loadTranslations(scope),
          input.loadStates(scope),
        ])
        return { translations, states }
      },
      publicTranslationCacheKey(scope),
      {
        revalidate: PUBLIC_TRANSLATION_CACHE_TTL_SECONDS,
        tags: publicTranslationCacheTags(scope),
      }
    )

    return cached()
  }
}

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase()
}
