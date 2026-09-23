import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PublicLanguage } from '@/lib/public-language'

export type PublicBroker = {
  id: string
  name: string
  slug: string
  countryCode: string | null
  country: string | null
  logoUrl: string | null
  logoAlt: string | null
  description: string | null
  foundedYear: number | null
  minimumDeposit: number | null
  minimumDepositCurrency: string | null
  regulationSummary: string | null
  regulationSourceUrl: string | null
  isFeatured: boolean
  displayOrder: number
  markets: string[]
  tradingPlatforms: string[]
  hasOffer: boolean
}

type MediaRelation = { file_url: string; alt_text: string | null }
function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value }

async function queryBrokers(language: PublicLanguage): Promise<PublicBroker[]> {
  const db = createAdminClient()
  const platforms = await db.from('platforms')
    .select('id, name, slug, origin_country_code, logo_url, media:logo_media_id(file_url, alt_text)')
    .eq('type', 'broker').eq('status', 'active').order('name')
  if (platforms.error) throw new Error(`BROKERS_QUERY_FAILED phase=platforms message=${platforms.error.message}`)
  const ids = (platforms.data ?? []).map((row) => row.id)
  if (!ids.length) return []

  const [details, translations, markets, tradingPlatforms, countries, offers] = await Promise.all([
    db.from('broker_details').select('platform_id, founded_year, minimum_deposit, minimum_deposit_currency, regulation_summary, regulation_source_url, is_featured, display_order').in('platform_id', ids),
    db.from('platform_translations').select('platform_id, language, short_description').in('platform_id', ids).in('language', language === 'es' ? ['es'] : [language, 'es']),
    db.from('platform_markets').select('platform_id, market').in('platform_id', ids),
    db.from('platform_trading_platforms').select('platform_id, catalog:trading_platform_id(name, status)').in('platform_id', ids),
    db.from('countries').select('code, name'),
    db.from('offers').select('platform_id, starts_at, expires_at').in('platform_id', ids).eq('status', true),
  ])
  const failures = [details, translations, markets, tradingPlatforms, countries, offers]
  const failure = failures.find((result) => result.error)
  if (failure?.error) throw new Error(`BROKERS_QUERY_FAILED phase=related_data message=${failure.error.message}`)

  const detailMap = new Map((details.data ?? []).map((row) => [row.platform_id, row]))
  const countryMap = new Map((countries.data ?? []).map((row) => [row.code, row.name]))
  const marketMap = new Map<string, string[]>()
  for (const row of markets.data ?? []) marketMap.set(row.platform_id, [...(marketMap.get(row.platform_id) ?? []), row.market])
  const tradingMap = new Map<string, string[]>()
  for (const row of tradingPlatforms.data ?? []) {
    const catalog = first(row.catalog)
    if (catalog?.status) tradingMap.set(row.platform_id, [...(tradingMap.get(row.platform_id) ?? []), catalog.name])
  }
  const translationMap = new Map<string, string | null>()
  for (const row of translations.data ?? []) {
    if (row.language === 'es' && !translationMap.has(row.platform_id)) translationMap.set(row.platform_id, row.short_description)
  }
  for (const row of translations.data ?? []) {
    if (row.language === language) translationMap.set(row.platform_id, row.short_description)
  }
  const now = Date.now()
  const offerIds = new Set((offers.data ?? []).filter((offer) =>
    (!offer.starts_at || new Date(offer.starts_at).getTime() <= now)
    && (!offer.expires_at || new Date(offer.expires_at).getTime() >= now)
  ).map((offer) => offer.platform_id))

  return (platforms.data ?? []).map((row) => {
    const detailsRow = detailMap.get(row.id)
    const media = first(row.media as MediaRelation | MediaRelation[] | null)
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      countryCode: row.origin_country_code,
      country: row.origin_country_code ? countryMap.get(row.origin_country_code) ?? row.origin_country_code : null,
      logoUrl: media?.file_url ?? row.logo_url ?? null,
      logoAlt: media?.alt_text ?? row.name,
      description: translationMap.get(row.id) ?? null,
      foundedYear: detailsRow?.founded_year ?? null,
      minimumDeposit: detailsRow?.minimum_deposit === null || detailsRow?.minimum_deposit === undefined ? null : Number(detailsRow.minimum_deposit),
      minimumDepositCurrency: detailsRow?.minimum_deposit_currency ?? null,
      regulationSummary: detailsRow?.regulation_summary ?? null,
      regulationSourceUrl: detailsRow?.regulation_source_url ?? null,
      isFeatured: detailsRow?.is_featured ?? false,
      displayOrder: detailsRow?.display_order ?? 100,
      markets: marketMap.get(row.id) ?? [],
      tradingPlatforms: tradingMap.get(row.id) ?? [],
      hasOffer: offerIds.has(row.id),
    }
  }).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'es'))
}

const getCachedBrokers = unstable_cache(queryBrokers, ['public-brokers-v1'], { revalidate: 60 })

export function getPublicBrokers(language: PublicLanguage) { return getCachedBrokers(language) }
export async function getPublicBroker(slug: string, language: PublicLanguage) {
  return (await getPublicBrokers(language)).find((broker) => broker.slug === slug) ?? null
}
