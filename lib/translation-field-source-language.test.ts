import assert from 'node:assert/strict'
import test from 'node:test'
import { getEffectiveFieldSourceLanguage, isApplicableTranslationTarget } from './translation-source-language'

test('solo payout_frequency de account_plan declara EN como fuente', () => {
  assert.equal(getEffectiveFieldSourceLanguage('account_plan_translation', 'payout_frequency', 'es'), 'en')
  assert.equal(getEffectiveFieldSourceLanguage('challenge_reward_translation', 'payout_frequency', 'es'), 'es')
})

test('excluye el idioma fuente efectivo y conserva ES/PT como destinos', () => {
  assert.equal(isApplicableTranslationTarget('account_plan_translation', 'payout_frequency', 'en', 'es'), false)
  assert.equal(isApplicableTranslationTarget('account_plan_translation', 'payout_frequency', 'es', 'es'), true)
  assert.equal(isApplicableTranslationTarget('account_plan_translation', 'payout_frequency', 'pt', 'es'), true)
})
