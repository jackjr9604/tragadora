export type AvailabilityStatus = 'available' | 'restricted' | 'unknown'
export type RestrictionBasis = 'residence' | 'nationality' | 'physical_location' | 'unspecified'
export type AvailabilityRule = {
  platformId: string
  countryCode: string
  market: string | null
  status: AvailabilityStatus
  restrictionBasis: RestrictionBasis
  sourceUrl?: string | null
  verifiedAt?: string | null
  ruleSummary?: string | null
  restrictionListComplete?: boolean
}

export type ResolvedAvailability = {
  status: AvailabilityStatus
  rule: AvailabilityRule | null
  /** Nota pública breve; los matices de evidencia permanecen internos. */
  warning: string | null
}

export function resolveAvailability(
  rules: readonly AvailabilityRule[], platformId: string, countryCode: string, market: string | null = null,
): ResolvedAvailability {
  const country = countryCode.trim().toUpperCase()
  if (!country) return { status: 'unknown', rule: null, warning: null }
  const platformRules = rules.filter((rule) => rule.platformId === platformId)
  const relevant = platformRules.filter((rule) => rule.countryCode.toUpperCase() === country)
  const specific = market ? relevant.find((rule) => rule.market === market) : undefined
  const rule = specific ?? relevant.find((item) => item.market === null) ?? null
  if (rule && rule.status !== 'unknown') return { status: rule.status, rule, warning: null }

  const completeSpecific = market
    ? platformRules.find((item) => item.market === market && item.restrictionListComplete)
    : undefined
  const completeGeneral = platformRules.find((item) => item.market === null && item.restrictionListComplete)
  const coverage = completeSpecific ?? completeGeneral ?? null
  if (coverage) {
    return {
      status: 'available',
      rule: coverage,
      warning: 'Según las restricciones publicadas por la firma.',
    }
  }
  return { status: 'unknown', rule, warning: null }
}
