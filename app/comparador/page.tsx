import type { Metadata } from 'next'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getComparisonCountries, getComparisonData, getComparisonFilterOptions, getMatchCatalog } from '@/lib/comparison-data'
import { findMatchesForPreferences } from '@/lib/preference-matches'
import type { Priority } from '@/lib/comparison-engine'
import { Comparator } from './Comparator'
import { GlobalOffersStrip } from '@/components/public/offers/GlobalOffersStrip'

export const metadata: Metadata = {
  title: 'Comparador de Prop Firms | Tradagora',
  description: 'Compara challenges, planes, reglas, precio y evidencia de payouts según tus prioridades, sin un ganador universal.',
}
export const revalidate = 60

type Query = { firms?: string | string[]; plans?: string | string[]; size?: string | string[]; priorities?: string | string[]; styles?: string | string[]; market?: string | string[]; budget?: string | string[]; platform?: string | string[]; country?: string | string[]; mode?: string | string[]; view?: string | string[]; differences?: string | string[]; lang?: string | string[] }
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const nonnegative = (value: string | undefined) => value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
const priorityKeys: Priority[] = ['price', 'payout', 'drawdown', 'split']
// Solo catálogo público relativamente estable; el comparador manual conserva sus lecturas actuales.
const getChoices = unstable_cache((country: string, market: string) => getComparisonData([], country, market), ['comparison-choices-availability-v2'], { revalidate: 60 })
const getFilters = unstable_cache(getComparisonFilterOptions, ['comparison-filters-v1'], { revalidate: 60 })
const getCatalog = unstable_cache(getMatchCatalog, ['comparison-match-catalog-v1'], { revalidate: 60 })
const getCountries = unstable_cache(getComparisonCountries, ['comparison-countries-v1'], { revalidate: 3600 })

export default async function ComparatorPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  const language = await resolvePublicLanguage(query.lang)
  const slugs = (single(query.firms) ?? '').split(',').filter(Boolean).slice(0, 3)
  const personal = single(query.mode) === 'personal'
  const showMatches = personal && single(query.view) === 'matches'
  const countries = await getCountries()
  const country = countries.some((item) => item.code === single(query.country)?.toUpperCase()) ? single(query.country)!.toUpperCase() : ''
  const selectedMarket = personal ? single(query.market) ?? '' : ''
  const data = personal || !slugs.length ? await getChoices(country, selectedMarket) : await getComparisonData(slugs, country)
  const catalog = showMatches ? await getCatalog(data.choices) : []
  const filterOptions = personal ? showMatches ? {
    sizes: [...new Set(catalog.flatMap((firm) => firm.plans.flatMap((plan) => plan.size === null ? [] : [plan.size])))].sort((a, b) => a - b),
    platforms: [...new Set(catalog.flatMap((firm) => firm.tradingPlatforms))].sort(),
  } : await getFilters(data.choices) : { sizes: [], platforms: [] }
  const priorities = (single(query.priorities) ?? '').split(',').filter((item): item is Priority => priorityKeys.includes(item as Priority)).slice(0, 3)
  const styles = (single(query.styles) ?? '').split(',').filter((item): item is 'ea' | 'news' | 'weekend' => ['ea', 'news', 'weekend'].includes(item)).slice(0, 3)
  const matching = showMatches ? findMatchesForPreferences(catalog, {
    country,
    market: single(query.market) ?? '', size: nonnegative(single(query.size)), budget: nonnegative(single(query.budget)),
    platform: single(query.platform) ?? '', priorities, styles,
  }) : { results: [], hasExactRequirements: false, eligibleFirmCount: 0, excludedByCountryCount: 0 }
  return <PublicPageShell language={language}><Suspense fallback={null}><GlobalOffersStrip language={language} /></Suspense><Comparator key={`${personal}:${showMatches}:${single(query.market)}:${single(query.size)}:${single(query.budget)}:${single(query.platform)}:${country}:${priorities.join(',')}:${styles.join(',')}`} {...data} countries={countries} initial={{
    plans: (single(query.plans) ?? '').split(','), size: single(query.size) ?? '', priorities, styles,
    market: single(query.market) ?? '', budget: single(query.budget) ?? '', platform: single(query.platform) ?? '', country, mode: personal ? 'personal' : 'firms', showMatches, differences: single(query.differences) === '1',
  }} filterOptions={filterOptions} matching={matching} /></PublicPageShell>
}
