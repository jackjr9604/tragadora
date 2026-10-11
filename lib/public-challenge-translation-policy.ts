import type {
  AccountPlan,
  ChallengePhase,
  ChallengeRewardOption,
  ChallengeVariant,
  ChallengeVariantPhase,
} from './challenge-resolver'
import {
  isPublishableTranslationState,
  type TranslationFieldState,
  type TranslationLanguage,
} from './public-platform-translation-policy'

export const CHALLENGE_TRANSLATION_RESOURCES = {
  challenge_phase_translation: ['name', 'notes'],
  challenge_variant_translation: ['payout_frequency', 'notes'],
  challenge_variant_phase_translation: ['notes'],
  account_plan_translation: ['payout_frequency'],
  challenge_reward_translation: ['name', 'payout_frequency', 'notes'],
} as const

export type ChallengeTranslationResource = keyof typeof CHALLENGE_TRANSLATION_RESOURCES

export type ChallengeTranslationRow = {
  resource_type: ChallengeTranslationResource
  resource_id: string
  language: string
  name?: string | null
  payout_frequency?: string | null
  notes?: string | null
}

export type ChallengeTranslationCollections = {
  phases: ChallengePhase[]
  variants: ChallengeVariant[]
  variantPhases: ChallengeVariantPhase[]
  plans: AccountPlan[]
  rewards: ChallengeRewardOption[]
}

export function resolveChallengeTranslations(input: ChallengeTranslationCollections & {
  requestedLanguage: string
  defaultLanguage: string
  languages: TranslationLanguage[]
  translations: ChallengeTranslationRow[]
  states: TranslationFieldState[]
}): ChallengeTranslationCollections {
  const published = new Set(input.languages
    .filter((language) => language.is_active && language.publication_status === 'published')
    .map((language) => language.code))
  const language = published.has(input.requestedLanguage) ? input.requestedLanguage : input.defaultLanguage
  if (language === input.defaultLanguage) return copyCollections(input)

  const translations = new Map(input.translations.map((row) => [
    `${row.resource_type}:${row.resource_id}:${row.language}`,
    row,
  ]))
  const states = new Map(input.states.map((state) => [
    `${state.resource_type ?? ''}:${state.resource_id}:${state.target_language}:${state.field_name}`,
    state,
  ]))

  const translated = <T extends object>(resourceType: ChallengeTranslationResource, row: T & { id: string }) => {
    const translation = translations.get(`${resourceType}:${row.id}:${language}`)
    if (!translation) return { ...row }
    const result = { ...row } as T & { id: string }
    for (const field of CHALLENGE_TRANSLATION_RESOURCES[resourceType]) {
      const value = translation[field]
      const state = states.get(`${resourceType}:${row.id}:${language}:${field}`)
      if (typeof value === 'string' && value.trim() && isPublishableTranslationState(state)) {
        Object.assign(result, { [field]: value.trim() })
      }
    }
    return result
  }

  return {
    phases: input.phases.map((row) => translated('challenge_phase_translation', row)),
    variants: input.variants.map((row) => translated('challenge_variant_translation', row)),
    variantPhases: input.variantPhases.map((row) => translated('challenge_variant_phase_translation', row)),
    plans: input.plans.map((row) => translated('account_plan_translation', row)),
    rewards: input.rewards.map((row) => translated('challenge_reward_translation', row)),
  }
}

function copyCollections(input: ChallengeTranslationCollections): ChallengeTranslationCollections {
  return {
    phases: input.phases.map((row) => ({ ...row })),
    variants: input.variants.map((row) => ({ ...row })),
    variantPhases: input.variantPhases.map((row) => ({ ...row })),
    plans: input.plans.map((row) => ({ ...row })),
    rewards: input.rewards.map((row) => ({ ...row })),
  }
}
