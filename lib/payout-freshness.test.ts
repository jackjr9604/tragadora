import assert from 'node:assert/strict'
import test from 'node:test'
import { matchingOfficialCheck, payoutFreshness, type OfficialCheckSource } from './payout-freshness'

const now = Date.parse('2026-10-28T15:00:00Z')

test('a recent successful check cannot make an old capture current', () => {
  const result = payoutFreshness({ displayTotalUpdatedAt: '2026-10-16T11:00:00Z', displayTotalLastCheckedAt: '2026-10-28T14:00:00Z', displayTotalSourceType: 'third_party_public' }, now)
  assert.equal(result.stale, true)
  assert.equal(result.updatedAt, '2026-10-16T11:00:00.000Z')
  assert.equal(result.checkedAt, '2026-10-28T14:00:00.000Z')
})

test('missing, invalid and future dates remain unknown instead of using the request time', () => {
  for (const date of [null, 'invalid', '2027-01-01T00:00:00Z']) {
    const result = payoutFreshness({ displayTotalUpdatedAt: date, displayTotalLastCheckedAt: date, displayTotalSourceType: 'third_party_public' }, now)
    assert.equal(result.updatedAt, null)
    assert.equal(result.checkedAt, null)
    assert.equal(result.unknown, true)
  }
})

test('capture warning uses source cadence independently of the last check', () => {
  const input = { displayTotalUpdatedAt: '2026-10-26T23:00:00Z', displayTotalSourceType: 'official_firm' }
  assert.equal(payoutFreshness(input, now).stale, true)
  assert.equal(payoutFreshness({ ...input, displayTotalSourceType: 'third_party_public' }, now).stale, false)
})

const summary = { platformId: 'fixture', periodKey: '30d', displayTotalSourceType: 'official_firm', displayTotalSourceName: 'Official fixture', displayTotalSourceUrl: 'https://example.com/rewards' }
const source: OfficialCheckSource = { platform_id: 'fixture', source_type: 'public_page', source_url: summary.displayTotalSourceUrl, config: { collector: { sourceName: 'Official fixture', periods: [{ periodKey: '30d' }] } }, last_success_at: '2026-10-28T14:00:00Z' }

test('only the selected official source and configured period can supply a check date', () => {
  assert.equal(matchingOfficialCheck(summary, [source]), source.last_success_at)
  for (const other of [{ platformId: 'other' }, { periodKey: '7d' }, { displayTotalSourceName: 'MondoTraders' }, { displayTotalSourceType: 'third_party_public' }, { displayTotalSourceUrl: 'https://example.com/other' }]) {
    assert.equal(matchingOfficialCheck({ ...summary, ...other }, [source]), null)
  }
  assert.equal(matchingOfficialCheck(summary, [{ ...source, config: null }]), null)
  assert.equal(matchingOfficialCheck(summary, []), null)
})
