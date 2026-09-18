import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveChallenge, type AccountPlan, type ChallengePhase, type ChallengeRewardOption, type ChallengeVariant, type ChallengeVariantPhase } from '@/lib/challenge-resolver'
import type { ComparisonFirm, ComparisonPlan } from '@/lib/comparison-engine'
import type { MatchFirm } from '@/lib/preference-matches'

export type FirmChoice = { id: string; slug: string; name: string; logoUrl: string | null; markets: string[] }

function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value }
function numeric(value: unknown): number | null { return value === null || value === undefined || value === '' ? null : Number(value) }

type ChallengeRow = { id: string; name: string; challenge_type: string | null; phases: number | null; status: string | null }
type PlanCatalog = { plans: AccountPlan[]; phases: ChallengePhase[]; variants: ChallengeVariant[]; overrides: ChallengeVariantPhase[]; rewards: ChallengeRewardOption[]; now: string }

function resolvedPlanRows(challenge: ChallengeRow, catalog: PlanCatalog): ComparisonPlan[] {
  const resolved = resolveChallenge({ challenge, plans: catalog.plans, phases: catalog.phases, variants: catalog.variants, variantPhases: catalog.overrides, rewardOptions: catalog.rewards, now: catalog.now })
  const mapPlan = (plan: (typeof resolved.basePlans)[number], variantName: string | null): ComparisonPlan => ({
    // Los tres campos de payout pertenecen a la misma opción, no al máximo de opciones diferentes.
    id: plan.id, challengeId: challenge.id, challengeName: challenge.name, challengeType: challenge.challenge_type,
    variantName, size: numeric(plan.account_size), price: numeric(plan.price), currency: plan.currency,
    steps: challenge.phases ?? (plan.effectivePhases.length || null),
    phases: plan.effectivePhases.map((phase) => ({
      phaseNumber: phase.phaseNumber, profitTarget: phase.profitTarget, dailyDrawdown: phase.dailyDrawdown,
      maxDrawdown: phase.maxDrawdown, minTradingDays: phase.minTradingDays,
      drawdownType: phase.drawdownType, drawdownBasis: phase.drawdownBasis,
    })),
    rewardName: plan.rewardOptions[0]?.name ?? null,
    split: plan.rewardOptions.length ? numeric(plan.rewardOptions[0].profit_split) : numeric(plan.effectiveProfitSplit),
    payoutFrequency: plan.rewardOptions.length ? plan.rewardOptions[0].payout_frequency : plan.effectivePayoutFrequency,
    payoutDays: plan.rewardOptions.length ? numeric(plan.rewardOptions[0].minimum_payout_days) : null,
    rewardNames: plan.rewardOptions.map((option) => option.name),
  })
  return [...resolved.basePlans.map((plan) => mapPlan(plan, null)), ...resolved.variants.flatMap((variant) => variant.plans.map((plan) => mapPlan(plan, variant.name)))]
}

