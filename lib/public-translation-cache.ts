import 'server-only'

import { unstable_cache } from 'next/cache'
import {
  createPublicTranslationRowsLoader,
  type PublicTranslationCacheFactory,
  type PublicTranslationStateRow,
} from './public-translation-cache-policy'

export {
  PUBLIC_TRANSLATION_CACHE_TAG,
  PUBLIC_TRANSLATION_CACHE_TTL_SECONDS,
  normalizePublicTranslationCacheScope,
  publicTranslationCacheKey,
  publicTranslationCacheTags,
  publicTranslationLanguageTag,
  publicTranslationResourceTag,
  type NormalizedPublicTranslationCacheScope,
  type PublicTranslationCacheScope,
  type PublicTranslationRows,
  type PublicTranslationStateRow,
} from './public-translation-cache-policy'

const nextCacheFactory: PublicTranslationCacheFactory = (loader, keyParts, options) =>
  unstable_cache(loader, keyParts, options)

export function createPublicTranslationCache<TranslationRow>(input: {
  loadTranslations: Parameters<typeof createPublicTranslationRowsLoader<TranslationRow>>[0]['loadTranslations']
  loadStates: (scope: Parameters<Parameters<typeof createPublicTranslationRowsLoader<TranslationRow>>[0]['loadStates']>[0]) => Promise<readonly PublicTranslationStateRow[]>
}) {
  return createPublicTranslationRowsLoader({
    cacheFactory: nextCacheFactory,
    loadTranslations: input.loadTranslations,
    loadStates: input.loadStates,
  })
}
