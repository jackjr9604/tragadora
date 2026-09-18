import assert from 'node:assert/strict'
import test from 'node:test'
import { buildComparisonInsights, countryAvailability, evaluateComparisonPreferences, findComparablePlans, valuesDiffer, type ComparisonFirm, type ComparisonPlan } from './comparison-engine'

const plan = (id: string, size: number | null, steps: number | null, price: number | null = 100): ComparisonPlan => ({
  id, challengeId: 'challenge', challengeName: '2-Step', challengeType: 'evaluation', variantName: null,
  size, price, currency: 'USD', steps, phases: [], split: null, rewardName: null, payoutFrequency: null, payoutDays: null, rewardNames: [],
})
const firm = (id: string, plans: ComparisonPlan[], markets = ['cfd']): ComparisonFirm => ({
  id, slug: id, name: id, logoUrl: null, countryCode: null, markets, tradingPlatforms: [], instruments: [], payoutMethods: [],
  restrictions: [], rules: { ea: null, news: null, weekend: null, copy: null, scalping: null }, plans, evidence: null, offer: null,
})

test('empareja tamaño y fases; soporta tercera firma', () => {
  const firms = [firm('A', [plan('a', 100_000, 2)]), firm('B', [plan('b1', 50_000, 2), plan('b2', 100_000, 2)]), firm('C', [plan('c', 100_000, 2)])]
  const result = findComparablePlans(firms, 100_000)
  assert.deepEqual(result.plans.map((item) => item?.id), ['a', 'b2', 'c'])
  assert.equal(result.exact, true)
})

test('marca diferencias de fases y de tamaño, no equivalencia ficticia', () => {
  const result = findComparablePlans([firm('A', [plan('a', 100_000, 2)]), firm('B', [plan('b', 50_000, 1)])])
  assert.equal(result.exact, false)
  assert.match(result.notes.join(' '), /fases/)
  assert.match(result.notes.join(' '), /tamaño/)
})

test('preserva null y cero real en detección de diferencias', () => {
  assert.equal(valuesDiffer([null, null]), false)
  assert.equal(valuesDiffer([null, 0]), true)
  assert.equal(valuesDiffer([0, 0]), false)
  assert.equal(valuesDiffer([true, true, true]), false)
  assert.equal(valuesDiffer([10, 10, 8]), true)
  assert.equal(valuesDiffer([null, false]), true)
  assert.equal(valuesDiffer([null, '']), true)
  assert.equal(valuesDiffer([null, 'Sin dato']), true)
})

test('mercados incompatibles conservan planes pero advierten que no son equivalentes', () => {
  const result = findComparablePlans([firm('A', [plan('a', 100_000, 2)]), firm('B', [plan('b', 100_000, 2)], ['futures'])])
  assert.equal(result.plans[1]?.id, 'b')
  assert.equal(result.exact, false)
  assert.match(result.notes.join(' '), /mercados diferentes/)
})

test('empates usan nombre estable y no el orden de llegada', () => {
  const a = plan('a', 100_000, 2, 100)
  const left = plan('z', 100_000, 2, 100)
  const right = plan('b', 100_000, 2, 100)
  const first = findComparablePlans([firm('A', [a]), firm('B', [left, right])])
  const second = findComparablePlans([firm('A', [a]), firm('B', [right, left])])
  assert.equal(first.plans[1]?.id, 'b')
  assert.equal(second.plans[1]?.id, 'b')
})

test('prioridades producen insights trazables; ausencia de payout no se trata como cero', () => {
  const firms = [firm('A', [plan('a', 100_000, 2, 100)]), firm('B', [plan('b', 100_000, 2, 200)])]
  const result = buildComparisonInsights(firms, [firms[0].plans[0], firms[1].plans[0]], ['price', 'payout'], null)
  assert.equal(result.some((item) => item.relatedMetric === 'price' && item.firmIds[0] === 'A'), true)
  assert.equal(result.some((item) => item.relatedMetric === 'payout'), false)
})

test('restricción geográfica explícita no infiere disponibilidad del resto', () => {
  const item = firm('A', [])
  item.restrictions = ['CO']
  assert.equal(countryAvailability(item, 'co'), 'restricted')
  assert.equal(countryAvailability(item, 'US'), 'unknown')
})

test('preferencias: dato ausente no cuenta como false y precio cero real sí es evaluable', () => {
  const firms = [firm('A', [plan('a', 100_000, 2, 0)]), firm('B', [plan('b', 100_000, 2, null)])]
  const criteria = { market: 'cfd', size: 100_000, budget: 0, platform: '', priorities: ['price' as const], styles: ['ea' as const] }
  const first = evaluateComparisonPreferences(firms, [firms[0].plans[0], firms[1].plans[0]], 0, criteria)
  const second = evaluateComparisonPreferences(firms, [firms[0].plans[0], firms[1].plans[0]], 1, criteria)
  assert.equal(first.details.find((item) => item.label === 'Dentro del presupuesto')?.matches, true)
  assert.equal(second.details.find((item) => item.label === 'Dentro del presupuesto')?.matches, null)
  assert.equal(first.details.find((item) => item.label === 'EA / bots')?.matches, null)
  assert.equal(second.evaluable, 2)
})

test('al eliminar la firma central, los UUID de planes restantes siguen emparejados', () => {
  const firms = [firm('A', [plan('a', 100_000, 2)]), firm('B', [plan('b', 100_000, 2)]), firm('C', [plan('c', 100_000, 2)])]
  const selected = ['a', 'b', 'c']
  const result = findComparablePlans([firms[0], firms[2]], null, [selected[0], selected[2]])
  assert.deepEqual(result.plans.map((item) => item?.id), ['a', 'c'])
})

test('precio sin moneda no puede declararse como el más barato', () => {
  const a = plan('a', 100_000, 2, 100)
  const b = plan('b', 100_000, 2, 200)
  b.currency = null
  const firms = [firm('A', [a]), firm('B', [b])]
  const result = buildComparisonInsights(firms, [a, b], ['price'], null)
  assert.equal(result.some((item) => item.relatedMetric === 'price'), false)
})

test('en empate de tamaño y fases se prefiere la misma moneda', () => {
  const anchor = plan('a', 100_000, 2, 100)
  const differentCurrency = plan('b', 100_000, 2, 80)
  differentCurrency.currency = 'EUR'
  const sameCurrency = plan('c', 100_000, 2, 150)
  const result = findComparablePlans([firm('A', [anchor]), firm('B', [differentCurrency, sameCurrency])])
  assert.equal(result.plans[1]?.id, 'c')
})
