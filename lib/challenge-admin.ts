export function normalizeChallengeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function optionalNumber(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

export function optionalInteger(value: string): number | null {
  const parsed = optionalNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

export function isValidChallengeSlug(value: string) {
  return value.length > 0 && value === normalizeChallengeSlug(value)
}

export function hasDuplicateVariantSlug(variants: Array<{ id: string; slug: string }>, slug: string, currentId?: string) {
  return variants.some((variant) => variant.id !== currentId && variant.slug === slug)
}

export type VariantDependencyCounts = {
  plans: number
  overrides: number
  rewards: number
}

export type VariantScopedPlan = {
  variant_id: string | null
}

export function plansForVariant<T extends VariantScopedPlan>(plans: T[], variantId: string) {
  return plans.filter((plan) => plan.variant_id === variantId)
}

export function initialPlanVariantId(variantId?: string) {
  return variantId ?? ''
}

export function canDeleteVariant(counts: VariantDependencyCounts) {
  return counts.plans === 0 && counts.overrides === 0 && counts.rewards === 0
}

export function variantDependencyMessage(counts: VariantDependencyCounts) {
  if (canDeleteVariant(counts)) return null
  const parts = [
    `${counts.plans} plan${counts.plans === 1 ? '' : 'es'}`,
    `${counts.overrides} override${counts.overrides === 1 ? '' : 's'}`,
    `${counts.rewards} ${counts.rewards === 1 ? 'opción' : 'opciones'} de recompensa`,
  ]
  return `No se puede eliminar esta variante porque tiene relaciones asociadas: ${parts.join(', ')}. Desactívala o elimina primero sus dependencias.`
}

export function variantMutationError(message: string) {
  if (message.includes('23505') || /duplicate key|unique constraint/i.test(message)) {
    return 'Ya existe una variante con este slug dentro del Challenge.'
  }
  return message
}

export const PHASE_DRAWDOWN_TYPES = ['static', 'trailing', 'dynamic', 'balance_based', 'equity_based'] as const
export const PHASE_DRAWDOWN_BASES = ['balance', 'equity', 'balance_or_equity'] as const

export type PhaseDrawdownType = typeof PHASE_DRAWDOWN_TYPES[number]
export type PhaseDrawdownBasis = typeof PHASE_DRAWDOWN_BASES[number]

export function isValidPhaseNumber(value: number) {
  return Number.isInteger(value) && value >= 1
}

export function isValidOptionalNonNegativeNumber(value: number | null) {
  return value === null || (Number.isFinite(value) && value >= 0)
}

export function isValidOptionalNonNegativeInteger(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 0)
}

export function isValidPhaseDrawdownType(value: string | null): value is PhaseDrawdownType | null {
  return value === null || PHASE_DRAWDOWN_TYPES.includes(value as PhaseDrawdownType)
}

export function isValidPhaseDrawdownBasis(value: string | null): value is PhaseDrawdownBasis | null {
  return value === null || PHASE_DRAWDOWN_BASES.includes(value as PhaseDrawdownBasis)
}

export function phaseMutationError(message: string, phaseNumber: number) {
  if (message.includes('23505') || /duplicate key|unique constraint/i.test(message)) {
    return `Ya existe la fase ${phaseNumber} para este Challenge.`
  }
  return message
}

export function phaseConsistencyMessage(declared: number | null, configured: number) {
  if (declared === 0 && configured === 0) return null
  if (declared === 0 && configured > 0) {
    return `Este Challenge declara 0 fases, pero actualmente hay ${configured} configurada${configured === 1 ? '' : 's'}.`
  }
  if (declared !== null && declared !== configured) {
    return `Este Challenge declara ${declared} fase${declared === 1 ? '' : 's'}, pero actualmente hay ${configured} configurada${configured === 1 ? '' : 's'}.`
  }
  return null
}

export function phaseHasOverrides(overridePhaseNumbers: number[], phaseNumber: number) {
  return overridePhaseNumbers.includes(phaseNumber)
}

export const VARIANT_OVERRIDE_DRAWDOWN_TYPES = ['static', 'trailing', 'dynamic'] as const
export const VARIANT_OVERRIDE_DRAWDOWN_BASES = ['balance', 'equity', 'balance_or_equity'] as const

export type VariantOverrideDrawdownType = typeof VARIANT_OVERRIDE_DRAWDOWN_TYPES[number]
export type VariantOverrideDrawdownBasis = typeof VARIANT_OVERRIDE_DRAWDOWN_BASES[number]

export function isValidVariantOverrideDrawdownType(value: string | null): value is VariantOverrideDrawdownType | null {
  return value === null || VARIANT_OVERRIDE_DRAWDOWN_TYPES.includes(value as VariantOverrideDrawdownType)
}

export function isValidVariantOverrideDrawdownBasis(value: string | null): value is VariantOverrideDrawdownBasis | null {
  return value === null || VARIANT_OVERRIDE_DRAWDOWN_BASES.includes(value as VariantOverrideDrawdownBasis)
}

export type VariantPhaseOverrideValues = {
  profit_target: number | null
  daily_drawdown: number | null
  max_drawdown: number | null
  min_trading_days: number | null
  min_profitable_days: number | null
  drawdown_type: string | null
  drawdown_basis: string | null
  notes: string | null
}

export function hasVariantPhaseOverride(values: VariantPhaseOverrideValues) {
  return Object.values(values).some((value) => value !== null)
}

export function effectiveVariantPhaseValue<T>(overrideValue: T | null, baseValue: T | null) {
  return overrideValue ?? baseValue
}

export function overridesForVariant<T extends { variant_id: string }>(overrides: T[], variantId: string) {
  return overrides.filter((override) => override.variant_id === variantId)
}

export function orphanVariantOverrides<T extends { phase_number: number }>(overrides: T[], basePhaseNumbers: number[]) {
  const phaseNumbers = new Set(basePhaseNumbers)
  return overrides.filter((override) => !phaseNumbers.has(override.phase_number))
}

export function variantOverrideMutationError(message: string, phaseNumber: number) {
  if (message.includes('23505') || /duplicate key|unique constraint/i.test(message)) {
    return `Ya existe un override para la fase ${phaseNumber} de esta variante. Actualiza la página e inténtalo de nuevo.`
  }
  return message
}

export function challengeMutationError(message: string, scope: 'challenge' | 'plan', hasVariant = false) {
  if (message.includes('23505') || /duplicate key|unique constraint/i.test(message)) {
    if (scope === 'challenge') return 'Ese slug ya está siendo utilizado por otro Challenge.'
    return hasVariant
      ? 'Ya existe un plan con ese tamaño y moneda para esta variante.'
      : 'Ya existe un plan con ese tamaño y moneda para este Challenge.'
  }
  return message
}

export async function revalidateChallengeData(action: 'create' | 'update' | 'delete', platformSlugs: string[]) {
  const response = await fetch('/api/admin/challenges/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, platformSlugs }),
  })
  const result = await response.json() as { success?: boolean; error?: string }
  if (!response.ok || result.success !== true) throw new Error(result.error || 'No se pudo revalidar el contenido público.')
}
