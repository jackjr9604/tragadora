import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { classifyPayoutVerification, type RecommendableFirm } from '@/lib/prop-firm-recommender'

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
}

export type HomeOffer = {
  id: string
  title: string
  description: string | null
  discountValue: number
  discountType: string
  promoCode: string | null
  expiresAt: string | null
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
  platform_id: string
  payout_source_id: string | null
}

function first<T>(value: T[] | T | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export async function getHomeData() {
  const supabase = await createClient()
  const now = new Date()

  const [platformResult, detailResult, translationResult, sourceResult, challengeResult, planResult, availabilityResult, countryResult] =
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
          allows_news_trading, allows_weekend_holding
        `),
      supabase
        .from('platform_translations')
        .select('platform_id, language, short_description')
        .eq('language', 'es'),
      supabase
        .from('payout_sources')
        .select('id, platform_id, name, source_type, config')
        .eq('status', true),
      supabase.from('challenges').select('id, platform_id, challenge_type, phases, status').eq('status', 'active'),
      supabase.from('account_plans').select('challenge_id, account_size, price, profit_split, max_drawdown'),
      supabase.from('platform_availability').select('*'),
      supabase.from('countries').select('*'),
    ])

  const details = new Map(
    (detailResult.data ?? []).map((item) => [item.platform_id, item])
  )
  const translations = new Map(
    (translationResult.data ?? []).map((item) => [item.platform_id, item])
  )

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
    }
  })
  const platformMap = new Map(platforms.map((platform) => [platform.id, platform]))
  const sources = sourceResult.data ?? []
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  const challenges = challengeResult.data ?? []
  const challengeMap = new Map(challenges.map((challenge) => [challenge.id, challenge]))
  const rawCountries = (countryResult.data ?? []) as Array<Record<string, unknown>>
  const countries: PublicCountry[] = rawCountries.flatMap((country) => {
    const code = String(country.code ?? country.iso_code ?? country.country_code ?? '').toUpperCase()
    const name = String(country.name ?? country.name_es ?? country.label ?? code)
    return code ? [{ code, name }] : []
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const countryCodeById = new Map(rawCountries.map((country) => [String(country.id ?? ''), String(country.code ?? country.iso_code ?? country.country_code ?? '').toUpperCase()]))
  const availability = (availabilityResult.data ?? []) as Array<Record<string, unknown>>

  const firstPayoutPage = await supabase
    .from('payouts')
    .select('amount, payout_date, platform_id, payout_source_id', {
      count: 'exact',
    })
    .order('payout_date', { ascending: true })
    .range(0, 999)

  const payoutRows: PayoutRow[] = [...(firstPayoutPage.data ?? [])]
  const payoutCount = firstPayoutPage.count ?? payoutRows.length

  for (let offset = 1_000; offset < payoutCount; offset += 1_000) {
    const page = await supabase
      .from('payouts')
      .select('amount, payout_date, platform_id, payout_source_id')
      .order('payout_date', { ascending: true })
      .range(offset, offset + 999)

    payoutRows.push(...(page.data ?? []))
  }

  const latestResult = await supabase
    .from('payouts')
    .select(`
      id, amount, payout_date, source_url, external_id,
      platform_id, payout_source_id, verification_status
    `)
    .order('payout_date', { ascending: false })
    .limit(16)

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

  const offerResult = await supabase
    .from('offers')
    .select(`
      id, platform_id, title, description, discount_value,
      discount_type, promo_code, expires_at, starts_at,
      language, country_code, status, priority, affiliate_link_id
    `)
    .eq('status', true)
    .order('priority', { ascending: true })
    .limit(24)

  const offers: HomeOffer[] = (offerResult.data ?? [])
    .filter((offer) => {
      const started = !offer.starts_at || new Date(offer.starts_at) <= now
      const current = !offer.expires_at || new Date(offer.expires_at) >= now
      return started && current && (!offer.language || offer.language === 'es')
    })
    .flatMap((offer) => {
      const platform = platformMap.get(offer.platform_id)
      if (!platform) return []
      return [{
        id: offer.id,
        title: offer.title,
        description: offer.description,
        discountValue: Number(offer.discount_value ?? 0),
        discountType: offer.discount_type,
        promoCode: offer.promo_code,
        expiresAt: offer.expires_at,
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
  let paidToday = 0
  let payoutsToday = 0
  let largestPayout = 0

  for (const payout of payoutRows) {
    const amount = Number(payout.amount ?? 0)
    totalPaid += amount
    largestPayout = Math.max(largestPayout, amount)
    const current = firmTotals.get(payout.platform_id) ?? { total: 0, count: 0 }
    current.total += amount
    current.count += 1
    firmTotals.set(payout.platform_id, current)

    const payoutDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(payout.payout_date))
    if (payoutDay === todayKey) {
      paidToday += amount
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
    const plans = (planResult.data ?? []).flatMap((plan) => {
      const challenge = challengeMap.get(plan.challenge_id)
      if (!challenge || challenge.platform_id !== platform.id) return []
      return [{
        price: plan.price === null ? null : Number(plan.price),
        accountSize: plan.account_size === null ? null : Number(plan.account_size),
        profitSplit: plan.profit_split === null ? null : Number(plan.profit_split),
        maxDrawdown: plan.max_drawdown === null ? null : Number(plan.max_drawdown),
        challengeType: challenge.challenge_type,
      }]
    })
    const platformAvailability = availability.filter((item) => String(item.platform_id ?? '') === platform.id)
    const availableCountryCodes = platformAvailability.flatMap((item) => {
      const direct = String(item.country_code ?? item.code ?? '').toUpperCase()
      const related = countryCodeById.get(String(item.country_id ?? '')) ?? ''
      const enabled = item.status === undefined || item.status === true || item.status === 'active' || item.available === true
      return enabled && (direct || related) ? [direct || related] : []
    })
    const verification = classifyPayoutVerification(sources.filter((source) => source.platform_id === platform.id))
    const activeOffer = offers.find((offer) => offer.platform.id === platform.id) ?? null
    return {
      id: platform.id, name: platform.name, slug: platform.slug, score: platform.score,
      logoUrl: platform.logoUrl, logoAlt: platform.logoAlt, profitSplit: platform.profitSplit,
      supportsEa: platform.supportsEa, allowsNews: platform.allowsNews, allowsWeekend: platform.allowsWeekend,
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
      totalPayouts: payoutRows.length,
      averagePayout: payoutRows.length ? totalPaid / payoutRows.length : 0,
      largestPayout,
      paidToday,
      payoutsToday,
      firmsTracked: firmTotals.size,
      newestPayout,
    },
  }
}
