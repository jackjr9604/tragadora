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

test('una restricción oficial aplicable restringe sin exponer el criterio interno', () => {
  for (const basis of ['nationality', 'physical_location', 'unspecified'] as const) {
    const result = resolveAvailability([rule('restricted', null, basis)], 'firm', 'CO')
    assert.equal(result.status, 'restricted')
    assert.equal(result.warning, null)
  }
  assert.equal(resolveAvailability([rule('available', null, 'unspecified')], 'firm', 'CO').status, 'available')
})

test('infiere available solo desde una lista completa aplicable al market', () => {
  const complete = { ...rule('restricted', 'futures'), countryCode: 'US', restrictionListComplete: true }
  assert.equal(resolveAvailability([complete], 'firm', 'CO', 'futures').status, 'available')
  assert.equal(resolveAvailability([complete], 'firm', 'CO', 'cfd').status, 'unknown')
  assert.equal(resolveAvailability([{ ...complete, market: null }], 'firm', 'CO', 'cfd').status, 'available')
  assert.equal(resolveAvailability([{ ...complete, restrictionListComplete: false }], 'firm', 'CO', 'futures').status, 'unknown')
})
