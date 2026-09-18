import type { ComparisonPlan, Priority } from './comparison-engine'

export type MatchFirm = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  markets: string[]
  tradingPlatforms: string[]
  rules: { ea: boolean | null; news: boolean | null; weekend: boolean | null }
  plans: ComparisonPlan[]
}

export type MatchPreferences = {
  market: string
  size: number | null
  budget: number | null
  platform: string
  priorities: Priority[]
  styles: Array<'ea' | 'news' | 'weekend'>
}

export type MatchResult = {
  firm: Omit<MatchFirm, 'plans'>
  plan: ComparisonPlan
  matched: number
  evaluable: number
  reasons: string[]
  cautions: string[]
  requirementMisses: number
  requirementUnknowns: number
  exactSize: boolean
  knownRelevant: number
}

/** Catalog search is deliberately separate from findComparablePlans: each candidate is firm + specific plan. */
export function findMatchesForPreferences(firms: MatchFirm[], preferences: MatchPreferences, limit = 9): { results: MatchResult[]; hasExactRequirements: boolean } {
  const candidates: MatchResult[] = firms.flatMap((firm) => firm.plans.map((plan) => {
    const reasons: string[] = []
    const cautions: string[] = []
    let requirementMisses = 0
    let requirementUnknowns = 0
    let knownRelevant = 0
    if (preferences.market) {
      if (!firm.markets.length) { requirementUnknowns++; cautions.push('Mercado sin dato confirmado.') }
      else if (firm.markets.includes(preferences.market)) { reasons.push(`Opera ${preferences.market.toUpperCase()}.`); knownRelevant++ }
      else { requirementMisses++; cautions.push(`Mercado diferente: ${firm.markets.join(', ')} en lugar de ${preferences.market}.`) }
    }
    const exactSize = preferences.size === null || plan.size === preferences.size
    if (preferences.size !== null) {
      if (plan.size === null) { requirementUnknowns++; cautions.push('Tamaño de cuenta sin dato.') }
      else if (exactSize) { reasons.push(`Plan de ${formatSize(plan.size)}, exactamente el tamaño solicitado.`); knownRelevant++ }
      else cautions.push(`El plan más cercano disponible aquí es ${formatSize(plan.size)}, no ${formatSize(preferences.size)}.`)
    }
    if (preferences.budget !== null) {
      if (plan.price === null || plan.currency === null) { requirementUnknowns++; cautions.push('Precio o moneda sin dato: presupuesto no verificable.') }
      else if (plan.currency !== 'USD') { requirementUnknowns++; cautions.push(`El precio está en ${plan.currency}; no convertimos monedas para evaluar tu presupuesto en USD.`) }
      else if (plan.price <= preferences.budget) { reasons.push(`Precio USD ${formatNumber(plan.price)} dentro de tu presupuesto.`); knownRelevant++ }
      else { requirementMisses++; cautions.push(`Precio USD ${formatNumber(plan.price)} supera tu máximo de USD ${formatNumber(preferences.budget)}.`) }
    }
    let matched = 0
    let evaluable = 0
    if (preferences.priorities.includes('payout')) {
      if (plan.payoutDays === null) cautions.push('Sin mínimo de días de payout documentado para la opción mostrada.')
      else {
        evaluable++; knownRelevant++
        if (plan.payoutDays <= 7) { matched++; reasons.push(`La opción ${plan.rewardName ?? 'del plan'} registra mínimo de ${plan.payoutDays} días (criterio rápido: hasta 7).`) }
        else cautions.push(`La opción mostrada registra un mínimo de ${plan.payoutDays} días, superior a 7.`)
      }
    }
    if (preferences.priorities.includes('platform')) {
      if (!preferences.platform) cautions.push('No seleccionaste una plataforma concreta para evaluar esta prioridad.')
      else if (!firm.tradingPlatforms.length) cautions.push(`Sin dato de compatibilidad con ${preferences.platform}.`)
      else { evaluable++; knownRelevant++; if (firm.tradingPlatforms.some((name) => name.toLowerCase() === preferences.platform.toLowerCase())) { matched++; reasons.push(`${preferences.platform} figura entre sus plataformas registradas.`) } else cautions.push(`${preferences.platform} no figura entre sus plataformas registradas.`) }
    }
    for (const style of preferences.styles) {
      const label = { ea: 'EA / bots', news: 'Noticias', weekend: 'Weekend holding' }[style]
      const value = firm.rules[style]
      if (value === null) cautions.push(`Sin dato suficiente sobre ${label}.`)
      else { evaluable++; knownRelevant++; if (value) { matched++; reasons.push(`${label} figura como permitido para la firma.`) } else cautions.push(`${label} figura como no permitido para la firma.`) }
    }
    if (preferences.priorities.includes('drawdown')) {
      const known = plan.phases.filter((phase) => phase.maxDrawdown !== null || phase.dailyDrawdown !== null)
      const detail = known.map((phase) => `F${phase.phaseNumber}: daily ${phase.dailyDrawdown ?? 'sin dato'}%, max ${phase.maxDrawdown ?? 'sin dato'}%, ${phase.drawdownType ?? 'tipo sin dato'} / ${phase.drawdownBasis ?? 'base sin dato'}`).join('; ')
      cautions.push(detail ? `Drawdown para revisar: ${detail}. No se cuenta como coincidencia sin una base de comparación segura.` : 'Drawdown sin datos estructurados suficientes; no se cuenta como coincidencia.')
    }
    if (preferences.priorities.includes('rules')) cautions.push('La simplicidad de reglas no tiene un indicador estructurado seguro; no se cuenta como coincidencia.')
    return {
      firm: { id: firm.id, slug: firm.slug, name: firm.name, logoUrl: firm.logoUrl, markets: firm.markets, tradingPlatforms: firm.tradingPlatforms, rules: firm.rules },
      plan, matched, evaluable, reasons, cautions, requirementMisses, requirementUnknowns, exactSize, knownRelevant,
    }
  }))
  if (!candidates.length) return { results: [], hasExactRequirements: false }
  const exactCandidates = candidates.filter((item) => item.requirementMisses === 0 && item.requirementUnknowns === 0 && item.exactSize)
  const comparisonPool = exactCandidates.length ? exactCandidates : candidates
  for (const candidate of candidates) {
    if (preferences.priorities.includes('price')) {
      const peers = comparisonPool.filter((item) => item.plan.price !== null && item.plan.currency !== null && item.plan.currency === candidate.plan.currency && (preferences.size === null || item.plan.size === candidate.plan.size))
      if (candidate.plan.price === null || candidate.plan.currency === null || peers.length < 2) candidate.cautions.push('Precio bajo: faltan precios comparables en la misma moneda y tamaño.')
      else {
        candidate.evaluable++; candidate.knownRelevant++
        const minimum = Math.min(...peers.map((item) => item.plan.price!))
        if (candidate.plan.price === minimum) { candidate.matched++; candidate.reasons.push(`Precio ${candidate.plan.currency} ${formatNumber(minimum)}: el menor entre planes comparables del catálogo.`) }
        else candidate.cautions.push(`Hay un plan comparable con menor precio conocido en ${candidate.plan.currency}.`)
      }
    }
    if (preferences.priorities.includes('split')) {
      const peers = comparisonPool.filter((item) => item.plan.split !== null && (preferences.size === null || item.plan.size === candidate.plan.size))
      if (candidate.plan.split === null || peers.length < 2) candidate.cautions.push('Profit split: faltan opciones comparables documentadas.')
      else {
        candidate.evaluable++; candidate.knownRelevant++
        const maximum = Math.max(...peers.map((item) => item.plan.split!))
        if (candidate.plan.split === maximum) { candidate.matched++; candidate.reasons.push(`Split ${maximum}% de la opción ${candidate.plan.rewardName ?? 'mostrada'}: el mayor conocido entre planes comparables.`) }
        else candidate.cautions.push(`La opción mostrada registra split ${candidate.plan.split}%; hay uno mayor entre planes comparables.`)
      }
    }
  }
  // Elegir el plan más explicable de cada firma; nunca llenar la shortlist con variantes de una sola firma.
  candidates.sort((a, b) =>
    a.requirementMisses - b.requirementMisses || a.requirementUnknowns - b.requirementUnknowns || Number(b.exactSize) - Number(a.exactSize) ||
    b.matched - a.matched || b.evaluable - a.evaluable || b.knownRelevant - a.knownRelevant ||
    (preferences.size === null ? 0 : sizeDistance(a.plan.size, preferences.size) - sizeDistance(b.plan.size, preferences.size)) ||
    (preferences.priorities.includes('price') && a.plan.currency === b.plan.currency ? (a.plan.price ?? Infinity) - (b.plan.price ?? Infinity) : 0) ||
    a.firm.slug.localeCompare(b.firm.slug) || a.plan.id.localeCompare(b.plan.id)
  )
  const seen = new Set<string>()
  const results = candidates.filter((item) => { if (seen.has(item.firm.id)) return false; seen.add(item.firm.id); return true }).slice(0, limit)
  return { results, hasExactRequirements: exactCandidates.length > 0 }
}

function sizeDistance(value: number | null, preferred: number) { return value === null ? Infinity : Math.abs(value - preferred) }
function formatNumber(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) }
function formatSize(value: number | null) { return value === null ? 'Sin dato' : `$${formatNumber(value)}` }
