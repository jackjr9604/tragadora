import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type PublicOffer = {
  id: string
  title: string
  description: string | null
  discountValue: number
  discountType: string
  promoCode: string | null
  countryCode: string | null
  expiresAt: string | null
  priority: number
  challengeName: string | null
  includesFreeAccount: boolean
  freeAccountLabel: string | null
  isFeatured: boolean
  hotBadge: string | null
  shortHighlight: string | null
  platform: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    logoAlt: string | null
    markets: string[]
  }
}

const baseFields = `
  id, platform_id, challenge_id, title, description, discount_value,
  discount_type, promo_code, country_code, language, starts_at, expires_at,
  status, priority, created_at
`
const presentationFields = ', includes_free_account, free_account_label, is_featured, hot_badge, short_highlight'
const presentationFieldNames = [
  'includes_free_account',
  'free_account_label',
  'is_featured',
  'hot_badge',
  'short_highlight',
] as const

type QueryFailure = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type OfferRow = {
  id: string
  platform_id: string
  challenge_id: string | null
  title: string
  description: string | null
  discount_value: number | string | null
  discount_type: string
  promo_code: string | null
  country_code: string | null
  language: string | null
  starts_at: string | null
  expires_at: string | null
  priority: number | null
  includes_free_account?: boolean
  free_account_label?: string | null
  is_featured?: boolean
  hot_badge?: string | null
  short_highlight?: string | null
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function failureMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}

function isPresentationSchemaMismatch(error: QueryFailure) {
  const description = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  const isMissingDatabaseField = error.code === '42703' || error.code === 'PGRST204'
  return isMissingDatabaseField && presentationFieldNames.some((field) => description.includes(field))
}

function publicOffersQueryError(phase: string, error: unknown) {
  const message = failureMessage(error)
  const kind = /fetch failed|network|timeout|econn|enotfound|socket/i.test(message)
    ? 'NETWORK_OR_INFRA'
    : 'QUERY'
  return new Error(`PUBLIC_OFFERS_QUERY_FAILED phase=${phase} kind=${kind} message=${message}`)
}

async function queryPublicOffers(language: string, countryCode: string | null): Promise<PublicOffer[]> {
  const db = createAdminClient()
  const now = new Date()
  let extendedResult
  try {
    extendedResult = await db.from('offers').select(`${baseFields}${presentationFields}`).eq('status', true)
      .order('priority', { ascending: true }).order('is_featured', { ascending: false })
      .order('expires_at', { ascending: true, nullsFirst: false }).order('discount_value', { ascending: false })
      .order('created_at', { ascending: false }).limit(100)
  } catch (error) {
    throw publicOffersQueryError('new_schema', error)
  }

  const presentationUnavailable = extendedResult.error && isPresentationSchemaMismatch(extendedResult.error)
  let rowsData: OfferRow[] | null = extendedResult.data as OfferRow[] | null
  let queryError = extendedResult.error
  if (presentationUnavailable) {
    let legacyResult
    try {
      legacyResult = await db.from('offers').select(baseFields).eq('status', true)
        .order('priority', { ascending: true }).order('discount_value', { ascending: false }).order('created_at', { ascending: false }).limit(100)
    } catch (error) {
      throw publicOffersQueryError('legacy', error)
    }
    rowsData = legacyResult.data as OfferRow[] | null
    queryError = legacyResult.error
  }
  if (queryError) {
    throw publicOffersQueryError(presentationUnavailable ? 'legacy' : 'new_schema', queryError)
  }

  const rows = (rowsData ?? []).filter((offer) => {
    const started = !offer.starts_at || new Date(offer.starts_at) <= now
    const current = !offer.expires_at || new Date(offer.expires_at) >= now
    const location = countryCode?.trim().toUpperCase() || null
    const locationMatches = !location || !offer.country_code || offer.country_code.toUpperCase() === location
    const languageMatches = !offer.language || offer.language === language || offer.language === 'es'
    return started && current && locationMatches && languageMatches
  })
  const platformIds = [...new Set(rows.map((row) => row.platform_id))]
  const challengeIds = [...new Set(rows.flatMap((row) => row.challenge_id ? [row.challenge_id] : []))]
  if (!platformIds.length) return []

  let platforms
  let markets
  let challenges
  try {
    [platforms, markets, challenges] = await Promise.all([
      db.from('platforms').select('id, name, slug, logo_url, media:logo_media_id(file_url, alt_text)').in('id', platformIds).eq('status', 'active'),
      db.from('platform_markets').select('platform_id, market').in('platform_id', platformIds),
      challengeIds.length ? db.from('challenges').select('id, name').in('id', challengeIds) : Promise.resolve({ data: [], error: null }),
    ])
  } catch (error) {
    throw publicOffersQueryError('related_data', error)
  }
  if (platforms.error) throw publicOffersQueryError('platforms', platforms.error)
  if (markets.error) throw publicOffersQueryError('platform_markets', markets.error)
  if (challenges.error) throw publicOffersQueryError('challenges', challenges.error)
  const marketMap = new Map<string, string[]>()
  for (const row of markets.data ?? []) marketMap.set(row.platform_id, [...(marketMap.get(row.platform_id) ?? []), row.market])
  const challengeMap = new Map((challenges.data ?? []).map((row) => [row.id, row.name]))
  const platformMap = new Map((platforms.data ?? []).map((row) => {
    const media = first(row.media)
    return [row.id, {
      id: row.id, name: row.name, slug: row.slug,
      logoUrl: media?.file_url ?? row.logo_url ?? null,
      logoAlt: media?.alt_text ?? row.name,
      markets: marketMap.get(row.id) ?? [],
    }]
  }))

  return rows.flatMap((row) => {
    const platform = platformMap.get(row.platform_id)
    if (!platform) return []
    return [{
      id: row.id,
      title: row.title,
      description: row.description,
      discountValue: Number(row.discount_value ?? 0),
      discountType: row.discount_type,
      promoCode: row.promo_code,
      countryCode: row.country_code,
      expiresAt: row.expires_at,
      priority: Number(row.priority ?? 1),
      challengeName: row.challenge_id ? challengeMap.get(row.challenge_id) ?? null : null,
      includesFreeAccount: row.includes_free_account ?? false,
      freeAccountLabel: row.free_account_label ?? null,
      isFeatured: row.is_featured ?? false,
      hotBadge: row.hot_badge ?? null,
      shortHighlight: row.short_highlight ?? null,
      platform,
    }]
  })
}

const getCachedPublicOffers = unstable_cache(
  queryPublicOffers,
  ['active-public-offers-v2'],
  { revalidate: 60 }
)

export function getPublicOffers(language: string, countryCode: string | null) {
  return getCachedPublicOffers(language, countryCode?.trim().toUpperCase() || null)
}

export async function getFeaturedPublicOffers(language: string, countryCode: string | null) {
  return (await getPublicOffers(language, countryCode)).filter((offer) => offer.isFeatured)
}
