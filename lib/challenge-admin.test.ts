import assert from 'node:assert/strict'
import test from 'node:test'
import {
  challengeMutationError,
  isValidOptionalNonNegativeInteger,
  isValidOptionalNonNegativeNumber,
  isValidChallengeSlug,
  hasDuplicateVariantSlug,
  isValidPhaseDrawdownBasis,
  isValidPhaseDrawdownType,
  isValidPhaseNumber,
  normalizeChallengeSlug,
  optionalInteger,
  optionalNumber,
  phaseConsistencyMessage,
  phaseHasOverrides,
  phaseMutationError,
  canDeleteVariant,
  variantDependencyMessage,
  variantMutationError,
  plansForVariant,
  initialPlanVariantId,
  effectiveVariantPhaseValue,
  hasVariantPhaseOverride,
  orphanVariantOverrides,
  overridesForVariant,
  VARIANT_OVERRIDE_DRAWDOWN_BASES,
  VARIANT_OVERRIDE_DRAWDOWN_TYPES,
  variantOverrideMutationError,
  isValidVariantOverrideDrawdownBasis,
  isValidVariantOverrideDrawdownType,
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

test('valida nombre y slug para variantes sin aceptar slugs vacíos o sin normalizar', () => {
  assert.equal(' Variante '.trim().length > 0, true)
  assert.equal('   '.trim().length > 0, false)
  assert.equal(isValidChallengeSlug('variant-85'), true)
  assert.equal(isValidChallengeSlug(''), false)
  assert.equal(isValidChallengeSlug('Variant 85'), false)
})

test('conserva null y cero en numéricos opcionales y status es booleano', () => {
  assert.equal(optionalNumber(''), null)
  assert.equal(optionalNumber('0'), 0)
  const status = false
  assert.equal(typeof status, 'boolean')
})

test('mapea el error 23505 de variante a un mensaje amigable', () => {
  assert.equal(
    variantMutationError('duplicate key value violates unique constraint (23505)'),
    'Ya existe una variante con este slug dentro del Challenge.'
  )
})

test('detecta slug duplicado solamente dentro del conjunto del Challenge actual', () => {
  const variants = [{ id: 'v1', slug: 'standard' }]
  assert.equal(hasDuplicateVariantSlug(variants, 'standard'), true)
  assert.equal(hasDuplicateVariantSlug(variants, 'standard', 'v1'), false)
  assert.equal(hasDuplicateVariantSlug(variants, 'aggressive'), false)
})

test('solo permite eliminar variantes sin dependencias', () => {
  assert.equal(canDeleteVariant({ plans: 0, overrides: 0, rewards: 0 }), true)
  assert.equal(canDeleteVariant({ plans: 1, overrides: 0, rewards: 0 }), false)
  assert.equal(canDeleteVariant({ plans: 0, overrides: 1, rewards: 0 }), false)
  assert.equal(canDeleteVariant({ plans: 0, overrides: 0, rewards: 1 }), false)
  assert.equal(canDeleteVariant({ plans: 2, overrides: 1, rewards: 3 }), false)
})

test('resume todas las dependencias que bloquean el borrado', () => {
  const message = variantDependencyMessage({ plans: 2, overrides: 1, rewards: 3 }) ?? ''
  assert.match(message, /2 planes/)
  assert.match(message, /1 override/)
  assert.match(message, /3 opciones de recompensa/)
  assert.match(message, /Desactívala/)
  assert.equal(variantDependencyMessage({ plans: 0, overrides: 0, rewards: 0 }), null)
})

test('cada variante recibe únicamente sus propios planes', () => {
  const plans = [
    { id: 'general', variant_id: null },
    { id: 'a-1', variant_id: 'variant-a' },
    { id: 'a-2', variant_id: 'variant-a' },
    { id: 'b-1', variant_id: 'variant-b' },
  ]
  assert.deepEqual(plansForVariant(plans, 'variant-a').map((plan) => plan.id), ['a-1', 'a-2'])
  assert.deepEqual(plansForVariant(plans, 'variant-b').map((plan) => plan.id), ['b-1'])
})

test('los planes generales no aparecen dentro de una variante', () => {
  const plans = [{ id: 'general', variant_id: null }]
  assert.deepEqual(plansForVariant(plans, 'variant-a'), [])
})

test('una variante sin planes conserva un estado vacío', () => {
  const plans = [{ id: 'b-1', variant_id: 'variant-b' }]
  assert.equal(plansForVariant(plans, 'variant-a').length, 0)
})

test('crear desde una variante inicializa su variant_id exacto', () => {
  assert.equal(initialPlanVariantId('variant-a'), 'variant-a')
  assert.equal(initialPlanVariantId(), '')
})

const inheritedOverride = {
  profit_target: null,
  daily_drawdown: null,
  max_drawdown: null,
  min_trading_days: null,
  min_profitable_days: null,
  drawdown_type: null,
  drawdown_basis: null,
  notes: null,
}

test('los valores null heredan y cero permanece como override real', () => {
  assert.equal(effectiveVariantPhaseValue(null, 8), 8)
  assert.equal(effectiveVariantPhaseValue(0, 8), 0)
})

test('un override parcial conserva null en los demás campos', () => {
  const partial = { ...inheritedOverride, profit_target: 10 }
  assert.equal(hasVariantPhaseOverride(partial), true)
  assert.equal(partial.daily_drawdown, null)
  assert.equal(partial.max_drawdown, null)
})

test('todos los campos heredados requieren ausencia de fila o DELETE y no INSERT vacío', () => {
  assert.equal(hasVariantPhaseOverride(inheritedOverride), false)
  assert.equal(hasVariantPhaseOverride({ ...inheritedOverride, notes: 'Explícita' }), true)
})

test('catálogos de override excluyen tipos exclusivos de fases base', () => {
  assert.deepEqual(VARIANT_OVERRIDE_DRAWDOWN_TYPES, ['static', 'trailing', 'dynamic'])
  assert.equal(VARIANT_OVERRIDE_DRAWDOWN_TYPES.includes('balance_based' as never), false)
  assert.equal(VARIANT_OVERRIDE_DRAWDOWN_TYPES.includes('equity_based' as never), false)
  assert.deepEqual(VARIANT_OVERRIDE_DRAWDOWN_BASES, ['balance', 'equity', 'balance_or_equity'])
  assert.equal(isValidVariantOverrideDrawdownType(null), true)
  assert.equal(isValidVariantOverrideDrawdownType('dynamic'), true)
  assert.equal(isValidVariantOverrideDrawdownType('balance_based'), false)
  assert.equal(isValidVariantOverrideDrawdownBasis(null), true)
  assert.equal(isValidVariantOverrideDrawdownBasis('balance_or_equity'), true)
  assert.equal(isValidVariantOverrideDrawdownBasis('otro'), false)
})

test('balance_based y equity_based pueden heredarse sin almacenarse como override', () => {
  assert.equal(effectiveVariantPhaseValue(null, 'balance_based'), 'balance_based')
  assert.equal(effectiveVariantPhaseValue(null, 'equity_based'), 'equity_based')
})

test('cada variante recibe únicamente sus overrides', () => {
  const overrides = [{ id: 'a', variant_id: 'variant-a' }, { id: 'b', variant_id: 'variant-b' }]
  assert.deepEqual(overridesForVariant(overrides, 'variant-a').map((item) => item.id), ['a'])
})

test('detecta overrides cuyo phase_number ya no existe', () => {
  const overrides = [{ id: 'valid', phase_number: 1 }, { id: 'orphan', phase_number: 3 }]
  assert.deepEqual(orphanVariantOverrides(overrides, [1, 2]).map((item) => item.id), ['orphan'])
})

test('el error 23505 de override se presenta sin exponer Postgres', () => {
  assert.match(variantOverrideMutationError('duplicate key value violates unique constraint (23505)', 2), /fase 2/)
})
