import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PublicLanguage } from '@/lib/public-language'
import { getPublicPlatformTranslations } from '@/lib/public-platform-translations'
import { getPublicPlatformDetailTranslations } from '@/lib/public-platform-detail-translations'

type Media = { file_url: string; alt_text: string | null }
const first = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

export type PublicExchange = {
  id: string
  name: string
  slug: string
  country: string | null
  countryCode: string | null
  logoUrl: string | null
  logoAlt: string | null
  description: string | null
  shortDescription: string | null
  pros: string[]
  cons: string[]
  seoTitle: string | null
  seoDescription: string | null
  foundedYear: number | null
  exchangeType: string
  productSummary: string | null
  fiatSupport: boolean | null
  regulationSummary: string | null
  regulationSourceUrl: string | null
  isFeatured: boolean
  displayOrder: number
}

async function queryExchanges(language: PublicLanguage): Promise<PublicExchange[]> {
  const db = createAdminClient()
  const platforms = await db.from('platforms')
    .select('id,name,slug,origin_country_code,logo_url,media:logo_media_id(file_url,alt_text)')
    .eq('type', 'exchange').eq('status', 'active').order('name')
  if (platforms.error) throw new Error(platforms.error.message)
  const ids = (platforms.data ?? []).map((item) => item.id)
  if (!ids.length) return []

  const [details, translations, specializedTranslations, countries] = await Promise.all([
    db.from('exchange_details').select('*').in('platform_id', ids),
    getPublicPlatformTranslations(ids, language),
    getPublicPlatformDetailTranslations(ids, language),
    db.from('countries').select('code,name'),
  ])
  const error = details.error ?? countries.error
  if (error) throw new Error(error.message)
  const detailMap = new Map((details.data ?? []).map((item) => [item.platform_id, item]))
  const countryMap = new Map((countries.data ?? []).map((item) => [item.code, item.name]))

  return (platforms.data ?? []).map((item) => {
    const media = first(item.media as Media | Media[] | null)
    const detail = detailMap.get(item.id)
    const translation = translations.get(item.id)
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      countryCode: item.origin_country_code,
      country: item.origin_country_code ? countryMap.get(item.origin_country_code) ?? item.origin_country_code : null,
      logoUrl: media?.file_url ?? item.logo_url,
      logoAlt: media?.alt_text ?? item.name,
      description: translation?.description ?? translation?.shortDescription ?? null,
      shortDescription: translation?.shortDescription ?? null,
      pros: translation?.pros ?? [],
      cons: translation?.cons ?? [],
      seoTitle: translation?.seoTitle ?? null,
      seoDescription: translation?.seoDescription ?? null,
      foundedYear: detail?.founded_year ?? null,
      exchangeType: detail?.exchange_type ?? 'centralized',
      productSummary: specializedTranslations.exchanges.get(item.id)?.productSummary ?? detail?.product_summary ?? null,
      fiatSupport: detail?.fiat_support ?? null,
      regulationSummary: specializedTranslations.exchanges.get(item.id)?.regulationSummary ?? detail?.regulation_summary ?? null,
      regulationSourceUrl: detail?.regulation_source_url ?? null,
      isFeatured: detail?.is_featured ?? false,
      displayOrder: detail?.display_order ?? 100,
    }
  }).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'es'))
}

const cached = unstable_cache(queryExchanges, ['public-exchanges-v2'], { revalidate: 60 })
export function getPublicExchanges(language: PublicLanguage) { return cached(language) }
export async function getPublicExchange(slug: string, language: PublicLanguage) {
  return (await cached(language)).find((item) => item.slug === slug) ?? null
}
