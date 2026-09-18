import assert from 'node:assert/strict'
import test from 'node:test'
import { findMatchesForPreferences, type MatchFirm, type MatchPreferences } from './preference-matches'
import type { ComparisonPlan } from './comparison-engine'

const plan = (id: string, size = 100_000, price: number | null = 100, days: number | null = 5): ComparisonPlan => ({
  id, challengeId: `challenge-${id}`, challengeName: '2-Step', challengeType: 'evaluation', variantName: null,
  size, price, currency: 'USD', steps: 2, phases: [], split: 80, rewardName: 'Standard',
  payoutFrequency: null, payoutDays: days, rewardNames: ['Standard'],
})
const firm = (slug: string, plans = [plan(slug)], markets = ['cfd']): MatchFirm => ({
  id: slug, slug, name: slug, logoUrl: null, markets, tradingPlatforms: ['MT5'],
  rules: { ea: null, news: true, weekend: null }, plans,
})
const preferences: MatchPreferences = { market: 'cfd', size: 100_000, budget: 150, platform: 'MT5', priorities: ['payout', 'platform'], styles: [] }

test('mercado y presupuesto son requisitos; tamaño exacto precede al cercano', () => {
  const results = findMatchesForPreferences([
    firm('wrong-market', [plan('w')], ['futures']),
    firm('over-budget', [plan('o', 100_000, 500)]),
    firm('near-size', [plan('n', 50_000)]),
    firm('exact', [plan('e')]),
  ], preferences).results
  assert.deepEqual(results.map((item) => item.firm.slug), ['exact', 'near-size', 'over-budget', 'wrong-market'])
  assert.match(results[1].cautions.join(' '), /50,000/)
  assert.match(results[2].cautions.join(' '), /supera/)
})

test('selecciona programa/variante/plan, no solo firma', () => {
  const slow = plan('slow', 100_000, 100, 21)
  const fast = { ...plan('fast', 100_000, 120, 5), variantName: 'Flex' }
  const result = findMatchesForPreferences([firm('a', [slow, fast])], preferences).results[0]
  assert.equal(result.plan.id, 'fast')
  assert.equal(result.plan.variantName, 'Flex')
})

test('faltantes no cuentan como fallos ni en el denominador evaluable', () => {
  const unknown = firm('unknown', [plan('u', 100_000, null, null)])
  unknown.tradingPlatforms = []
  const result = findMatchesForPreferences([unknown], { ...preferences, priorities: ['payout', 'platform', 'drawdown'], styles: ['ea'] }).results[0]
  assert.equal(result.matched, 0)
  assert.equal(result.evaluable, 0)
  assert.match(result.cautions.join(' '), /Sin dato|sin dato/)
})

test('payout rápido usa días del reward option, no evidencia externa', () => {
  const slow = { ...firm('slow', [plan('s', 100_000, 100, 21)]), evidence: { count: 100_000 } }
  const fast = firm('fast', [plan('f', 100_000, 100, 5)])
  const result = findMatchesForPreferences([slow, fast], preferences)
  assert.equal(result.results[0].firm.slug, 'fast')
  assert.equal(result.results[0].matched, 2)
})

test('precio y split se comparan solo con pares conocidos; oferta y afiliado no influyen', () => {
  const low = firm('low', [plan('l', 100_000, 100)])
  const high = { ...firm('high', [plan('h', 100_000, 200)]), offer: '90% de descuento', affiliate: '/go/high' }
  const result = findMatchesForPreferences([high, low], { ...preferences, budget: null, priorities: ['price', 'split'] })
  assert.equal(result.results[0].firm.slug, 'low')
  assert.equal(result.results[0].matched, 2)
})

test('empates deterministas, tres resultados iniciales y fallback sin coincidencia exacta', () => {
  const firms = ['z', 'a', 'c', 'b'].map((slug) => firm(slug, [plan(slug, 50_000, 200)]))
  const result = findMatchesForPreferences(firms, preferences, 3)
  assert.equal(result.hasExactRequirements, false)
  assert.deepEqual(result.results.map((item) => item.firm.slug), ['a', 'b', 'c'])
  assert.deepEqual(findMatchesForPreferences([...firms].reverse(), preferences, 3).results.map((item) => item.firm.slug), ['a', 'b', 'c'])
})

test('plataforma y reglas estructuradas alteran coincidencias; null no es false', () => {
  const yes = firm('yes')
  yes.rules.ea = true
  const unknown = firm('unknown')
  const no = firm('no')
  no.rules.ea = false
  const result = findMatchesForPreferences([unknown, no, yes], { ...preferences, priorities: ['platform'], styles: ['ea'] })
  assert.equal(result.results[0].firm.slug, 'yes')
  assert.equal(result.results.find((item) => item.firm.slug === 'unknown')?.evaluable, 1)
  assert.equal(result.results.find((item) => item.firm.slug === 'no')?.evaluable, 2)
})
