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
  id: slug, slug, name: slug, logoUrl: null, markets, availabilityRules: [], tradingPlatforms: ['MT5'],
  rules: { ea: null, news: true, weekend: null }, plans,
})
const preferences: MatchPreferences = { country: '', market: 'cfd', size: 100_000, budget: 150, platform: 'MT5', priorities: ['payout', 'platform'], styles: [] }

test('mercado y presupuesto son requisitos; tamaño exacto precede al cercano', () => {
  const results = findMatchesForPreferences([
    firm('wrong-market', [plan('w')], ['futures']),
    firm('over-budget', [plan('o', 100_000, 500)]),
    firm('near-size', [plan('n', 50_000)]),
    firm('exact', [plan('e')]),
  ], preferences).results
  assert.deepEqual(results.map((item) => item.firm.slug), ['exact', 'near-size'])
  assert.match(results[1].cautions.join(' '), /50,000/)
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
  assert.equal(result.results[0].matched, 3)
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
  const result = findMatchesForPreferences([unknown, no, yes], { ...preferences, priorities: [], styles: ['ea'] })
  assert.equal(result.results[0].firm.slug, 'yes')
  assert.equal(result.results.find((item) => item.firm.slug === 'unknown')?.evaluable, 1)
  assert.equal(result.results.find((item) => item.firm.slug === 'no')?.evaluable, 2)
})

test('precio, payout y split cambian el primer puesto cuando los datos distinguen planes del mismo tier', () => {
  const cheap = firm('cheap', [{ ...plan('c', 100_000, 50, 21), split: 70 }])
  const fast = firm('fast', [{ ...plan('f', 100_000, 120, 2), split: 80 }])
  const split = firm('split', [{ ...plan('s', 100_000, 140, 10), split: 95 }])
  const base = { ...preferences, budget: 500, platform: '' }
  assert.equal(findMatchesForPreferences([split, cheap, fast], { ...base, priorities: ['price'] }).results[0].firm.slug, 'cheap')
  assert.equal(findMatchesForPreferences([split, cheap, fast], { ...base, priorities: ['payout'] }).results[0].firm.slug, 'fast')
  assert.equal(findMatchesForPreferences([split, cheap, fast], { ...base, priorities: ['split'] }).results[0].firm.slug, 'split')
})

test('sin datos de drawdown la prioridad no inventa ganador', () => {
  const firms = [firm('z'), firm('a')]
  const base = { ...preferences, platform: '', priorities: [] }
  const without = findMatchesForPreferences(firms, base).results.map((item) => item.firm.slug)
  const withDrawdown = findMatchesForPreferences(firms, { ...base, priorities: ['drawdown'] }).results
  assert.deepEqual(withDrawdown.map((item) => item.firm.slug), without)
  assert.equal(withDrawdown[0].matched, 0)
  assert.equal(withDrawdown[0].evaluable, 0)
})

test('tamaño exacto conserva su tier; dentro del tier manda la preferencia', () => {
  const exactSlow = firm('exact-slow', [plan('es', 100_000, 100, 21)])
  const exactFast = firm('exact-fast', [plan('ef', 100_000, 120, 2)])
  const nearFast = firm('near-fast', [plan('nf', 75_000, 90, 1)])
  const result = findMatchesForPreferences([nearFast, exactSlow, exactFast], { ...preferences, platform: '', priorities: ['payout'] })
  assert.deepEqual(result.results.map((item) => item.firm.slug), ['exact-fast', 'exact-slow', 'near-fast'])
})

test('sin elegibles muestra alternativas cercanas, nunca las llama exactas', () => {
  const result = findMatchesForPreferences([firm('over', [plan('o', 100_000, 500)]), firm('other-market', [plan('m')], ['futures'])], preferences)
  assert.equal(result.hasExactRequirements, false)
  assert.ok(result.results.length > 0)
  assert.ok(result.results.every((item) => item.requirementMisses > 0))
})

test('restricción geográfica explícita excluye; disponible y sin dato mantienen semánticas distintas', () => {
  const restricted = firm('restricted')
  restricted.availabilityRules.push({ platformId: 'restricted', countryCode: 'CO', market: null, status: 'restricted', restrictionBasis: 'residence' })
  const available = firm('available')
  available.availabilityRules.push({ platformId: 'available', countryCode: 'CO', market: null, status: 'available', restrictionBasis: 'residence' })
  const unknown = firm('unknown')
  const result = findMatchesForPreferences([restricted, unknown, available], { ...preferences, country: 'CO' })
  assert.deepEqual(result.results.map((item) => item.firm.slug), ['available', 'unknown'])
  assert.match(result.results[0].reasons.join(' '), /restricciones publicadas/)
  assert.match(result.results[1].cautions.join(' '), /Sin dato verificado/)
  assert.equal(result.results[1].requirementMisses, 0)
  assert.equal(result.results[1].requirementUnknowns, 0)
})

test('si todas las firmas están restringidas para el país, no aparece una coincidencia falsa', () => {
  const only = firm('only')
  only.availabilityRules.push({ platformId: 'only', countryCode: 'CO', market: null, status: 'restricted', restrictionBasis: 'residence' })
  assert.deepEqual(findMatchesForPreferences([only], { ...preferences, country: 'CO' }).results, [])
})

test('toda restricción oficial aplicable excluye sin exponer el criterio interno', () => {
  for (const basis of ['nationality', 'physical_location', 'unspecified'] as const) {
    const candidate = firm(basis)
    candidate.availabilityRules.push({ platformId: basis, countryCode: 'CO', market: null, status: 'restricted', restrictionBasis: basis })
    const result = findMatchesForPreferences([candidate], { ...preferences, country: 'CO' })
    assert.equal(result.results.length, 0)
    assert.equal(result.excludedByCountryCount, 1)
  }
})
