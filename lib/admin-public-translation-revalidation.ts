import 'server-only'

import { updateTag } from 'next/cache'
import type { TranslationResourceType } from './admin-translation-inventory-policy'
import { PUBLIC_COMMUNITIES_SOURCE_CACHE_TAG, PUBLIC_GIVEAWAYS_SOURCE_CACHE_TAG } from './public-discovery-cache'
import { PUBLIC_OFFERS_CACHE_TAG } from './public-offers'
import { publicTranslationLanguageTag, publicTranslationResourceTag } from './public-translation-cache-policy'

export type PublicTranslationResourceType =
  | 'blog_post_translation'
  | 'tool_translation'
  | 'community_translation'
  | 'giveaway_translation'
  | 'platform_translation'
  | 'broker_detail_translation'
  | 'exchange_detail_translation'
  | 'offer_translation'
  | 'challenge_phase_translation'
  | 'challenge_variant_translation'
  | 'challenge_variant_phase_translation'
  | 'account_plan_translation'
  | 'challenge_reward_translation'

export function invalidatePublicTranslations(resourceType: PublicTranslationResourceType, language?: string) {
  expireTranslationRows(resourceType, language)
  if (isPlatformResource(resourceType)) invalidatePlatformOuterCaches()
  if (resourceType === 'offer_translation') invalidateOfferOuterCaches()
  if (isChallengeResource(resourceType)) invalidateChallengeOuterCaches()
}

function expireTranslationRows(resourceType: PublicTranslationResourceType, language?: string) {
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
  for (const resourceType of ['blog_post_translation', 'tool_translation', 'community_translation', 'giveaway_translation', 'platform_translation', 'broker_detail_translation', 'exchange_detail_translation', 'offer_translation', 'challenge_phase_translation', 'challenge_variant_translation', 'challenge_variant_phase_translation', 'account_plan_translation', 'challenge_reward_translation'] as const) {
    invalidatePublicTranslations(resourceType)
  }
}

function isChallengeResource(resourceType: PublicTranslationResourceType) {
  return resourceType === 'challenge_phase_translation' || resourceType === 'challenge_variant_translation'
    || resourceType === 'challenge_variant_phase_translation' || resourceType === 'account_plan_translation'
    || resourceType === 'challenge_reward_translation'
}

function invalidateChallengeOuterCaches() {
  updateTag('public-home-data')
  updateTag('public-prop-firms')
  updateTag('public-payouts')
}

function invalidateOfferOuterCaches() {
  updateTag(PUBLIC_OFFERS_CACHE_TAG)
  updateTag('public-home-data')
  updateTag('public-prop-firms')
  updateTag('public-brokers-v1')
  updateTag('public-exchanges-v2')
}

export function invalidatePublicPlatformSource(kind: 'prop_firm' | 'broker' | 'exchange') {
  expireTranslationRows('platform_translation')
  if (kind === 'broker') expireTranslationRows('broker_detail_translation')
  if (kind === 'exchange') expireTranslationRows('exchange_detail_translation')
  invalidatePlatformOuterCaches()
}

function isPlatformResource(resourceType: PublicTranslationResourceType) {
  return resourceType === 'platform_translation' || resourceType === 'broker_detail_translation' || resourceType === 'exchange_detail_translation'
}

function invalidatePlatformOuterCaches() {
  updateTag('public-home-data')
  updateTag('public-brokers-v1')
  updateTag('public-exchanges-v2')
  updateTag('public-prop-firms')
  updateTag('public-platform-search')
}
