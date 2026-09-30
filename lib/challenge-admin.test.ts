import assert from 'node:assert/strict'
import test from 'node:test'
import {
  challengeMutationError,
  isValidOptionalNonNegativeInteger,
  isValidOptionalNonNegativeNumber,
  isValidPhaseDrawdownBasis,
  isValidPhaseDrawdownType,
  isValidPhaseNumber,
  normalizeChallengeSlug,
  optionalInteger,
  optionalNumber,
  phaseConsistencyMessage,
  phaseHasOverrides,
  phaseMutationError,
} from './challenge-admin'

test('normaliza slugs globales sin conservar espacios ni acentos', () => {
  assert.equal(normalizeChallengeSlug('  Evaluación Ágil 2 Step  '), 'evaluacion-agil-2-step')
})

test('los inputs numéricos vacíos permanecen null', () => {
  assert.equal(optionalNumber(''), null)
  assert.equal(optionalNumber('   '), null)
  assert.equal(optionalInteger(''), null)
  assert.equal(optionalNumber('0'), 0)
  assert.equal(optionalInteger('0'), 0)
})

test('los duplicados se explican según el ámbito del plan', () => {
  const duplicate = 'duplicate key value violates unique constraint (23505)'
  assert.match(challengeMutationError(duplicate, 'challenge'), /slug/)
  assert.match(challengeMutationError(duplicate, 'plan', false), /Challenge/)
  assert.match(challengeMutationError(duplicate, 'plan', true), /variante/)
})

test('valida números de fase enteros y mayores o iguales a uno', () => {
  assert.equal(isValidPhaseNumber(1), true)
  assert.equal(isValidPhaseNumber(0), false)
  assert.equal(isValidPhaseNumber(1.5), false)
})

test('valida numéricos e integer opcionales sin convertir vacío o cero', () => {
  assert.equal(optionalNumber(''), null)
  assert.equal(optionalInteger(''), null)
  assert.equal(optionalNumber('0'), 0)
  assert.equal(optionalInteger('0'), 0)
  assert.equal(isValidOptionalNonNegativeNumber(0), true)
  assert.equal(isValidOptionalNonNegativeNumber(-1), false)
  assert.equal(isValidOptionalNonNegativeInteger(2), true)
  assert.equal(isValidOptionalNonNegativeInteger(2.5), false)
})

test('acepta únicamente los catálogos confirmados de drawdown para fases', () => {
  assert.equal(isValidPhaseDrawdownType(null), true)
  assert.equal(isValidPhaseDrawdownType('balance_based'), true)
  assert.equal(isValidPhaseDrawdownType('otro'), false)
  assert.equal(isValidPhaseDrawdownBasis(null), true)
  assert.equal(isValidPhaseDrawdownBasis('balance_or_equity'), true)
  assert.equal(isValidPhaseDrawdownBasis('otro'), false)
})

test('mapea duplicados de fase y detecta inconsistencias de conteo', () => {
  assert.equal(phaseMutationError('duplicate key value violates unique constraint (23505)', 2), 'Ya existe la fase 2 para este Challenge.')
  assert.equal(phaseConsistencyMessage(2, 1), 'Este Challenge declara 2 fases, pero actualmente hay 1 configurada.')
  assert.equal(phaseConsistencyMessage(0, 0), null)
  assert.match(phaseConsistencyMessage(0, 1) ?? '', /declara 0 fases/)
})

test('protege conceptualmente renumerado y borrado cuando hay overrides', () => {
  assert.equal(phaseHasOverrides([1, 3], 1), true)
  assert.equal(phaseHasOverrides([1, 3], 2), false)
})
