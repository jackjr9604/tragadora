import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewOfficialPayoutEvidence, type OfficialPayoutEvidence } from './official-payout-evidence'

const now = Date.parse('2026-10-28T16:00:00Z')
const fixture: OfficialPayoutEvidence = {
  firm: 'Fictional firm', source: { url: 'https://example.com/payouts', officialHost: 'example.com', checkedAt: '2026-10-28T15:00:00Z', asOf: '2026-10-27', accessible: true },
  amount: { literal: 'USD 1234.50 paid to traders since inception', value: '1234.50', precision: 'exact', operator: 'eq' },
  currency: 'USD', scope: 'firm_total', period: { kind: 'lifetime', start: null, end: null, days: null },
}

test('an exact declared firm total still requires human review and never authorizes a load', () => {
  const result = reviewOfficialPayoutEvidence(fixture, now)
  assert.equal(result.status, 'exact_candidate_for_human_review')
  assert.equal(result.loadAuthorized, false)
  assert.deepEqual(result.evidence, fixture)
})

test('bounds and approximations preserve literal, operator, currency and period', () => {
  for (const amount of [
    { literal: '650M+', value: '650000000', precision: 'lower_bound', operator: 'plus' },
    { literal: 'más de 650 millones', value: '650000000', precision: 'lower_bound', operator: 'gt' },
    { literal: 'about USD 1200', value: '1200', precision: 'approximate', operator: 'approx' },
  ] as const) {
    const input = { ...fixture, amount }
    const result = reviewOfficialPayoutEvidence(input, now)
    assert.equal(result.status, 'reference_only')
    assert.deepEqual(result.evidence, input)
    assert.equal(result.loadAuthorized, false)
  }
  const wrong = reviewOfficialPayoutEvidence({ ...fixture, amount: { literal: '650M+', value: '650000000', precision: 'exact', operator: 'eq' } }, now)
  assert.ok(wrong.issues.includes('PROMOTIONAL_CLAIM_IS_NOT_EXACT'))
  const arbitraryOperator = reviewOfficialPayoutEvidence({ ...fixture, amount: { literal: '650M+', value: '650000000', precision: 'lower_bound', operator: 'gt' } }, now)
  assert.ok(arbitraryOperator.issues.includes('PLUS_OPERATOR_MUST_REMAIN_UNQUALIFIED'))
  const wrongInclusiveBound = reviewOfficialPayoutEvidence({ ...fixture, amount: { literal: 'more than USD 1200', value: '1200', precision: 'lower_bound', operator: 'gte' } }, now)
  assert.ok(wrongInclusiveBound.issues.includes('BOUND_LITERAL_MISMATCH'))
  const approximationAsBound = reviewOfficialPayoutEvidence({ ...fixture, amount: { literal: 'about USD 1200', value: '1200', precision: 'lower_bound', operator: 'gt' } }, now)
  assert.ok(approximationAsBound.issues.includes('BOUND_LITERAL_MISMATCH'))
})

test('unknown currency/cutoff, blocked sources and individual/funding claims cannot become firm totals', () => {
  for (const change of [
    { currency: null }, { source: { ...fixture.source, asOf: null } }, { source: { ...fixture.source, accessible: false } },
    { scope: 'individual_total' }, { scope: 'individual_payout' }, { scope: 'funding' }, { scope: 'conditions' },
    { source: { ...fixture.source, url: 'https://other.example/payouts' } },
  ]) assert.equal(reviewOfficialPayoutEvidence({ ...fixture, ...change }, now).status, 'blocked')
})

test('monthly unknown dates cannot be silently treated as rolling 30d', () => {
  const unknown = { kind: 'unknown', start: null, end: null, days: null }
  assert.ok(reviewOfficialPayoutEvidence({ ...fixture, period: unknown }, now).issues.includes('PERIOD_UNCONFIRMED'))
  const calendar = { kind: 'calendar', start: '2026-09-01', end: '2026-10-01', days: 30 }
  assert.ok(reviewOfficialPayoutEvidence({ ...fixture, period: calendar }, now).issues.includes('CALENDAR_PERIOD_IS_NOT_A_ROLLING_WINDOW'))
  const wrongRolling = { kind: 'rolling', start: '2026-10-01', end: '2026-10-27', days: 30 }
  assert.ok(reviewOfficialPayoutEvidence({ ...fixture, period: wrongRolling }, now).issues.includes('ROLLING_PERIOD_DURATION_MISMATCH'))
})

test('malformed and impossible dates are rejected without changing input', () => {
  assert.equal(reviewOfficialPayoutEvidence({}, now).status, 'blocked')
  const input = { ...fixture, source: { ...fixture.source, asOf: '2026-02-30' } }
  const before = structuredClone(input)
  assert.equal(reviewOfficialPayoutEvidence(input, now).status, 'blocked')
  assert.deepEqual(input, before)
})