export async function getComparisonData(slugs: string[]): Promise<{ choices: FirmChoice[]; firms: ComparisonFirm[] }> {
  const db = createAdminClient()
  const [platformResult, marketResult] = await Promise.all([
    db.from('platforms').select('id, slug, name, logo_url, origin_country_code, media:logo_media_id(file_url, alt_text)').eq('type', 'prop_firm').eq('status', 'active').order('name'),
    db.from('platform_markets').select('platform_id, market'),
  ])
  if (platformResult.error || marketResult.error) throw new Error(platformResult.error?.message ?? marketResult.error?.message)
  const marketMap = new Map<string, string[]>()
  for (const row of marketResult.data ?? []) marketMap.set(row.platform_id, [...(marketMap.get(row.platform_id) ?? []), row.market])
  const platforms = platformResult.data ?? []
  const choices = platforms.map((row) => ({ id: row.id, slug: row.slug, name: row.name, logoUrl: first(row.media)?.file_url ?? row.logo_url ?? null, markets: marketMap.get(row.id) ?? [] }))
  const selected = slugs.map((slug) => platforms.find((row) => row.slug === slug)).filter((row): row is (typeof platforms)[number] => Boolean(row)).slice(0, 3)
  if (!selected.length) return { choices, firms: [] }
  const ids = selected.map((row) => row.id)
  const [detail, challenges, availability, trading, instruments, methods, offers, evidence] = await Promise.all([
    db.from('prop_firm_details').select('platform_id, supports_ea, allows_news_trading, allows_weekend_holding, allows_copy_trading, allows_scalping').in('platform_id', ids),
    db.from('challenges').select('id, platform_id, name, challenge_type, phases, status').in('platform_id', ids).eq('status', 'active'),
    db.from('platform_availability').select('platform_id, country_code, status').in('platform_id', ids),
    db.from('platform_trading_platforms').select('platform_id, catalog:trading_platform_id(name)').in('platform_id', ids),
    db.from('platform_instruments').select('platform_id, catalog:instrument_category_id(name)').in('platform_id', ids),
    db.from('platform_transaction_methods').select('platform_id, supports_payout, catalog:transaction_method_id(name)').in('platform_id', ids),
    db.from('offers').select('platform_id, title, status, starts_at, expires_at').in('platform_id', ids).eq('status', true),
    db.from('platform_payout_period_summary').select('platform_id, verified_payout_count, verified_amount, verified_last_payout_at').in('platform_id', ids).eq('period_key', 'all'),
  ])
  const results = [detail, challenges, availability, trading, instruments, methods, offers, evidence]
  const failure = results.find((result) => result.error)
  if (failure?.error) throw new Error(failure.error.message)
  const challengeRows = challenges.data ?? []
  const challengeIds = challengeRows.map((row) => row.id)
  const [plans, phases, variants, rewards] = challengeIds.length ? await Promise.all([
    db.from('account_plans').select('*').in('challenge_id', challengeIds),
    db.from('challenge_phases').select('*').in('challenge_id', challengeIds),
    db.from('challenge_variants').select('*').in('challenge_id', challengeIds).eq('status', true),
    db.from('challenge_reward_options').select('*').in('challenge_id', challengeIds).eq('status', true),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  const normalizedFailure = [plans, phases, variants, rewards].find((result) => result.error)
  if (normalizedFailure?.error) throw new Error(normalizedFailure.error.message)
  const variantIds = (variants.data ?? []).map((row) => row.id)
  const overrides = variantIds.length ? await db.from('challenge_variant_phases').select('*').in('variant_id', variantIds) : { data: [], error: null }
  if (overrides.error) throw new Error(overrides.error.message)
  const now = new Date().toISOString()
  const catalog: PlanCatalog = { plans: (plans.data ?? []) as AccountPlan[], phases: (phases.data ?? []) as ChallengePhase[], variants: (variants.data ?? []) as ChallengeVariant[], overrides: (overrides.data ?? []) as ChallengeVariantPhase[], rewards: (rewards.data ?? []) as ChallengeRewardOption[], now }
  const firms: ComparisonFirm[] = selected.map((row) => {
    const record = detail.data?.find((item) => item.platform_id === row.id)
    const planRows = challengeRows.filter((challenge) => challenge.platform_id === row.id).flatMap((challenge) => resolvedPlanRows(challenge, catalog))
    const evidenceRow = evidence.data?.find((item) => item.platform_id === row.id && Number(item.verified_payout_count) > 0)
    const activeOffer = offers.data?.find((offer) => offer.platform_id === row.id && (!offer.starts_at || offer.starts_at <= now) && (!offer.expires_at || offer.expires_at > now))
    const names = <T extends { platform_id: string; catalog: { name: string } | Array<{ name: string }> | null }>(items: T[]) => items.filter((item) => item.platform_id === row.id).flatMap((item) => first(item.catalog)?.name ? [first(item.catalog)!.name] : [])
    return {
      id: row.id, slug: row.slug, name: row.name, logoUrl: first(row.media)?.file_url ?? row.logo_url ?? null,
      countryCode: row.origin_country_code, markets: marketMap.get(row.id) ?? [],
      tradingPlatforms: names(trading.data ?? []), instruments: names(instruments.data ?? []),
      payoutMethods: names((methods.data ?? []).filter((item) => item.supports_payout)),
      restrictions: (availability.data ?? []).filter((item) => item.platform_id === row.id && item.status === 'restricted').map((item) => item.country_code),
      rules: { ea: record?.supports_ea ?? null, news: record?.allows_news_trading ?? null, weekend: record?.allows_weekend_holding ?? null, copy: record?.allows_copy_trading ?? null, scalping: record?.allows_scalping ?? null },
      plans: planRows,
      evidence: evidenceRow ? { count: Number(evidenceRow.verified_payout_count), amount: Number(evidenceRow.verified_amount), lastAt: evidenceRow.verified_last_payout_at } : null,
      offer: activeOffer?.title ?? null,
    }
  })
  return { choices, firms }
}

export async function getComparisonFilterOptions(choices: FirmChoice[]): Promise<{ sizes: number[]; platforms: string[] }> {
  if (!choices.length) return { sizes: [], platforms: [] }
  const db = createAdminClient()
  const [challenges, platforms] = await Promise.all([
    db.from('challenges').select('id').in('platform_id', choices.map((item) => item.id)).eq('status', 'active'),
    db.from('trading_platforms').select('name').eq('status', true),
  ])
  if (challenges.error || platforms.error) throw new Error(challenges.error?.message ?? platforms.error?.message)
  const ids = (challenges.data ?? []).map((item) => item.id)
  const plans = ids.length ? await db.from('account_plans').select('account_size').in('challenge_id', ids) : { data: [], error: null }
  if (plans.error) throw new Error(plans.error.message)
  return {
    sizes: [...new Set((plans.data ?? []).flatMap((item) => numeric(item.account_size) === null ? [] : [Number(item.account_size)]))].sort((a, b) => a - b),
    platforms: [...new Set((platforms.data ?? []).map((item) => item.name))].sort(),
  }
}

/** Solo catálogo público activo: sin offers, payout evidence, métricas externas ni afiliados. */
export async function getMatchCatalog(choices: FirmChoice[]): Promise<MatchFirm[]> {
  if (!choices.length) return []
  const db = createAdminClient()
  const ids = choices.map((item) => item.id)
  const [details, challenges, trading] = await Promise.all([
    db.from('prop_firm_details').select('platform_id, supports_ea, allows_news_trading, allows_weekend_holding').in('platform_id', ids),
    db.from('challenges').select('id, platform_id, name, challenge_type, phases, status').in('platform_id', ids).eq('status', 'active'),
    db.from('platform_trading_platforms').select('platform_id, catalog:trading_platform_id(name)').in('platform_id', ids),
  ])
  const failure = [details, challenges, trading].find((result) => result.error)
  if (failure?.error) throw new Error(failure.error.message)
  const challengeRows = challenges.data ?? []
  const challengeIds = challengeRows.map((item) => item.id)
  if (!challengeIds.length) return []
  const [plans, phases, variants, rewards] = await Promise.all([
    db.from('account_plans').select('*').in('challenge_id', challengeIds),
    db.from('challenge_phases').select('*').in('challenge_id', challengeIds),
    db.from('challenge_variants').select('*').in('challenge_id', challengeIds).eq('status', true),
    db.from('challenge_reward_options').select('*').in('challenge_id', challengeIds).eq('status', true),
  ])
  const normalizedFailure = [plans, phases, variants, rewards].find((result) => result.error)
  if (normalizedFailure?.error) throw new Error(normalizedFailure.error.message)
  const variantIds = (variants.data ?? []).map((item) => item.id)
  const overrides = variantIds.length ? await db.from('challenge_variant_phases').select('*').in('variant_id', variantIds) : { data: [], error: null }
  if (overrides.error) throw new Error(overrides.error.message)
  const catalog: PlanCatalog = {
    plans: (plans.data ?? []) as AccountPlan[], phases: (phases.data ?? []) as ChallengePhase[],
    variants: (variants.data ?? []) as ChallengeVariant[], overrides: (overrides.data ?? []) as ChallengeVariantPhase[],
    rewards: (rewards.data ?? []) as ChallengeRewardOption[], now: new Date().toISOString(),
  }
  return choices.map((choice) => {
    const record = details.data?.find((item) => item.platform_id === choice.id)
    return {
      id: choice.id, slug: choice.slug, name: choice.name, logoUrl: choice.logoUrl, markets: choice.markets,
      tradingPlatforms: (trading.data ?? []).filter((item) => item.platform_id === choice.id).flatMap((item) => first(item.catalog)?.name ? [first(item.catalog)!.name] : []),
      rules: { ea: record?.supports_ea ?? null, news: record?.allows_news_trading ?? null, weekend: record?.allows_weekend_holding ?? null },
      plans: challengeRows.filter((challenge) => challenge.platform_id === choice.id).flatMap((challenge) => resolvedPlanRows(challenge, catalog)),
    }
  }).filter((item) => item.plans.length > 0)
}
