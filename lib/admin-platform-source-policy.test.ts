import assert from 'node:assert/strict'
import test from 'node:test'
import { isBrokerSourceInput, isExchangeSourceInput, isPropFirmSourceInput } from './admin-platform-source-policy'

const id = '11111111-1111-4111-8111-111111111111'
const expectedUpdatedAt = '2026-10-24T12:00:00.000Z'
const common = { id, expectedUpdatedAt, name: 'Example', slug: 'example', description: 'Descripción', websiteUrl: 'https://example.com', logoMediaId: null, status: 'active' }

test('valida Prop Firms y rechaza IDs, slugs, relaciones y rangos manipulados', () => {
  const input = { ...common, score: 8.5, originCountryCode: 'CO', ceoName: null, foundedAt: '2020-01-01', brokerProvider: null, inactivityDays: 30, isNew: false, profitSplitMin: 80, profitSplitMax: 90, supportsEa: true, allowsNews: null, allowsWeekend: false, allowsScalping: true, allowsDayTrading: null, allowsCopyTrading: false, timeLimitPolicy: null, consistencyRules: null, specialRules: null, markets: ['cfd'], tradingPlatformIds: [id], instrumentCategoryIds: [], transactionMethods: [{ id, supportsDeposit: true, supportsPayout: false }] }
  assert.equal(isPropFirmSourceInput(input), true)
  assert.equal(isPropFirmSourceInput({ ...input, slug: '../unsafe' }), false)
  assert.equal(isPropFirmSourceInput({ ...input, score: 11 }), false)
  assert.equal(isPropFirmSourceInput({ ...input, tradingPlatformIds: [id, id] }), false)
  assert.equal(isPropFirmSourceInput({ ...input, countryCode: 'CO' }), false)
  assert.equal(isPropFirmSourceInput({ ...input, unexpected: true }), false)
})

test('acepta el payload real de creación de Prop Firm sin propiedades artificiales', () => {
  const creation = { ...common, score: null, originCountryCode: null, ceoName: null, foundedAt: null, brokerProvider: null, inactivityDays: null, isNew: false, profitSplitMin: null, profitSplitMax: null, supportsEa: null, allowsNews: null, allowsWeekend: null, allowsScalping: null, allowsDayTrading: null, allowsCopyTrading: null, timeLimitPolicy: null, consistencyRules: null, specialRules: null, markets: [], tradingPlatformIds: [], instrumentCategoryIds: [], transactionMethods: [] } as Record<string, unknown>
  delete creation.id
  delete creation.expectedUpdatedAt
  assert.equal(isPropFirmSourceInput(creation), true)
})

test('valida Brokers sin aceptar URLs, monedas o colecciones arbitrarias', () => {
  const input = { ...common, countryCode: 'CO', foundedYear: 2020, minimumDeposit: 100, minimumDepositCurrency: 'USD', regulationSummary: 'Regulado', regulationSourceUrl: 'https://regulator.example', featured: false, displayOrder: 10, markets: ['cfd'], tradingPlatformIds: [id] }
  assert.equal(isBrokerSourceInput(input), true)
  assert.equal(isBrokerSourceInput({ ...input, minimumDepositCurrency: 'usd' }), false)
  assert.equal(isBrokerSourceInput({ ...input, regulationSourceUrl: 'javascript:alert(1)' }), false)
  assert.equal(isBrokerSourceInput({ ...input, markets: ['unknown'] }), false)
})

test('valida Exchanges y limita tipos, textos y valores estructurados', () => {
  const input = { ...common, countryCode: 'CO', foundedYear: 2020, exchangeType: 'centralized', productSummary: 'Spot', fiatSupport: true, regulationSummary: null, regulationSourceUrl: null, featured: true, displayOrder: 5 }
  assert.equal(isExchangeSourceInput(input), true)
  assert.equal(isExchangeSourceInput({ ...input, exchangeType: 'broker' }), false)
  assert.equal(isExchangeSourceInput({ ...input, productSummary: 'x'.repeat(5001) }), false)
  assert.equal(isExchangeSourceInput({ ...input, fiatSupport: 'true' }), false)
})
