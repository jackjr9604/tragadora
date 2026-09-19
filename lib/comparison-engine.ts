import { resolveAvailability, type AvailabilityRule, type AvailabilityStatus } from './platform-availability'

export type ComparisonPhase = {
  phaseNumber: number
  profitTarget: number | null
  dailyDrawdown: number | null
  maxDrawdown: number | null
  minTradingDays: number | null
  drawdownType: string | null
  drawdownBasis: string | null
}

export type ComparisonPlan = {
  id: string
  challengeId: string
  challengeName: string
  challengeType: string | null
  variantName: string | null
  size: number | null
  price: number | null
  currency: string | null
  steps: number | null
  phases: ComparisonPhase[]
  split: number | null
  rewardName: string | null
  payoutFrequency: string | null
  payoutDays: number | null
  rewardNames: string[]
}

export type ComparisonFirm = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  countryCode: string | null
  markets: string[]
  tradingPlatforms: string[]
  instruments: string[]
  payoutMethods: string[]
  availabilityRules: AvailabilityRule[]
  rules: { ea: boolean | null; news: boolean | null; weekend: boolean | null; copy: boolean | null; scalping: boolean | null }
  plans: ComparisonPlan[]
  evidence: { count: number; amount: number; lastAt: string | null } | null
  offer: string | null
}

export type { AvailabilityStatus } from './platform-availability'

export type ComparisonInsight = {
  type: 'match' | 'difference' | 'review'
  title: string
  description: string
  relatedMetric: string
  firmIds: string[]
  comparedPlanIds: string[]
}

export type Priority = 'price' | 'payout' | 'drawdown' | 'split' | 'platform' | 'rules'

export function findComparablePlans(firms: ComparisonFirm[], preferredSize: number | null = null, selectedPlanIds: string[] = []): { plans: Array<ComparisonPlan | null>; exact: boolean; notes: string[] } {
  // El mercado pertenece a la firma, no al plan; si no solapa, seguimos mostrando
  // la alternativa más cercana pero jamás la etiquetamos como equivalente.
  // Orden lexicográfico: tamaño, fases, tipo, distancia, precio conocido y clave estable.
  const first = firms[0]
  if (!first) return { plans: [], exact: false, notes: [] }
  const anchor = first.plans.find((plan) => plan.id === selectedPlanIds[0])
    ?? [...first.plans].sort((a, b) =>
      Number(b.size === preferredSize) - Number(a.size === preferredSize) ||
      Number(b.price !== null) - Number(a.price !== null) ||
      (a.currency ?? '').localeCompare(b.currency ?? '') ||
      (a.price ?? Infinity) - (b.price ?? Infinity) || (a.size ?? Infinity) - (b.size ?? Infinity) ||
      stablePlanOrder(a, b)
    )[0]
  if (!anchor) return { plans: firms.map(() => null), exact: false, notes: ['No encontramos planes activos para comparar.'] }
  const plans = firms.map((firm, index) => {
    const explicit = firm.plans.find((plan) => plan.id === selectedPlanIds[index])
    if (explicit) return explicit
    if (index === 0) return anchor
    return [...firm.plans].sort((a, b) => {
      const compare = (left: ComparisonPlan, right: ComparisonPlan) =>
        Number(left.size !== anchor.size) - Number(right.size !== anchor.size) ||
        Number(left.steps !== anchor.steps) - Number(right.steps !== anchor.steps) ||
        Number(left.challengeType !== anchor.challengeType) - Number(right.challengeType !== anchor.challengeType) ||
        Number(left.currency !== anchor.currency) - Number(right.currency !== anchor.currency) ||
        sizeDistance(left.size, anchor.size) - sizeDistance(right.size, anchor.size) ||
        Number(right.price !== null) - Number(left.price !== null) ||
        (left.price ?? Infinity) - (right.price ?? Infinity) || stablePlanOrder(left, right)
      return compare(a, b)
    })[0] ?? null
  })
  const notes = plans.flatMap((plan, index) => {
    if (!plan) return [`${firms[index].name}: no encontramos un plan comparable.`]
    if (index === 0) return []
    const differences = [
      !first.markets.length || !firms[index].markets.length ? 'mercado sin dato completo' :
        !firms[index].markets.some((market) => first.markets.includes(market)) ? 'estas firmas operan modelos/mercados diferentes' : null,
      plan.size === null || anchor.size === null ? 'tamaño sin dato completo' : plan.size !== anchor.size ? `tamaño ${formatSize(plan.size)} frente a ${formatSize(anchor.size)}` : null,
      plan.steps === null || anchor.steps === null ? 'fases sin dato completo' : plan.steps !== anchor.steps ? `${plan.steps} fases frente a ${anchor.steps}` : null,
      !plan.challengeType || !anchor.challengeType ? 'tipo de programa sin dato completo' : plan.challengeType !== anchor.challengeType ? 'tipo de programa distinto' : null,
      plan.currency !== anchor.currency ? 'moneda distinta o sin dato' : null,
    ].filter(Boolean)
    return differences.length ? [`${firms[index].name}: ${differences.join('; ')}.`] : []
  })
  return { plans, exact: firms.length > 1 && notes.length === 0 && plans.every(Boolean), notes }
}

