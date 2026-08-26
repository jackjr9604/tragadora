export type PayoutVerification = 'official_api' | 'onchain' | 'provider' | 'public_page' | 'none'

export type RecommendationPlan = {
  price: number | null
  accountSize: number | null
  profitSplit: number | null
  maxDrawdown: number | null
  challengeType: string | null
}

export type RecommendableFirm = {
  id: string
  name: string
  slug: string
  score: number | null
  logoUrl: string | null
  logoAlt: string | null
  profitSplit: number | null
  supportsEa: boolean | null
  allowsNews: boolean | null
  allowsWeekend: boolean | null
  allowsScalping: boolean | null
  allowsDayTrading: boolean | null
  allowsCopyTrading: boolean | null
  markets: string[]
  verification: PayoutVerification
  verificationLabel: string
  availableCountryCodes: string[]
  availabilityKnown: boolean
  plans: RecommendationPlan[]
  activeOffer: { title: string; value: number; type: string } | null
}

export type RecommendationCriteria = {
  country: string
  market: string
  experience: string
  budget: number | null
  accountSize: number | null
  evaluation: string
  priority: string
  styles: string[]
  payoutPreference: 'verified' | 'any'
}

export type FirmRecommendation = {
  firm: RecommendableFirm
  compatibility: number
  positives: string[]
  negatives: string[]
  unavailable: string[]
  recommendedPlan: RecommendationPlan | null
}

export function classifyPayoutVerification(sources: Array<{ source_type: string | null; config: unknown }>): { level: PayoutVerification; label: string } {
  const has = (type: string) => sources.some((source) => source.source_type === type)
  const onchain = sources.some((source) => {
    if (source.source_type !== 'blockchain' || !source.config || typeof source.config !== 'object') return false
    return (source.config as Record<string, unknown>).verification === 'onchain_attributed'
  })
  if (has('official_api')) return { level: 'official_api', label: 'API oficial' }
  if (onchain) return { level: 'onchain', label: 'Verificado on-chain' }
  if (has('provider')) return { level: 'provider', label: 'Proveedor' }
  if (has('public_page')) return { level: 'public_page', label: 'Datos públicos' }
  return { level: 'none', label: 'Sin verificación' }
}

function normalized(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
}

export function recommendPropFirms(criteria: RecommendationCriteria, firms: RecommendableFirm[]): FirmRecommendation[] {
  return firms.flatMap((firm) => {
    if (criteria.country && firm.availabilityKnown && !firm.availableCountryCodes.includes(criteria.country)) return []
    let earned = 0
    let availableWeight = 0
    const positives: string[] = []
    const negatives: string[] = []
    const unavailable: string[] = []

    if (criteria.market) {
      availableWeight += 25
      if (firm.markets.length === 0) {
        unavailable.push('Mercado no confirmado')
      } else if (firm.markets.includes(criteria.market)) {
        earned += 25
        positives.push(`Opera ${marketLabel(criteria.market)}`)
      } else {
        negatives.push(`No opera ${marketLabel(criteria.market)}`)
      }
    }

    const compatiblePlans = firm.plans.filter((plan) => {
      const budgetMatch = criteria.budget === null || plan.price === null || plan.price <= criteria.budget
      const sizeMatch = criteria.accountSize === null || plan.accountSize === null || plan.accountSize >= criteria.accountSize
      const typeMatch = criteria.evaluation === 'any' || !plan.challengeType || normalized(plan.challengeType).includes(normalized(criteria.evaluation))
      return budgetMatch && sizeMatch && typeMatch
    })
    const recommendedPlan = compatiblePlans.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] ?? null

    if (criteria.budget !== null) {
      const known = firm.plans.some((plan) => plan.price !== null)
      if (known) { availableWeight += 20; if (compatiblePlans.some((plan) => plan.price !== null && plan.price! <= criteria.budget!)) { earned += 20; positives.push('Presupuesto compatible') } else negatives.push('No encontramos un plan dentro del presupuesto') }
      else unavailable.push('Precio no disponible')
    }
    if (criteria.accountSize !== null) {
      const known = firm.plans.some((plan) => plan.accountSize !== null)
      if (known) { availableWeight += 15; if (firm.plans.some((plan) => plan.accountSize! >= criteria.accountSize!)) { earned += 15; positives.push('Tiene el tamaño de cuenta solicitado') } else negatives.push('No aparece el tamaño de cuenta solicitado') }
      else unavailable.push('Tamaños de cuenta no disponibles')
    }
    if (criteria.evaluation !== 'any') {
      const known = firm.plans.some((plan) => plan.challengeType)
      if (known) { availableWeight += 10; if (firm.plans.some((plan) => normalized(plan.challengeType).includes(normalized(criteria.evaluation)))) { earned += 10; positives.push('Tipo de evaluación compatible') } else negatives.push('Evaluación distinta a la preferida') }
      else unavailable.push('Tipo de evaluación no disponible')
    }

    const styleChecks = [
      ['ea', firm.supportsEa, 8, 'Permite EA / Bots'],
      ['news', firm.allowsNews, 8, 'Permite operar noticias'],
      ['weekend', firm.allowsWeekend, 8, 'Permite mantener el fin de semana'],
      ['scalping', firm.allowsScalping, 8, 'Permite scalping'],
      ['day', firm.allowsDayTrading, 8, 'Permite Day Trading'],
      ['copy', firm.allowsCopyTrading, 8, 'Permite Copy Trading'],
    ] as const
    for (const [style, value, weight, label] of styleChecks) {
      if (!criteria.styles.includes(style)) continue
      if (value === null) unavailable.push(`${label}: dato no disponible`)
      else { availableWeight += weight; if (value) { earned += weight; positives.push(label) } else negatives.push(`No ${label.toLowerCase()}`) }
    }
    const bestProfitSplit = Math.max(firm.profitSplit ?? 0, ...firm.plans.map((plan) => plan.profitSplit ?? 0))
    if (bestProfitSplit > 0) { availableWeight += 10; const points = bestProfitSplit >= 90 ? 10 : bestProfitSplit >= 80 ? 8 : 5; earned += points; positives.push(`Profit split de hasta ${bestProfitSplit}%`) }
    else unavailable.push('Profit split no disponible')

    if (criteria.payoutPreference === 'verified' || criteria.priority === 'payouts') {
      availableWeight += 15
      if (firm.verification !== 'none') { earned += firm.verification === 'official_api' || firm.verification === 'onchain' ? 15 : 10; positives.push(firm.verificationLabel) }
      else negatives.push('Sin fuente de payouts verificada')
    }
    if (firm.score !== null) { availableWeight += 6; earned += Math.max(0, Math.min(6, (firm.score / 10) * 6)); positives.push(`Score público ${firm.score.toFixed(1)}`) }
    else unavailable.push('Score público no disponible')
    const compatibility = availableWeight > 0 ? Math.round((earned / availableWeight) * 100) : 50
    return [{ firm, compatibility: Math.max(0, Math.min(100, compatibility)), positives, negatives, unavailable, recommendedPlan }]
  }).sort((a, b) => b.compatibility - a.compatibility || (b.firm.score ?? 0) - (a.firm.score ?? 0)).slice(0, 5)
}

function marketLabel(market: string) {
  const labels: Record<string, string> = {
    cfd: 'CFD / Forex',
    futures: 'Futures',
    crypto: 'Crypto',
    options: 'Options',
  }
  return labels[market] ?? market
}
