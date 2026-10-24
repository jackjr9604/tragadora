import 'server-only'

import { updateTag } from 'next/cache'
import type { TranslationResourceType } from './admin-translation-inventory-policy'
import { PUBLIC_COMMUNITIES_SOURCE_CACHE_TAG, PUBLIC_GIVEAWAYS_SOURCE_CACHE_TAG } from './public-discovery-cache'
import { publicTranslationLanguageTag, publicTranslationResourceTag } from './public-translation-cache-policy'

export type PublicTranslationResourceType =
  | 'blog_post_translation'
  | 'tool_translation'
  | 'community_translation'
  | 'giveaway_translation'

export function invalidatePublicTranslations(resourceType: PublicTranslationResourceType, language?: string) {
  updateTag(language
    ? publicTranslationLanguageTag(resourceType as TranslationResourceType, language)
    : publicTranslationResourceTag(resourceType as TranslationResourceType))
}

export function invalidatePublicSource(resourceType: PublicTranslationResourceType) {
  // Translation state changes first so a stale translation cannot survive if a
  // later source-cache invalidation unexpectedly fails after the SQL commit.
  invalidatePublicTranslations(resourceType)
  if (resourceType === 'community_translation') updateTag(PUBLIC_COMMUNITIES_SOURCE_CACHE_TAG)
  if (resourceType === 'giveaway_translation') updateTag(PUBLIC_GIVEAWAYS_SOURCE_CACHE_TAG)
  if (resourceType === 'tool_translation') updateTag('public-platform-search')
}

export function invalidateAllPublicTranslationResources() {
  for (const resourceType of ['blog_post_translation', 'tool_translation', 'community_translation', 'giveaway_translation'] as const) {
    invalidatePublicTranslations(resourceType)
  }
}
