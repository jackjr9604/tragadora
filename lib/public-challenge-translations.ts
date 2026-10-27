import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  CHALLENGE_TRANSLATION_RESOURCES,
  resolveChallengeTranslations,
  type ChallengeTranslationCollections,
  type ChallengeTranslationResource,
  type ChallengeTranslationRow,
} from './public-challenge-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { createPublicTranslationCache } from './public-translation-cache'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

const TABLES: Record<ChallengeTranslationResource, { table: string; id: string }> = {
  challenge_phase_translation: { table: 'challenge_phase_translations', id: 'phase_id' },
  challenge_variant_translation: { table: 'challenge_variant_translations', id: 'variant_id' },
  challenge_variant_phase_translation: { table: 'challenge_variant_phase_translations', id: 'variant_phase_id' },
  account_plan_translation: { table: 'account_plan_translations', id: 'account_plan_id' },
  challenge_reward_translation: { table: 'challenge_reward_translations', id: 'reward_option_id' },
}

const CACHED_ROWS = Object.fromEntries((Object.keys(TABLES) as ChallengeTranslationResource[]).map((resourceType) => {
  const config = TABLES[resourceType]
  const fields = CHALLENGE_TRANSLATION_RESOURCES[resourceType].join(', ')
  return [resourceType, createPublicTranslationCache<ChallengeTranslationRow>({
    async loadTranslations(scope) {
      const result = await createAdminClient().from(config.table)
        .select(`${config.id}, language, ${fields}`)
        .in(config.id, scope.resourceIds)
        .eq('language', scope.effectiveLanguage)
      if (result.error) throw result.error
      return ((result.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
        ...row, resource_type: resourceType, resource_id: String(row[config.id]),
      })) as ChallengeTranslationRow[]
    },
    async loadStates(scope) {
      const result = await getPublicTranslationStates({ resourceTypes: [resourceType], resourceIds: [...scope.resourceIds], targetLanguages: [scope.effectiveLanguage] })
      if (result.error) throw result.error
      return (result.data ?? []).map((state) => ({ ...state, resource_type: state.resource_type ?? resourceType }))
    },
  })]
})) as Record<ChallengeTranslationResource, ReturnType<typeof createPublicTranslationCache<ChallengeTranslationRow>>>

export async function getPublicChallengeTranslations(
  collections: ChallengeTranslationCollections,
  requestedLanguage: string
): Promise<ChallengeTranslationCollections> {
  const resourceIds: Record<ChallengeTranslationResource, string[]> = {
    challenge_phase_translation: collections.phases.map((row) => row.id),
    challenge_variant_translation: collections.variants.map((row) => row.id),
    challenge_variant_phase_translation: collections.variantPhases.map((row) => row.id),
    account_plan_translation: collections.plans.map((row) => row.id),
    challenge_reward_translation: collections.rewards.map((row) => row.id),
  }
  const allIds = Object.values(resourceIds).flat()
  if (!allIds.length) return collections

  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage)?.code ?? defaultLanguage
  try {
    const groups = await Promise.all((Object.keys(TABLES) as ChallengeTranslationResource[]).map((resourceType) => CACHED_ROWS[resourceType]({
      resourceType,
      resourceIds: resourceIds[resourceType],
      effectiveLanguage,
      defaultLanguage,
    })))
    return resolveChallengeTranslations({
      ...collections,
      requestedLanguage,
      defaultLanguage,
      languages,
      translations: groups.flatMap((group) => [...group.translations]),
      states: groups.flatMap((group) => [...group.states]) as TranslationFieldState[],
    })
  } catch {
    return collections
  }
}
