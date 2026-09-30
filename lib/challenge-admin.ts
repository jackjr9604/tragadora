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
