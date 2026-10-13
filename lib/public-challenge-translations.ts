import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  CHALLENGE_TRANSLATION_RESOURCES,
  resolveChallengeTranslations,
  type ChallengeTranslationCollections,
  type ChallengeTranslationResource,
  type ChallengeTranslationRow,
} from './public-challenge-translation-policy'
import type { TranslationFieldState, TranslationLanguage } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'

const TABLES: Record<ChallengeTranslationResource, { table: string; id: string }> = {
  challenge_phase_translation: { table: 'challenge_phase_translations', id: 'phase_id' },
  challenge_variant_translation: { table: 'challenge_variant_translations', id: 'variant_id' },
  challenge_variant_phase_translation: { table: 'challenge_variant_phase_translations', id: 'variant_phase_id' },
  account_plan_translation: { table: 'account_plan_translations', id: 'account_plan_id' },
  challenge_reward_translation: { table: 'challenge_reward_translations', id: 'reward_option_id' },
}

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

  const db = createAdminClient()
  const languagesResult = await db.from('languages')
    .select('code, is_active, is_default, publication_status')
    .eq('is_active', true)
  // Compatibilidad previa a la migración 3C: cualquier tabla o columna ausente
  // conserva exactamente los datos fuente actuales.
  if (languagesResult.error) return collections
  const languages = (languagesResult.data ?? []) as TranslationLanguage[]
  const defaultLanguage = languages.find((item) => item.is_default)?.code ?? 'es'
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage && item.is_active && item.publication_status === 'published')?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return collections

  const translationQueries = (Object.keys(TABLES) as ChallengeTranslationResource[]).map(async (resourceType) => {
    const ids = resourceIds[resourceType]
    if (!ids.length) return [] as ChallengeTranslationRow[]
    const config = TABLES[resourceType]
    const fields = CHALLENGE_TRANSLATION_RESOURCES[resourceType].join(', ')
    const result = await db.from(config.table).select(`${config.id}, language, ${fields}`).in(config.id, ids).eq('language', effectiveLanguage)
    if (result.error) throw result.error
    const rows = (result.data ?? []) as unknown as Array<Record<string, unknown>>
    return rows.map((row) => ({
      ...row,
      resource_type: resourceType,
      resource_id: String(row[config.id]),
    })) as ChallengeTranslationRow[]
  })

  try {
    const [translationGroups, statesResult] = await Promise.all([
      Promise.all(translationQueries),
      getPublicTranslationStates({ resourceTypes: Object.keys(CHALLENGE_TRANSLATION_RESOURCES), resourceIds: allIds, targetLanguages: [effectiveLanguage] }),
    ])
    if (statesResult.error) return collections
    return resolveChallengeTranslations({
      ...collections,
      requestedLanguage,
      defaultLanguage,
      languages,
      translations: translationGroups.flat(),
      states: (statesResult.data ?? []) as TranslationFieldState[],
    })
  } catch {
    return collections
  }
}