function sizeDistance(size: number | null, anchor: number | null): number {
  return size === null || anchor === null ? Infinity : Math.abs(size - anchor)
}

function stablePlanOrder(a: ComparisonPlan, b: ComparisonPlan): number {
  return a.challengeName.localeCompare(b.challengeName) || (a.variantName ?? '').localeCompare(b.variantName ?? '') || a.id.localeCompare(b.id)
}

export function valuesDiffer(values: unknown[]): boolean {
  return new Set(values.map((value) => JSON.stringify(value ?? null))).size > 1
}

export function countryAvailability(firm: Pick<ComparisonFirm, 'id' | 'availabilityRules'>, countryCode: string, market: string | null = null): AvailabilityStatus {
  return resolveAvailability(firm.availabilityRules, firm.id, countryCode, market).status
}

export function evaluateComparisonPreferences(
  firms: ComparisonFirm[], plans: Array<ComparisonPlan | null>, index: number,
  criteria: { market: string; size: number | null; budget: number | null; platform: string; priorities: Priority[]; styles: Array<'ea' | 'news' | 'weekend'> }
): { matched: number; evaluable: number; details: Array<{ label: string; matches: boolean | null }> } {
  const firm = firms[index]
  const plan = plans[index]
  if (!firm) return { matched: 0, evaluable: 0, details: [] }
  const details: Array<{ label: string; matches: boolean | null }> = []
  const add = (label: string, matches: boolean | null) => details.push({ label, matches })
  if (criteria.market) add(`Mercado ${criteria.market}`, firm.markets.length ? firm.markets.includes(criteria.market) : null)
  if (criteria.size !== null) add(`Cuenta ${formatSize(criteria.size)}`, plan?.size === null || !plan ? null : plan.size === criteria.size)
  if (criteria.budget !== null) add('Dentro del presupuesto', plan?.price === null || !plan ? null : plan.price <= criteria.budget!)
  if (criteria.platform) add(`Plataforma ${criteria.platform}`, firm.tradingPlatforms.length ? firm.tradingPlatforms.includes(criteria.platform) : null)
  for (const style of criteria.styles) add(({ ea: 'EA / bots', news: 'Noticias', weekend: 'Weekend holding' })[style], firm.rules[style])
  for (const priority of criteria.priorities) {
    if (priority === 'platform') {
      if (!criteria.platform) add('Plataforma preferida no indicada', null)
      continue // Si se indicó, ya se evaluó arriba.
    }
    if (priority === 'price') {
      const known = plans.filter((item): item is ComparisonPlan => item?.price !== null && Boolean(item))
      const comparable = known.length === plans.length && known.every((item) => item.currency !== null) && new Set(known.map((item) => item.currency)).size === 1
      add('Menor precio conocido', comparable && plan?.price !== null && plan ? plan.price === Math.min(...known.map((item) => item.price!)) : null)
    }
    if (priority === 'payout') {
      const known = plans.flatMap((item) => item?.payoutDays === null || !item ? [] : [item.payoutDays])
      add('Menor mínimo de días registrado', known.length === plans.length && known.length > 1 && plan?.payoutDays !== null && plan ? plan.payoutDays === Math.min(...known) : null)
    }
    if (priority === 'split') {
      const known = plans.flatMap((item) => item?.split === null || !item ? [] : [item.split])
      add('Mayor profit split de la opción mostrada', known.length === plans.length && known.length > 1 && plan?.split !== null && plan ? plan.split === Math.max(...known) : null)
    }
    if (priority === 'drawdown') {
      const values = plans.map((item) => item?.phases.map((phase) => ({ max: phase.maxDrawdown, type: phase.drawdownType, basis: phase.drawdownBasis })) ?? [])
      const comparable = values.length > 1 && values.every((item) => item.length === values[0].length && item.every((phase) => phase.max !== null && phase.type && phase.basis)) &&
        values[0].every((phase, phaseIndex) => values.every((item) => item[phaseIndex].type === phase.type && item[phaseIndex].basis === phase.basis))
      add('Mayor límite mínimo de pérdida bajo la misma base', comparable ? Math.min(...values[index].map((phase) => phase.max!)) === Math.max(...values.map((item) => Math.min(...item.map((phase) => phase.max!)))) : null)
    }
    if (priority === 'rules') {
      const known = firms.map((item) => Object.values(item.rules).filter((value) => value !== null))
      add('Más permisos explícitos de firma', known.every((item) => item.length === 5) ? known[index].filter(Boolean).length === Math.max(...known.map((item) => item.filter(Boolean).length)) : null)
    }
  }
  return { matched: details.filter((item) => item.matches === true).length, evaluable: details.filter((item) => item.matches !== null).length, details }
}

