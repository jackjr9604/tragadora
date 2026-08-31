import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { payoutPeriodSince, type PayoutPeriodKey } from '@/lib/payout-periods'
import type { HomePayout, HomePlatform } from '@/lib/home-data'

export type VerificationLevel = 'verified' | 'tracked_external' | 'blockchain_external' | 'firm_reported' | 'unverified'

export type PayoutFirmSummary = {
  platformId: string; name: string; slug: string; logoUrl: string | null; logoAlt: string | null; markets: string[]
  periodKey: PayoutPeriodKey; displayTotalAmount: number | null; knownPayoutCount: number | null
  knownLargestPayout: number | null; knownAveragePayout: number | null; knownMedianTimeMinutes: number | null; knownCurrency: string | null
  displayTotalSourceType: string | null; displayTotalSourceName: string | null; displayTotalSourceUrl: string | null
  displayTotalVerificationLevel: VerificationLevel | null; displayTotalUpdatedAt: string | null
  verifiedAmount: number; verifiedPayoutCount: number; verifiedAveragePayout: number | null; verifiedLargestPayout: number | null
  verifiedFirstPayoutAt: string | null; verifiedLastPayoutAt: string | null; verificationCoveragePercentage: number | null
  unverifiedCoverageAmount: number | null; verifiedExceedsKnown: boolean
}

export type PayoutMetric = {
  id: string; metric_type: string; period_key: PayoutPeriodKey; amount: number | null; payout_count: number | null
  largest_payout: number | null; average_payout: number | null; median_payout: number | null; median_time_minutes: number | null
  currency: string; source_type: string; source_name: string | null; source_url: string | null
  verification_level: VerificationLevel; period_start: string | null; period_end: string | null
  collected_at: string; updated_at: string; raw_data: Record<string, unknown>
}

export type PayoutSourceDetail = {
  id: string; name: string; source_type: string; source_url: string | null; config: Record<string, unknown> | null
  status: boolean; last_sync_at: string | null; last_success_at: string | null; last_error: string | null
  payoutCount: number; payoutAmount: number; firstPayoutAt: string | null; lastPayoutAt: string | null
}

