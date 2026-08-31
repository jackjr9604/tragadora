import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlatformResearchTable, type ResearchRow } from '@/components/admin/PlatformResearchTable'
import { createClient } from '@/lib/supabase/server'

export default async function PlatformResearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [platformResult, marketResult, detailResult, challengeResult, planResult, sourceResult, statusResult, countryResult] = await Promise.all([
    supabase.from('platforms').select('id, name, website_url, origin_country_code').eq('type', 'prop_firm').order('name'),
    supabase.from('platform_markets').select('platform_id, market'),
    supabase.from('prop_firm_details').select('platform_id, time_limit_policy, consistency_rules, special_rules'),
    supabase.from('challenges').select('id, platform_id'),
    supabase.from('account_plans').select('challenge_id'),
    supabase.from('payout_sources').select('platform_id, name, source_type, config'),
    supabase.from('platform_research_status').select('*'),
    supabase.from('countries').select('code, name'),
  ])
  if (platformResult.error) throw new Error(platformResult.error.message)
  if (statusResult.error && !/platform_research_status/i.test(statusResult.error.message)) throw new Error(statusResult.error.message)
  const markets = group(marketResult.data ?? [], 'platform_id', (item) => item.market)
  const sources = group(sourceResult.data ?? [], 'platform_id', (item) => `${item.name} (${String(item.config?.token_symbol ?? item.source_type)})`)
  const details = new Map((detailResult.data ?? []).map((item) => [item.platform_id, item]))
  const challenges = challengeResult.data ?? [], challengeIds = new Map(challenges.map((item) => [item.id, item.platform_id]))
  const challengeCounts = countBy(challenges, (item) => item.platform_id), planCounts = countBy(planResult.data ?? [], (item) => challengeIds.get(item.challenge_id) ?? '')
  const statuses = new Map((statusResult.data ?? []).map((item) => [item.platform_id, item])), countries = new Map((countryResult.data ?? []).map((item) => [item.code, item.name]))
  const rows: ResearchRow[] = (platformResult.data ?? []).map((platform) => { const detail = details.get(platform.id), saved = statuses.get(platform.id); return { platformId: platform.id, name: platform.name, markets: markets.get(platform.id) ?? [], country: platform.origin_country_code ? countries.get(platform.origin_country_code) ?? platform.origin_country_code : null, websiteUrl: platform.website_url, hasGeneralInfo: Boolean(detail), challengeCount: challengeCounts.get(platform.id) ?? 0, planCount: planCounts.get(platform.id) ?? 0, hasRules: Boolean(detail?.time_limit_policy || detail?.consistency_rules || detail?.special_rules), payoutMethods: sources.get(platform.id) ?? [], status: { official_site_checked: saved?.official_site_checked ?? false, general_info_checked: saved?.general_info_checked ?? false, markets_checked: saved?.markets_checked ?? false, challenges_checked: saved?.challenges_checked ?? false, plans_checked: saved?.plans_checked ?? false, trading_rules_checked: saved?.trading_rules_checked ?? false, payout_policy_checked: saved?.payout_policy_checked ?? false, payout_tracking_status: saved?.payout_tracking_status ?? 'unknown', priority: saved?.priority ?? 'medium', notes: saved?.notes ?? null, last_reviewed_at: saved?.last_reviewed_at ?? null } } })
  return <main className="min-h-screen bg-slate-100 p-8"><div className="mx-auto max-w-[1800px]"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm text-slate-500">Prop Firms / Investigación</p><h1 className="mt-1 text-3xl font-bold">Banco de investigación</h1><p className="mt-2 text-slate-500">Controla qué información está completa y qué firmas requieren investigación de payouts.</p></div><Link href="/admin/platforms" className="rounded-lg border bg-white px-4 py-2 text-sm">Volver</Link></div><PlatformResearchTable initialRows={rows} /></div></main>
}

function group<T>(items: T[], key: keyof T, value: (item: T) => string) { const result = new Map<string, string[]>(); for (const item of items) { const id = String(item[key]); result.set(id, [...(result.get(id) ?? []), value(item)]) } return result }
function countBy<T>(items: T[], key: (item: T) => string) { const result = new Map<string, number>(); for (const item of items) { const id = key(item); if (id) result.set(id, (result.get(id) ?? 0) + 1) } return result }
