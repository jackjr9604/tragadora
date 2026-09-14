import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { visibleBrandText } from '@/lib/public-language'
import { classifyPayoutVerification, type RecommendableFirm } from '@/lib/prop-firm-recommender'
import { conservativeMaxDrawdown, resolveChallenge, type AccountPlan, type ChallengePhase, type ChallengeRewardOption, type ChallengeVariant, type ChallengeVariantPhase } from '@/lib/challenge-resolver'

export type HomePlatform = {
  id: string
  name: string
  slug: string
  score: number | null
  logoUrl: string | null
  logoAlt: string | null
  description: string | null
  profitSplit: number | null
  supportsEa: boolean | null
  allowsNews: boolean | null
  allowsWeekend: boolean | null
  allowsScalping: boolean | null
  allowsDayTrading: boolean | null
  allowsCopyTrading: boolean | null
  markets: string[]
}

export type HomeOffer = {
  id: string
  title: string
  description: string | null
  discountValue: number
  discountType: string
  promoCode: string | null
  expiresAt: string | null
  affiliateLinkId: string | null
  countryCode: string | null
  platform: HomePlatform
}

export type HomePayout = {
  id: string
  amount: number
  payoutDate: string
  sourceUrl: string | null
  externalId: string | null
  platform: HomePlatform | null
  sourceName: string | null
  verification: string | null
}

export type FirmPayoutStat = {
  platform: HomePlatform
  total: number
  count: number
}

export type PublicCountry = { code: string; name: string }

type PayoutRow = {
  amount: number | string | null
  payout_date: string
}

