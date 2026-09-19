import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAvailability, type AvailabilityRule } from './platform-availability'

const rule = (status: AvailabilityRule['status'], market: string | null = null, basis: AvailabilityRule['restrictionBasis'] = 'residence'): AvailabilityRule => ({
  platformId: 'firm', countryCode: 'CO', market, status, restrictionBasis: basis,
})

test('general available y general restricted', () => {
  assert.equal(resolveAvailability([rule('available')], 'firm', 'co', 'cfd').status, 'available')
  assert.equal(resolveAvailability([rule('restricted')], 'firm', 'CO', 'futures').status, 'restricted')
})

test('market restricted vence general available y viceversa', () => {
  assert.equal(resolveAvailability([rule('available'), rule('restricted', 'futures')], 'firm', 'CO', 'futures').status, 'restricted')
  assert.equal(resolveAvailability([rule('restricted'), rule('available', 'futures')], 'firm', 'CO', 'futures').status, 'available')
})

test('sin regla y regla de otro mercado no producen disponibilidad', () => {
  assert.equal(resolveAvailability([], 'firm', 'CO', 'cfd').status, 'unknown')
  assert.equal(resolveAvailability([rule('restricted', 'futures')], 'firm', 'CO', 'cfd').status, 'unknown')
  assert.equal(resolveAvailability([rule('restricted', 'futures')], 'other', 'CO', 'futures').status, 'unknown')
})

test('residence restringe; nationality, ubicación y unspecified solo advierten', () => {
  assert.equal(resolveAvailability([rule('restricted')], 'firm', 'CO').status, 'restricted')
  for (const basis of ['nationality', 'physical_location', 'unspecified'] as const) {
    const result = resolveAvailability([rule('restricted', null, basis)], 'firm', 'CO')
    assert.equal(result.status, 'unknown')
    assert.ok(result.warning)
  }
  assert.equal(resolveAvailability([rule('available', null, 'unspecified')], 'firm', 'CO').status, 'unknown')
})
