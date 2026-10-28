import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMondoInteger, sameMondoMetric } from './mondo-metric'
import { validateMondoMetric } from './mondo-validation'

test('parses the public integer grouping without manufacturing decimal or compact values', () => {
  for (const value of ['US$\u00a0781.532.740', '$781.532.740', '$781,532,740', '781532740']) assert.equal(parseMondoInteger(value), 781532740)
  for (const value of ['—', '-', 'N/A', '']) assert.equal(parseMondoInteger(value), null)
  for (const value of ['$1.50', '650M+', 'unknown', '1e3', 'Infinity', '-1']) assert.throws(() => parseMondoInteger(value))
})
test('deduplication compares currency and distinguishes missing fields from zero', () => {
  const current = { platform_id: 'firm', period_key: 'all', amount: 100, payout_count: 5, largest_payout: 30, average_payout: 20, median_time_minutes: null, currency: 'USD' }
  const metric = { amount: 100, payoutCount: 5, largestPayout: 30, averagePayout: 20, medianTimeMinutes: null, currency: 'USD' }
  assert.equal(sameMondoMetric(current, metric), true)
  assert.equal(sameMondoMetric({ ...current, currency: 'EUR' }, metric), false)
  assert.equal(sameMondoMetric({ ...current, largest_payout: null }, { ...metric, largestPayout: 0 }), false)
})
test('rejects nonfinite values and fractional payout counts before insertion', () => {
  for (const patch of [{ amount: NaN }, { amount: Infinity }, { payoutCount: 1.5 }, { largestPayout: Infinity }, { averagePayout: NaN }]) assert.throws(() => validateMondoMetric({ amount: 100, payoutCount: 5, largestPayout: 30, averagePayout: 20, ...patch }))
})