function first<T>(value: T[] | T | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function getHomeDataUncached(language = 'es', countryCode?: string | null) {
  const supabase = createAdminClient()
  const now = new Date()

  const [platformResult, detailResult, translationResult, sourceResult, challengeResult, availabilityResult, countryResult, marketResult] =
    await Promise.all([
      supabase
        .from('platforms')
        .select(`
          id, name, slug, score, logo_media_id,
          media:logo_media_id (file_url, alt_text)
        `)
        .eq('type', 'prop_firm')
        .eq('status', 'active')
        .order('score', { ascending: false, nullsFirst: false }),
      supabase
        .from('prop_firm_details')
        .select(`
          platform_id, profit_split_max, supports_ea,
          allows_news_trading, allows_weekend_holding,
          allows_scalping, allows_day_trading, allows_copy_trading
        `),
      supabase
        .from('platform_translations')
        .select('platform_id, language, short_description')
        .in('language', language === 'es' ? ['es'] : ['es', language]),
      supabase
        .from('payout_sources')
        .select('id, platform_id, name, source_type, config')
        .eq('status', true),
      supabase.from('challenges').select('id, platform_id, name, challenge_type, phases, status').eq('status', 'active'),
      supabase.from('platform_availability').select('*'),
      supabase.from('countries').select('*'),
      supabase.from('platform_markets').select('platform_id, market'),
    ])

  const details = new Map(
    (detailResult.data ?? []).map((item) => [item.platform_id, item])
  )
  const translations = new Map<string, { short_description: string | null }>()
  for (const item of translationResult.data ?? []) {
    const current = translations.get(item.platform_id)
    if (!current || item.language === language) translations.set(item.platform_id, item)
  }
  const marketsByPlatform = new Map<string, string[]>()
  for (const item of marketResult.data ?? []) {
    const current = marketsByPlatform.get(item.platform_id) ?? []
    current.push(item.market)
    marketsByPlatform.set(item.platform_id, current)
  }

  const platforms: HomePlatform[] = (platformResult.data ?? []).map((row) => {
    const media = first(row.media)
    const detail = details.get(row.id)
    const translation = translations.get(row.id)

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      score: row.score === null ? null : Number(row.score),
      logoUrl: media?.file_url ?? null,
      logoAlt: media?.alt_text ?? null,
      description: translation?.short_description ?? null,
      profitSplit:
        detail?.profit_split_max === null ||
        detail?.profit_split_max === undefined
          ? null
          : Number(detail.profit_split_max),
      supportsEa: detail?.supports_ea ?? null,
      allowsNews: detail?.allows_news_trading ?? null,
      allowsWeekend: detail?.allows_weekend_holding ?? null,
      allowsScalping: detail?.allows_scalping ?? null,
      allowsDayTrading: detail?.allows_day_trading ?? null,
      allowsCopyTrading: detail?.allows_copy_trading ?? null,
      markets: marketsByPlatform.get(row.id) ?? [],
    }
  })
  const platformMap = new Map(platforms.map((platform) => [platform.id, platform]))
  const sources = sourceResult.data ?? []
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  const challenges = challengeResult.data ?? []
  const challengeIds = challenges.map((challenge) => challenge.id)
  const visibleAt = now.toISOString()
  const recentWindowStart = new Date(now.getTime() - 36 * 60 * 60 * 1_000).toISOString()
  const payoutDataPromise = Promise.all([
    supabase.from('payout_source_summary').select('platform_id, payout_count, payout_amount'),
    supabase.from('payouts').select('amount, payout_date').gte('payout_date', recentWindowStart),
    supabase.from('payouts').select('amount').order('amount', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('payouts').select(`
        id, amount, payout_date, source_url, external_id,
        platform_id, payout_source_id, verification_status
      `).order('payout_date', { ascending: false }).limit(16),
    supabase.from('offers').select(`
        id, platform_id, challenge_id, title, description, discount_value,
        discount_type, promo_code, expires_at, starts_at,
        language, country_code, status, priority, affiliate_link_id
      `).eq('status', true).order('priority', { ascending: true }).limit(24),
  ])
  const [planResult, phaseResult, variantResult, rewardResult] = challengeIds.length ? await Promise.all([
    supabase.from('account_plans').select('*').in('challenge_id', challengeIds),
    supabase.from('challenge_phases').select('*').in('challenge_id', challengeIds).order('phase_number'),
    supabase.from('challenge_variants').select('*').in('challenge_id', challengeIds).eq('status', true),
    supabase.from('challenge_reward_options').select('*').in('challenge_id', challengeIds).eq('status', true)
      .or(`effective_from.is.null,effective_from.lte.${visibleAt}`)
      .or(`effective_to.is.null,effective_to.gt.${visibleAt}`)
      .order('sort_order'),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  const challengeDataError = planResult.error ?? phaseResult.error ?? variantResult.error ?? rewardResult.error
  if (challengeDataError) throw new Error(challengeDataError.message)
  const variantIds = (variantResult.data ?? []).map((variant) => variant.id)
  const variantPhaseResult = variantIds.length
    ? await supabase.from('challenge_variant_phases').select('*').in('variant_id', variantIds)
    : { data: [], error: null }
  if (variantPhaseResult.error) throw new Error(variantPhaseResult.error.message)
  const allPlans = (planResult.data ?? []) as AccountPlan[]
  const allPhases = (phaseResult.data ?? []) as ChallengePhase[]
  const allVariants = (variantResult.data ?? []) as ChallengeVariant[]
  const allVariantPhases = (variantPhaseResult.data ?? []) as ChallengeVariantPhase[]
  const allRewardOptions = (rewardResult.data ?? []) as ChallengeRewardOption[]
  const resolvedChallengeMap = new Map(challenges.map((challenge) => [challenge.id, resolveChallenge({ challenge, plans: allPlans, phases: allPhases, variants: allVariants, variantPhases: allVariantPhases, rewardOptions: allRewardOptions, now })]))
  const rawCountries = (countryResult.data ?? []) as Array<Record<string, unknown>>
  const countries: PublicCountry[] = rawCountries.flatMap((country) => {
    const code = String(country.code ?? country.iso_code ?? country.country_code ?? '').toUpperCase()
    const name = String(country.name ?? country.name_es ?? country.label ?? code)
    return code ? [{ code, name }] : []
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const countryCodeById = new Map(rawCountries.map((country) => [String(country.id ?? ''), String(country.code ?? country.iso_code ?? country.country_code ?? '').toUpperCase()]))
  const availability = (availabilityResult.data ?? []) as Array<Record<string, unknown>>

  const [sourceSummaryResult, recentPayoutResult, largestPayoutResult, latestResult, offerResult] = await payoutDataPromise
  const payoutDataError = sourceSummaryResult.error ?? recentPayoutResult.error ?? largestPayoutResult.error ?? latestResult.error ?? offerResult.error
  if (payoutDataError) throw new Error(payoutDataError.message)

  const latestPayouts: HomePayout[] = (latestResult.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    payoutDate: row.payout_date,
    sourceUrl: row.source_url,
    externalId: row.external_id,
    platform: platformMap.get(row.platform_id) ?? null,
    sourceName: sourceMap.get(row.payout_source_id)?.name ?? null,
    verification: row.verification_status,
  }))

  const validOfferRows = (offerResult.data ?? [])
    .filter((offer) => {
      const started = !offer.starts_at || new Date(offer.starts_at) <= now
      const current = !offer.expires_at || new Date(offer.expires_at) >= now
      const knownCountry = countryCode?.trim().toUpperCase() || null
      const countryMatches = !knownCountry || !offer.country_code || offer.country_code.toUpperCase() === knownCountry
      return started && current && countryMatches && (!offer.language || offer.language === language || offer.language === 'es')
    })
  const offersByPlatform = new Map<string, typeof validOfferRows>()
  for (const offer of validOfferRows) offersByPlatform.set(offer.platform_id, [...(offersByPlatform.get(offer.platform_id) ?? []), offer])
  const localizedOfferRows = [...offersByPlatform.values()].flatMap((rows) => {
    const global = rows.filter((offer) => !offer.language)
    const requested = rows.filter((offer) => offer.language === language)
    const fallback = language === 'es' ? [] : rows.filter((offer) => offer.language === 'es')
    return [...global, ...(requested.length ? requested : fallback)]
  })
  const offers: HomeOffer[] = localizedOfferRows
    .flatMap((offer) => {
      const platform = platformMap.get(offer.platform_id)
      if (!platform) return []
      return [{
        id: offer.id,
        title: visibleBrandText(offer.title),
        description: offer.description ? visibleBrandText(offer.description) : null,
        discountValue: Number(offer.discount_value ?? 0),
        discountType: offer.discount_type,
        promoCode: offer.promo_code,
        expiresAt: offer.expires_at,
        affiliateLinkId: offer.affiliate_link_id,
        countryCode: offer.country_code,
        platform,
      }]
    })

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const firmTotals = new Map<string, { total: number; count: number }>()
  let totalPaid = 0
  let totalPayouts = 0
  let paidToday = 0
  let payoutsToday = 0
  const largestPayout = Number(largestPayoutResult.data?.amount ?? 0)

  for (const summary of sourceSummaryResult.data ?? []) {
    const amount = Number(summary.payout_amount ?? 0)
    const count = Number(summary.payout_count ?? 0)
    totalPaid += amount
    totalPayouts += count
    const current = firmTotals.get(summary.platform_id) ?? { total: 0, count: 0 }
    current.total += amount
    current.count += count
    firmTotals.set(summary.platform_id, current)
  }
  for (const payout of (recentPayoutResult.data ?? []) as PayoutRow[]) {
    const payoutDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(payout.payout_date))
    if (payoutDay === todayKey) {
      paidToday += Number(payout.amount ?? 0)
      payoutsToday += 1
    }
  }

  const topFirms: FirmPayoutStat[] = [...firmTotals.entries()]
    .flatMap(([platformId, stats]) => {
      const platform = platformMap.get(platformId)
      return platform ? [{ platform, ...stats }] : []
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const newestPayout = latestPayouts[0] ?? null
  const featuredPlatforms = platforms
    .filter((platform) => firmTotals.has(platform.id))
    .sort((a, b) => {
      const payoutDifference =
        (firmTotals.get(b.id)?.total ?? 0) - (firmTotals.get(a.id)?.total ?? 0)
      return payoutDifference || (b.score ?? 0) - (a.score ?? 0)
    })
    .slice(0, 6)

  const recommendationFirms: RecommendableFirm[] = platforms.map((platform) => {
    const platformChallenges = challenges.filter((challenge) => challenge.platform_id === platform.id)
    const plans = platformChallenges.flatMap((challenge) => {
      const resolved = resolvedChallengeMap.get(challenge.id)
      if (!resolved) return []
      return [...resolved.basePlans, ...resolved.variants.flatMap((variant) => variant.plans)].map((plan) => ({
        price: plan.price === null ? null : Number(plan.price),
        accountSize: plan.account_size === null ? null : Number(plan.account_size),
        profitSplit: plan.effectiveProfitSplit ?? platform.profitSplit,
        // Resumen conservador: el menor max drawdown no nulo es la fase más restrictiva.
        maxDrawdown: conservativeMaxDrawdown(plan.effectivePhases),
        challengeType: challenge.challenge_type,
      }))
    })
    const platformAvailability = availability.filter((item) => String(item.platform_id ?? '') === platform.id)
    const availableCountryCodes = platformAvailability.flatMap((item) => {
      const direct = String(item.country_code ?? item.code ?? '').toUpperCase()
      const related = countryCodeById.get(String(item.country_id ?? '')) ?? ''
      const enabled = item.status === 'available'
      return enabled && (direct || related) ? [direct || related] : []
    })
    const verification = classifyPayoutVerification(sources.filter((source) => source.platform_id === platform.id))
    const activeOffer = offers.find((offer) => offer.platform.id === platform.id) ?? null
    return {
      id: platform.id, name: platform.name, slug: platform.slug, score: platform.score,
      logoUrl: platform.logoUrl, logoAlt: platform.logoAlt, profitSplit: platform.profitSplit,
      supportsEa: platform.supportsEa, allowsNews: platform.allowsNews, allowsWeekend: platform.allowsWeekend,
      allowsScalping: platform.allowsScalping, allowsDayTrading: platform.allowsDayTrading,
      allowsCopyTrading: platform.allowsCopyTrading, markets: platform.markets,
      verification: verification.level, verificationLabel: verification.label,
      availableCountryCodes, availabilityKnown: platformAvailability.length > 0,
      plans: platformChallenges.length ? plans : [],
      activeOffer: activeOffer ? { title: activeOffer.title, value: activeOffer.discountValue, type: activeOffer.discountType } : null,
    }
  })

  return {
    platforms,
    featuredPlatforms,
    offers,
    latestPayouts,
    topFirms,
    sources,
    countries,
    recommendationFirms,
    stats: {
      totalPaid,
      totalPayouts,
      averagePayout: totalPayouts ? totalPaid / totalPayouts : 0,
      largestPayout,
      paidToday,
      payoutsToday,
      firmsTracked: firmTotals.size,
      newestPayout,
    },
  }
}

export const getHomeData = unstable_cache(
  getHomeDataUncached,
  ['public-home-data-v1'],
  { revalidate: 60, tags: ['public-home-data'] }
)
