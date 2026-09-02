export type Challenge = {
  id: string
  platform_id?: string
  name: string
  challenge_type?: string | null
  phases?: number | null
  status?: string | null
}

export type ChallengePhase = {
  id: string
  challenge_id: string
  phase_number: number
  name: string | null
  profit_target: number | null
  daily_drawdown: number | null
  max_drawdown: number | null
  min_trading_days: number | null
  max_trading_days: number | null
  min_profitable_days: number | null
  drawdown_type: string | null
  drawdown_basis: string | null
  notes: string | null
}

export type ChallengeVariant = {
  id: string
  challenge_id: string
  name: string
  slug: string
  profit_split: number | null
  price_modifier: number | null
  payout_frequency: string | null
  notes: string | null
  status: boolean
}

export type ChallengeVariantPhase = {
  id: string
  variant_id: string
  phase_number: number
  profit_target: number | null
  daily_drawdown: number | null
  max_drawdown: number | null
  min_trading_days: number | null
  min_profitable_days: number | null
  drawdown_type: string | null
  drawdown_basis: string | null
  notes: string | null
}

export type ChallengeRewardOption = {
  id: string
  challenge_id: string
  variant_id: string | null
  name: string
  profit_split: number | null
  payout_frequency: string | null
  minimum_payout_days: number | null
  minimum_profitable_days: number | null
  profitable_day_threshold_pct: number | null
  consistency_rule_pct: number | null
  notes: string | null
  status: boolean
  sort_order: number
  source_url: string | null
  effective_from: string | null
  effective_to: string | null
}

export type AccountPlan = {
  id: string
  challenge_id: string
  variant_id: string | null
  account_size: number | null
  price: number | null
  currency: string | null
  profit_target: number | null
  daily_drawdown: number | null
  max_drawdown: number | null
  profit_split: number | null
  min_trading_days: number | null
  max_trading_days: number | null
  payout_frequency: string | null
}

export type EffectivePhase = {
  phaseNumber: number
  name: string | null
  profitTarget: number | null
  dailyDrawdown: number | null
  maxDrawdown: number | null
  minTradingDays: number | null
  maxTradingDays: number | null
  minProfitableDays: number | null
  drawdownType: string | null
  drawdownBasis: string | null
  notes: string | null
  source: 'normalized' | 'legacy'
}

export type ResolvedPlan = AccountPlan & {
  effectivePhases: EffectivePhase[]
  rewardOptions: ChallengeRewardOption[]
  effectiveProfitSplit: number | null
  effectivePayoutFrequency: string | null
}

export type ResolvedVariant = ChallengeVariant & {
  overrides: ChallengeVariantPhase[]
  effectivePhases: EffectivePhase[]
  rewardOptions: ChallengeRewardOption[]
  rewardOptionsSource: 'specific' | 'inherited' | 'none'
  plans: ResolvedPlan[]
}

export type ResolvedChallenge = {
  challenge: Challenge
  basePhases: EffectivePhase[]
  basePlans: ResolvedPlan[]
  generalRewardOptions: ChallengeRewardOption[]
  variants: ResolvedVariant[]
  hasNormalizedPhases: boolean
}

export type ResolveChallengeInput = {
  challenge: Challenge
  phases: ChallengePhase[]
  variants: ChallengeVariant[]
  variantPhases: ChallengeVariantPhase[]
  plans: AccountPlan[]
  rewardOptions?: ChallengeRewardOption[]
  now?: Date | string
}

export function resolveChallenge(input: ResolveChallengeInput): ResolvedChallenge {
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? Date.now())
  const rewardOptions = (input.rewardOptions ?? [])
    .filter((option) => option.challenge_id === input.challenge.id && isVisibleRewardOption(option, now))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const generalRewardOptions = rewardOptions.filter((option) => option.variant_id === null)
  const normalizedPhases = input.phases
    .filter((phase) => phase.challenge_id === input.challenge.id)
    .sort((a, b) => a.phase_number - b.phase_number)
    .map(toEffectivePhase)
  const hasNormalizedPhases = normalizedPhases.length > 0
  const challengePlans = input.plans.filter((plan) => plan.challenge_id === input.challenge.id)
  const basePlans = challengePlans
    .filter((plan) => plan.variant_id === null)
    .map((plan) => resolvePlan(plan, null, normalizedPhases, hasNormalizedPhases, generalRewardOptions))
  const variants = input.variants
    .filter((variant) => variant.challenge_id === input.challenge.id)
    .map((variant) => {
      const overrides = input.variantPhases
        .filter((override) => override.variant_id === variant.id)
        .sort((a, b) => a.phase_number - b.phase_number)
      const effectivePhases = normalizedPhases.map((phase) => applyVariantOverride(
        phase,
        overrides.find((override) => override.phase_number === phase.phaseNumber)
      ))
      const specificRewardOptions = rewardOptions.filter((option) => option.variant_id === variant.id)
      const applicableRewardOptions = specificRewardOptions.length ? specificRewardOptions : generalRewardOptions
      const plans = challengePlans
        .filter((plan) => plan.variant_id === variant.id)
        .map((plan) => resolvePlan(plan, variant, effectivePhases, hasNormalizedPhases, applicableRewardOptions))
      return {
        ...variant,
        overrides,
        effectivePhases,
        rewardOptions: applicableRewardOptions,
        rewardOptionsSource: specificRewardOptions.length
          ? 'specific' as const
          : generalRewardOptions.length
            ? 'inherited' as const
            : 'none' as const,
        plans,
      }
    })

  return {
    challenge: input.challenge,
    basePhases: normalizedPhases,
    basePlans,
    generalRewardOptions,
    variants,
    hasNormalizedPhases,
  }
}

