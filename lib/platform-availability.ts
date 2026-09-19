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
}

export type ResolvedAvailability = {
  status: AvailabilityStatus
  rule: AvailabilityRule | null
  /** A rule about citizenship or physical location cannot be settled by residence alone. */
  warning: string | null
}

export function resolveAvailability(
  rules: readonly AvailabilityRule[], platformId: string, countryCode: string, market: string | null = null,
): ResolvedAvailability {
  const country = countryCode.trim().toUpperCase()
  if (!country) return { status: 'unknown', rule: null, warning: null }
  const relevant = rules.filter((rule) => rule.platformId === platformId && rule.countryCode.toUpperCase() === country)
  const specific = market ? relevant.find((rule) => rule.market === market) : undefined
  const rule = specific ?? relevant.find((item) => item.market === null) ?? null
  if (!rule || rule.status === 'unknown') return { status: 'unknown', rule, warning: null }
  if (rule.restrictionBasis === 'residence') return { status: rule.status, rule, warning: null }

  const warning = rule.restrictionBasis === 'nationality'
    ? 'Existe una regla documentada relacionada con nacionalidad; tu país de residencia no confirma si te afecta.'
    : rule.restrictionBasis === 'physical_location'
      ? 'Existe una regla documentada relacionada con el lugar desde donde operas; tu residencia no confirma si te afecta.'
      : 'Existe una regla geográfica documentada, pero su criterio de aplicación no está confirmado.'
  return { status: 'unknown', rule, warning }
}
