import assert from 'node:assert/strict'
import test from 'node:test'
import type { AccountPlan, ChallengePhase, ChallengeRewardOption, ChallengeVariant, ChallengeVariantPhase } from './challenge-resolver'
import { resolveChallengeTranslations, type ChallengeTranslationRow } from './public-challenge-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const languages = [
  { code: 'es', is_active: true, is_default: true, publication_status: 'published' },
  { code: 'en', is_active: true, is_default: false, publication_status: 'published' },
  { code: 'pt', is_active: true, is_default: false, publication_status: 'published' },
]
const phases = [{ id: 'phase-1', challenge_id: 'challenge-1', phase_number: 1, name: 'Evaluación', notes: 'Sin límite', profit_target: 10, daily_drawdown: 5, max_drawdown: 10, min_trading_days: 4, max_trading_days: null, min_profitable_days: null, drawdown_type: 'static', drawdown_basis: 'balance' }] satisfies ChallengePhase[]
const variants = [{ id: 'variant-1', challenge_id: 'challenge-1', name: 'Swing', slug: 'swing', profit_split: 80, price_modifier: 0, payout_frequency: 'Cada 14 días', notes: 'Texto ES', status: true }] satisfies ChallengeVariant[]
const variantPhases = [{ id: 'override-1', variant_id: 'variant-1', phase_number: 1, profit_target: 8, daily_drawdown: null, max_drawdown: null, min_trading_days: null, min_profitable_days: null, drawdown_type: null, drawdown_basis: null, notes: 'Override ES' }] satisfies ChallengeVariantPhase[]
const plans = [{ id: 'plan-1', challenge_id: 'challenge-1', variant_id: 'variant-1', account_size: 100000, price: 500, currency: 'USD', profit_target: 10, daily_drawdown: 5, max_drawdown: 10, profit_split: 80, min_trading_days: 4, max_trading_days: null, payout_frequency: 'Cada 14 días' }] satisfies AccountPlan[]
const rewards = [{ id: 'reward-1', challenge_id: 'challenge-1', variant_id: null, name: 'Recompensa estándar', profit_split: 80, payout_frequency: 'Cada 14 días', minimum_payout_days: 14, minimum_profitable_days: null, profitable_day_threshold_pct: null, consistency_rule_pct: null, notes: 'Notas ES', status: true, sort_order: 0, source_url: null, effective_from: null, effective_to: null }] satisfies ChallengeRewardOption[]
const translations: ChallengeTranslationRow[] = [
  { resource_type: 'challenge_phase_translation', resource_id: 'phase-1', language: 'en', name: 'Evaluation', notes: 'Unlimited' },
  { resource_type: 'challenge_variant_translation', resource_id: 'variant-1', language: 'en', payout_frequency: 'Every 14 days', notes: 'EN text' },
  { resource_type: 'challenge_variant_phase_translation', resource_id: 'override-1', language: 'en', notes: 'Override EN' },
  { resource_type: 'account_plan_translation', resource_id: 'plan-1', language: 'en', payout_frequency: 'Every 14 days' },
  { resource_type: 'challenge_reward_translation', resource_id: 'reward-1', language: 'en', name: 'Standard reward', payout_frequency: 'Every 14 days', notes: 'EN notes' },
]
const state = (resourceType: string, resourceId: string, field: string, overrides: Partial<TranslationFieldState> = {}): TranslationFieldState => ({ resource_type: resourceType, resource_id: resourceId, field_name: field, target_language: 'en', source_hash: 'current', translated_source_hash: 'current', source_revision: 2, translated_revision: 2, status: 'reviewed', is_protected: true, ...overrides })
const allStates = translations.flatMap((translation) => Object.keys(translation).filter((field) => !['resource_type', 'resource_id', 'language'].includes(field)).map((field) => state(translation.resource_type, translation.resource_id, field)))

test('localiza solo los campos editoriales y preserva todos los datos técnicos', () => {
  const result = resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: allStates })
  assert.equal(result.phases[0].name, 'Evaluation')
  assert.equal(result.rewards[0].name, 'Standard reward')
  assert.equal(result.plans[0].payout_frequency, 'Every 14 days')
  assert.equal(result.plans[0].price, 500)
  assert.equal(result.plans[0].profit_target, 10)
  assert.equal(result.variants[0].name, 'Swing')
  assert.equal(result.rewards[0].profit_split, 80)
})

test('hace fallback por campo para stale, faltantes e idiomas no publicados', () => {
  const staleStates = allStates.map((item) => item.resource_id === 'reward-1' && item.field_name === 'name' ? { ...item, status: 'stale' } : item)
  const stale = resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: staleStates })
  assert.equal(stale.rewards[0].name, 'Recompensa estándar')
  assert.equal(stale.rewards[0].payout_frequency, 'Every 14 days')
  const unpublished = resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages: languages.map((item) => item.code === 'en' ? { ...item, publication_status: 'review' } : item), translations, states: allStates })
  assert.equal(unpublished.phases[0].name, 'Evaluación')
})

test('acepta importadas protegidas y rechaza revisiones o hashes antiguos', () => {
  const imported = allStates.map((item) => item.resource_id === 'phase-1' && item.field_name === 'name' ? { ...item, status: 'imported_unreviewed', is_protected: true } : item)
  assert.equal(resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: imported }).phases[0].name, 'Evaluation')
  const old = imported.map((item) => item.resource_id === 'phase-1' && item.field_name === 'name' ? { ...item, translated_revision: 1 } : item)
  assert.equal(resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: old }).phases[0].name, 'Evaluación')
})

test('excluye draft, machine_translated y unpublished', () => {
  for (const status of ['draft', 'machine_translated']) {
    const blocked = allStates.map((item) => item.resource_id === 'reward-1' && item.field_name === 'name' ? { ...item, status } : item)
    assert.equal(resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: blocked }).rewards[0].name, 'Recompensa estándar')
  }
  const unpublished = allStates.map((item) => item.resource_id === 'reward-1' && item.field_name === 'name' ? { ...item, publication_status: 'unpublished' } : item)
  assert.equal(resolveChallengeTranslations({ phases, variants, variantPhases, plans, rewards, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: unpublished }).rewards[0].name, 'Recompensa estándar')
})