export async function getPayoutTrackerSummaries(period: PayoutPeriodKey) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('platform_payout_period_summary').select('*').eq('period_key', period)
  if (error) throw new Error(migrationError(error.message))
  const rows = data ?? []
  const ids = rows.map((row) => row.platform_id)
  const [platformResult, marketResult] = ids.length ? await Promise.all([
    supabase.from('platforms').select('id, logo_url, media:logo_media_id(file_url, alt_text)').in('id', ids),
    supabase.from('platform_markets').select('platform_id, market').in('platform_id', ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  if (platformResult.error) throw new Error(platformResult.error.message)
  if (marketResult.error) throw new Error(marketResult.error.message)
  const platformMap = new Map((platformResult.data ?? []).map((platform) => [platform.id, platform]))
  const markets = new Map<string, string[]>()
  for (const row of marketResult.data ?? []) markets.set(row.platform_id, [...(markets.get(row.platform_id) ?? []), row.market])
  return rows.map((row) => toSummary(row, platformMap.get(row.platform_id), markets.get(row.platform_id) ?? []))
}

export async function getPayoutFirmDetail(slug: string, period: PayoutPeriodKey) {
  const supabase = createAdminClient()
  const summaryResult = await supabase.from('platform_payout_period_summary').select('*').eq('slug', slug).eq('period_key', period).maybeSingle()
  if (summaryResult.error) throw new Error(migrationError(summaryResult.error.message))
  if (!summaryResult.data) return null
  const platformId = summaryResult.data.platform_id
  const since = payoutPeriodSince(period)
  let trendQuery = supabase.from('platform_payout_daily').select('payout_day, payout_count, payout_amount').eq('platform_id', platformId).order('payout_day')
  let payoutsQuery = supabase.from('payouts').select('id, amount, currency, payout_date, payment_method, source, verification_status, source_url, payout_source_id').eq('platform_id', platformId).order('payout_date', { ascending: false }).limit(20)
  if (since) {
    trendQuery = trendQuery.gte('payout_day', since)
    payoutsQuery = payoutsQuery.gte('payout_date', since)
  }
  const [platformResult, marketsResult, metricsResult, sourcesResult, sourceStatsResult, payoutsResult, trendResult] = await Promise.all([
    supabase.from('platforms').select('id, name, slug, website_url, logo_url, media:logo_media_id(file_url, alt_text)').eq('id', platformId).single(),
    supabase.from('platform_markets').select('market').eq('platform_id', platformId),
    supabase.from('platform_payout_metrics').select('*').eq('platform_id', platformId).eq('period_key', period).eq('metric_type', 'payout_summary').eq('source_type', 'third_party_public').eq('source_name', 'MondoTraders').eq('verification_level', 'blockchain_external').eq('is_current', true).order('updated_at', { ascending: false }),
    supabase.from('payout_sources').select('id, name, source_type, source_url, config, status, last_sync_at, last_success_at, last_error').eq('platform_id', platformId).order('name'),
    supabase.from('payout_source_summary').select('*').eq('platform_id', platformId), payoutsQuery, trendQuery,
  ])
  const failure = [platformResult, marketsResult, metricsResult, sourcesResult, sourceStatsResult, payoutsResult, trendResult].find((result) => result.error)
  if (failure?.error) throw new Error(migrationError(failure.error.message))
  const statsMap = new Map((sourceStatsResult.data ?? []).map((item) => [item.payout_source_id, item]))
  const sources: PayoutSourceDetail[] = (sourcesResult.data ?? []).map((source) => {
    const stats = statsMap.get(source.id)
    return { ...source, payoutCount: Number(stats?.payout_count ?? 0), payoutAmount: Number(stats?.payout_amount ?? 0), firstPayoutAt: stats?.first_payout_at ?? null, lastPayoutAt: stats?.last_payout_at ?? null }
  })
  const platform = platformResult.data
  if (!platform) return null
  return {
    summary: toSummary(summaryResult.data, platform, (marketsResult.data ?? []).map((item) => item.market)),
    websiteUrl: platform.website_url,
    metrics: (metricsResult.data ?? []).map((metric) => ({ ...metric, amount: numeric(metric.amount), payout_count: numeric(metric.payout_count), largest_payout: numeric(metric.largest_payout), average_payout: numeric(metric.average_payout), median_payout: numeric(metric.median_payout), median_time_minutes: numeric(metric.median_time_minutes) })) as PayoutMetric[],
    sources, payouts: payoutsResult.data ?? [],
    trend: (trendResult.data ?? []).map((item) => ({ day: item.payout_day, count: Number(item.payout_count), amount: Number(item.payout_amount) })),
  }
}

export async function getLatestPayoutTicker(limit = 16): Promise<HomePayout[]> {
  const supabase = createAdminClient()
  const payoutResult = await supabase.from('payouts').select('id, amount, payout_date, source_url, external_id, platform_id, payout_source_id, verification_status').order('payout_date', { ascending: false }).limit(limit)
  if (payoutResult.error) return []
  const rows = payoutResult.data ?? []
  const platformIds = [...new Set(rows.map((row) => row.platform_id))]
  const sourceIds = [...new Set(rows.flatMap((row) => row.payout_source_id ? [row.payout_source_id] : []))]
  const [platformResult, sourceResult, marketResult] = await Promise.all([
    platformIds.length ? supabase.from('platforms').select('id, name, slug, score, media:logo_media_id(file_url, alt_text)').in('id', platformIds) : Promise.resolve({ data: [], error: null }),
    sourceIds.length ? supabase.from('payout_sources').select('id, name').in('id', sourceIds) : Promise.resolve({ data: [], error: null }),
    platformIds.length ? supabase.from('platform_markets').select('platform_id, market').in('platform_id', platformIds) : Promise.resolve({ data: [], error: null }),
  ])
  const markets = new Map<string, string[]>()
  for (const item of marketResult.data ?? []) markets.set(item.platform_id, [...(markets.get(item.platform_id) ?? []), item.market])
  const platforms = new Map<string, HomePlatform>((platformResult.data ?? []).map((row) => {
    const media = first(row.media)
    return [row.id, { id: row.id, name: row.name, slug: row.slug, score: numeric(row.score), logoUrl: media?.file_url ?? null, logoAlt: media?.alt_text ?? null, description: null, profitSplit: null, supportsEa: null, allowsNews: null, allowsWeekend: null, allowsScalping: null, allowsDayTrading: null, allowsCopyTrading: null, markets: markets.get(row.id) ?? [] }]
  }))
  const sources = new Map((sourceResult.data ?? []).map((source) => [source.id, source.name]))
  return rows.map((row) => ({ id: row.id, amount: Number(row.amount), payoutDate: row.payout_date, sourceUrl: row.source_url, externalId: row.external_id, platform: platforms.get(row.platform_id) ?? null, sourceName: row.payout_source_id ? sources.get(row.payout_source_id) ?? null : null, verification: row.verification_status }))
}

function toSummary(row: Record<string, unknown>, platform: Record<string, unknown> | undefined, markets: string[]): PayoutFirmSummary {
  const media = first(platform?.media as Array<{ file_url: string; alt_text: string | null }> | undefined)
  return {
    platformId: String(row.platform_id), name: String(row.platform_name), slug: String(row.slug), logoUrl: media?.file_url ?? stringOrNull(platform?.logo_url) ?? stringOrNull(row.logo_url), logoAlt: media?.alt_text ?? null, markets,
    periodKey: String(row.period_key) as PayoutPeriodKey, displayTotalAmount: numeric(row.display_total_amount), knownPayoutCount: numeric(row.known_payout_count), knownLargestPayout: numeric(row.known_largest_payout), knownAveragePayout: numeric(row.known_average_payout), knownMedianTimeMinutes: numeric(row.known_median_time_minutes), knownCurrency: stringOrNull(row.known_currency),
    displayTotalSourceType: stringOrNull(row.display_total_source_type), displayTotalSourceName: stringOrNull(row.display_total_source_name), displayTotalSourceUrl: stringOrNull(row.display_total_source_url), displayTotalVerificationLevel: verification(row.display_total_verification_level), displayTotalUpdatedAt: stringOrNull(row.display_total_updated_at),
    verifiedAmount: Number(row.verified_amount ?? 0), verifiedPayoutCount: Number(row.verified_payout_count ?? 0), verifiedAveragePayout: numeric(row.verified_average_payout), verifiedLargestPayout: numeric(row.verified_largest_payout), verifiedFirstPayoutAt: stringOrNull(row.verified_first_payout_at), verifiedLastPayoutAt: stringOrNull(row.verified_last_payout_at),
    verificationCoveragePercentage: numeric(row.verification_coverage_percentage), unverifiedCoverageAmount: numeric(row.unverified_coverage_amount), verifiedExceedsKnown: Boolean(row.verified_exceeds_known),
  }
}

function numeric(value: unknown) { return value === null || value === undefined ? null : Number(value) }
function stringOrNull(value: unknown) { return typeof value === 'string' && value ? value : null }
function verification(value: unknown): VerificationLevel | null { return ['verified', 'tracked_external', 'blockchain_external', 'firm_reported', 'unverified'].includes(String(value)) ? value as VerificationLevel : null }
function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function migrationError(message: string) { return /platform_payout_|period_key|external_platform_mappings/i.test(message) ? 'El Payout Tracker requiere ejecutar la migración 202608290001_payout_metrics_periods_and_pfm_mappings.sql en Supabase.' : message }
