import assert from 'node:assert/strict'
import test from 'node:test'
import { selectPayoutSummary } from './payout-summary-selection'

const verified = { platform_id: 'firm', period_key: '24h', verified_amount: 40, verified_payout_count: 2, verified_largest_payout: 30, verified_average_payout: 20, verified_last_payout_at: '2026-10-28T00:00:00Z' }
const mondo = { id: 'mondo', platform_id: 'firm', period_key: '24h', metric_type: 'payout_summary', is_current: true, source_type: 'third_party_public', verification_level: 'blockchain_external', source_name: 'MondoTraders', source_url: 'https://mondotraders.com/en/', amount: 1000, payout_count: 10, largest_payout: 400, average_payout: 100, currency: 'USD', median_time_minutes: 60, collected_at: '2026-10-16T00:00:00Z', updated_at: '2026-10-16T00:00:00Z' }

test('company totals remain a coherent packet separate from partial blockchain payments', () => {
  const selected = selectPayoutSummary(verified, [mondo])
  assert.deepEqual([selected.display_total_amount, selected.known_payout_count, selected.known_largest_payout, selected.known_average_payout, selected.known_currency], [1000, 10, 400, 100, 'USD'])
  assert.equal(selected.verified_amount, 40)
  assert.equal(selected.display_total_source_name, 'MondoTraders')
  assert.equal(selected.display_total_updated_at, mondo.collected_at)
})
test('official sources retain priority; missing fields never borrow blockchain metrics', () => {
  const official = { ...mondo, id: 'official', source_type: 'official_firm', source_name: 'Official', verification_level: 'firm_reported', amount: null, payout_count: null, average_payout: null, largest_payout: null, currency: 'EUR' }
  const selected = selectPayoutSummary(verified, [mondo, official])
  assert.equal(selected.display_total_source_name, 'Official')
  for (const key of ['display_total_amount', 'known_payout_count', 'known_average_payout', 'known_largest_payout']) assert.equal(selected[key], null)
  assert.equal(selected.known_currency, 'EUR')
})
test('never borrows another period, platform, superseded or unverified snapshot', () => {
  for (const patch of [{ period_key: '7d' }, { platform_id: 'other' }, { is_current: false }, { verification_level: 'unverified' }, { metric_type: 'other' }]) {
    const selected = selectPayoutSummary(verified, [{ ...mondo, ...patch }])
    assert.equal(selected.display_total_amount, 40)
    assert.equal(selected.display_total_source_type, 'tragadora_blockchain')
    assert.equal(selected.display_total_source_url, null)
    assert.equal(selected.known_median_time_minutes, null)
  }
})
test('latest equally trusted capture wins deterministically without refreshing timestamps', () => {
  const newer = { ...mondo, id: 'new', amount: 2000, collected_at: '2026-10-17T00:00:00Z' }
  assert.equal(selectPayoutSummary(verified, [mondo, newer]).display_total_amount, 2000)
  assert.equal(selectPayoutSummary(verified, [newer, mondo]).display_total_updated_at, newer.collected_at)
  assert.equal(selectPayoutSummary({ platform_id: 'none', period_key: 'all' }, []).display_total_amount, null)
})