export function buildComparisonInsights(firms: ComparisonFirm[], plans: Array<ComparisonPlan | null>, priorities: Priority[], platform: string | null): ComparisonInsight[] {
  const insights: ComparisonInsight[] = []
  const comparedPlanIds = plans.flatMap((plan) => plan ? [plan.id] : [])
  if (priorities.includes('price')) {
    const known = plans.flatMap((plan, index) => plan?.price === null || !plan ? [] : [{ index, price: plan.price, currency: plan.currency }])
    if (known.length === plans.length && known.every((item) => item.currency !== null) && new Set(known.map((item) => item.currency)).size === 1 && valuesDiffer(known.map((item) => item.price))) {
      const cheapest = [...known].sort((a, b) => a.price - b.price)[0]
      insights.push({ type: 'match', title: 'Precio del challenge', description: `${firms[cheapest.index].name} tiene el menor precio conocido entre estos planes. No incluye cargos no documentados.`, relatedMetric: 'price', firmIds: [firms[cheapest.index].id], comparedPlanIds })
    }
  }
  if (priorities.includes('platform') && platform) {
    const matches = firms.filter((firm) => firm.tradingPlatforms.some((name) => name.toLowerCase() === platform.toLowerCase()))
    if (matches.length) insights.push({ type: 'match', title: 'Plataforma solicitada', description: `${matches.map((firm) => firm.name).join(', ')} ${matches.length === 1 ? 'incluye' : 'incluyen'} ${platform} en los datos disponibles.`, relatedMetric: 'platform', firmIds: matches.map((firm) => firm.id), comparedPlanIds })
  }
  if (priorities.includes('drawdown')) {
    const values = plans.map((plan) => plan?.phases.map((phase) => `${phase.drawdownType ?? '?'}:${phase.drawdownBasis ?? '?'}`) ?? [])
    if (valuesDiffer(values)) insights.push({ type: 'review', title: 'Cómo se calcula el drawdown', description: 'Los tipos o bases de drawdown disponibles difieren. Revisa las reglas originales antes de comparar solo el porcentaje.', relatedMetric: 'drawdown', firmIds: firms.map((firm) => firm.id), comparedPlanIds })
  }
  if (priorities.includes('payout')) {
    const known = plans.flatMap((plan, index) => plan?.payoutDays === null || !plan ? [] : [{ index, days: plan.payoutDays }])
    if (known.length === plans.length && known.length > 1 && valuesDiffer(known.map((item) => item.days))) {
      const fastest = [...known].sort((a, b) => a.days - b.days)[0]
      insights.push({ type: 'match', title: 'Mínimo de días registrado', description: `${firms[fastest.index].name} registra el menor mínimo de días para la opción mostrada; verifica las condiciones y la fecha real del retiro.`, relatedMetric: 'payout', firmIds: [firms[fastest.index].id], comparedPlanIds })
    }
  }
  if (plans.some((plan) => !plan)) insights.push({ type: 'review', title: 'Plan no disponible', description: 'Al menos una firma no tiene un plan comparable en los datos actuales.', relatedMetric: 'plan', firmIds: firms.filter((_, index) => !plans[index]).map((firm) => firm.id), comparedPlanIds })
  if (plans.some((plan) => plan?.price === null || !plan)) insights.push({ type: 'review', title: 'Precios incompletos', description: 'No hay precio conocido para todos los planes; no interpretes un dato ausente como gratuito.', relatedMetric: 'price', firmIds: firms.filter((_, index) => plans[index]?.price === null || !plans[index]).map((firm) => firm.id), comparedPlanIds })
  return insights
}

export function formatSize(value: number | null): string { return value === null ? 'Sin dato' : `$${new Intl.NumberFormat('en-US').format(value)}` }
