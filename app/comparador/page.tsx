import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getComparisonData, getComparisonFilterOptions, getMatchCatalog } from '@/lib/comparison-data'
import { findMatchesForPreferences } from '@/lib/preference-matches'
import type { Priority } from '@/lib/comparison-engine'
import { Comparator } from './Comparator'

export const metadata: Metadata = {
  title: 'Comparador de Prop Firms | Tradagora',
  description: 'Compara challenges, planes, reglas, precio y evidencia de payouts según tus prioridades, sin un ganador universal.',
}
export const revalidate = 60

type Query = { firms?: string | string[]; plans?: string | string[]; size?: string | string[]; priorities?: string | string[]; styles?: string | string[]; market?: string | string[]; budget?: string | string[]; platform?: string | string[]; mode?: string | string[]; view?: string | string[]; differences?: string | string[]; lang?: string | string[] }
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const nonnegative = (value: string | undefined) => value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
const priorityKeys: Priority[] = ['price', 'payout', 'drawdown', 'split', 'platform']

export default async function ComparatorPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  const language = await resolvePublicLanguage(query.lang)
  const slugs = (single(query.firms) ?? '').split(',').filter(Boolean).slice(0, 3)
  const personal = single(query.mode) === 'personal'
  const showMatches = personal && single(query.view) === 'matches'
  const data = await getComparisonData(personal ? [] : slugs)
  const filterOptions = personal ? await getComparisonFilterOptions(data.choices) : { sizes: [], platforms: [] }
  const priorities = (single(query.priorities) ?? '').split(',').filter((item): item is Priority => priorityKeys.includes(item as Priority)).slice(0, 3)
  const styles = (single(query.styles) ?? '').split(',').filter((item): item is 'ea' | 'news' | 'weekend' => ['ea', 'news', 'weekend'].includes(item)).slice(0, 3)
  const matching = showMatches ? findMatchesForPreferences(await getMatchCatalog(data.choices), {
    market: single(query.market) ?? '', size: nonnegative(single(query.size)), budget: nonnegative(single(query.budget)),
    platform: single(query.platform) ?? '', priorities, styles,
  }) : { results: [], hasExactRequirements: false }
  return <PublicPageShell language={language}><Comparator key={`${personal}:${showMatches}:${single(query.market)}:${single(query.size)}:${single(query.budget)}:${single(query.platform)}:${priorities.join(',')}:${styles.join(',')}`} {...data} initial={{
    plans: (single(query.plans) ?? '').split(','), size: single(query.size) ?? '', priorities, styles,
    market: single(query.market) ?? '', budget: single(query.budget) ?? '', platform: single(query.platform) ?? '', mode: personal ? 'personal' : 'firms', showMatches, differences: single(query.differences) === '1',
  }} filterOptions={filterOptions} matching={matching} /></PublicPageShell>
}