export function conservativeMaxDrawdown(phases: EffectivePhase[]): number | null {
  // El mínimo representa la restricción más exigente que enfrentará el trader.
  const values = phases.flatMap((phase) => phase.maxDrawdown === null ? [] : [phase.maxDrawdown])
  return values.length ? Math.min(...values) : null
}

function resolvePlan(
  plan: AccountPlan,
  variant: ChallengeVariant | null,
  phases: EffectivePhase[],
  normalized: boolean,
  rewardOptions: ChallengeRewardOption[]
): ResolvedPlan {
  const rewardSplits = rewardOptions.flatMap((option) => option.profit_split === null ? [] : [Number(option.profit_split)])
  const rewardPayoutFrequency = rewardOptions.find((option) => option.payout_frequency)?.payout_frequency ?? null
  return {
    ...plan,
    effectivePhases: normalized ? phases : [legacyPhase(plan)],
    rewardOptions,
    effectiveProfitSplit: rewardSplits.length
      ? Math.max(...rewardSplits)
      : variant?.profit_split ?? plan.profit_split,
    effectivePayoutFrequency: rewardPayoutFrequency ?? variant?.payout_frequency ?? plan.payout_frequency,
  }
}

function isVisibleRewardOption(option: ChallengeRewardOption, now: Date) {
  if (!option.status) return false
  if (option.effective_from && new Date(option.effective_from) > now) return false
  if (option.effective_to && new Date(option.effective_to) <= now) return false
  return true
}

function toEffectivePhase(phase: ChallengePhase): EffectivePhase {
  return {
    phaseNumber: phase.phase_number,
    name: phase.name,
    profitTarget: numberOrNull(phase.profit_target),
    dailyDrawdown: numberOrNull(phase.daily_drawdown),
    maxDrawdown: numberOrNull(phase.max_drawdown),
    minTradingDays: numberOrNull(phase.min_trading_days),
    maxTradingDays: numberOrNull(phase.max_trading_days),
    minProfitableDays: numberOrNull(phase.min_profitable_days),
    drawdownType: phase.drawdown_type,
    drawdownBasis: phase.drawdown_basis,
    notes: phase.notes,
    source: 'normalized',
  }
}

function applyVariantOverride(base: EffectivePhase, override?: ChallengeVariantPhase): EffectivePhase {
  if (!override) return { ...base }
  return {
    ...base,
    profitTarget: numberOrNull(override.profit_target) ?? base.profitTarget,
    dailyDrawdown: numberOrNull(override.daily_drawdown) ?? base.dailyDrawdown,
    maxDrawdown: numberOrNull(override.max_drawdown) ?? base.maxDrawdown,
    minTradingDays: numberOrNull(override.min_trading_days) ?? base.minTradingDays,
    minProfitableDays: numberOrNull(override.min_profitable_days) ?? base.minProfitableDays,
    drawdownType: override.drawdown_type ?? base.drawdownType,
    drawdownBasis: override.drawdown_basis ?? base.drawdownBasis,
    notes: override.notes ?? base.notes,
  }
}

function legacyPhase(plan: AccountPlan): EffectivePhase {
  return {
    phaseNumber: 1,
    name: 'Reglas legacy del plan',
    profitTarget: numberOrNull(plan.profit_target),
    dailyDrawdown: numberOrNull(plan.daily_drawdown),
    maxDrawdown: numberOrNull(plan.max_drawdown),
    minTradingDays: numberOrNull(plan.min_trading_days),
    maxTradingDays: numberOrNull(plan.max_trading_days),
    minProfitableDays: null,
    drawdownType: null,
    drawdownBasis: null,
    notes: null,
    source: 'legacy',
  }
}

function numberOrNull(value: number | null) {
  return value === null ? null : Number(value)
}
