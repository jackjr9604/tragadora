import assert from 'node:assert/strict'
import test from 'node:test'
import { payoutSpeedOption, recommendPropFirms, type RecommendableFirm, type RecommendationCriteria } from './prop-firm-recommender'

test('clasifica payout rápido sin convertir ausencia en lento', () => {
  assert.equal(payoutSpeedOption(null, null, null), null)
  assert.equal(payoutSpeedOption('Daily', null, 'Select Daily')?.speed, 'very_fast')
  assert.equal(payoutSpeedOption('Every 7 days', null, null)?.speed, 'fast')
  assert.equal(payoutSpeedOption('Bi-Weekly', null, null)?.speed, 'normal')
  assert.equal(payoutSpeedOption('Monthly', 30, null)?.speed, 'slow')
})

test('explica challenge y reward de la mejor opción real', () => {
  const criteria: RecommendationCriteria = {
    country: '', market: 'futures', experience: '', budget: null, accountSize: null,
    evaluation: 'any', priority: 'payouts', styles: [], payoutPreference: 'fast',
  }
  const result = recommendPropFirms(criteria, [firm({
    markets: ['futures'],
    plans: [{ price: 100, accountSize: 50_000, profitSplit: 90, maxDrawdown: 5, challengeType: '2step', challengeName: 'Select Evaluation', payoutOption: payoutSpeedOption('Daily', 1, 'Select Daily') }],
  })])[0]
  assert.equal(result.matchedPreferences, 2)
  assert.match(result.positives.join(' '), /Select Daily · Select Evaluation/)
})

test('los booleanos null se reportan como desconocidos, no como restricciones', () => {
  const criteria: RecommendationCriteria = {
    country: '', market: '', experience: '', budget: null, accountSize: null,
    evaluation: 'any', priority: 'rules', styles: ['ea', 'weekend'], payoutPreference: 'any',
  }
  const result = recommendPropFirms(criteria, [firm({ supportsEa: null, allowsWeekend: null })])[0]
  assert.equal(result.negatives.length, 0)
  assert.equal(result.unavailable.length, 2)
})

function firm(values: Partial<RecommendableFirm>): RecommendableFirm {
  return {
    id: 'firm', name: 'Firma', slug: 'firma', score: null, logoUrl: null, logoAlt: null,
    profitSplit: null, supportsEa: null, allowsNews: null, allowsWeekend: null,
    allowsScalping: null, allowsDayTrading: null, allowsCopyTrading: null, markets: [],
    verification: 'none', verificationLabel: 'Sin verificación', availableCountryCodes: [],
    restrictedCountryCodes: [], availabilityKnown: false, hasAffiliateLink: false, plans: [],
    activeOffer: null, ...values,
  }
}
