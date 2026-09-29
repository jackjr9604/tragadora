import { loadEnvConfig } from '@next/env'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { chromium } from 'playwright'

import { assertSafeCollectorTarget, collectOfficialPeriod, configureSafeContext, snapshotsEqual, validateOfficialConfig, type OfficialPageCollectorConfig } from './official-page-collector.ts'


loadEnvConfig(process.cwd())


type SourceRow = { id: string; platform_id: string; name: string; source_url: string | null; config: Record<string, unknown> | null; platforms: { slug: string; name: string } | { slug: string; name: string }[] | null }
type CurrentSnapshot = { period_key: string; amount: number | null; payout_count: number | null; largest_payout: number | null; average_payout: number | null; raw_data: Record<string, unknown> | null }


const dryRun = process.argv.includes('--dry-run')
const headless = process.argv.includes('--headless') || Boolean(process.env.CI)
const requestedPlatform = argumentValue('--platform')

async function main() {
  const supabase = createSupabase()
  const sources = await loadSources(supabase)
  const selected = requestedPlatform ? sources.filter((source) => platform(source).slug === requestedPlatform) : sources
  if (!selected.length) throw new Error(requestedPlatform ? `No hay collector oficial activo para ${requestedPlatform}` : 'No hay collectors de página oficial activos')

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ locale: 'en-US' })
  await configureSafeContext(context)
  const summary = { sources: selected.length, periods: 0, succeeded: 0, failed: 0, warnings: 0, unchanged: 0, writes: 0 }
  console.log(`\nOfficial payout page collector${dryRun ? ' · DRY RUN' : ''}`)

  try {
    for (const source of selected) {
      console.log(`\n${platform(source).name} · ${source.name}`)
      let sourceError: string | null = null
      let page: Awaited<ReturnType<typeof context.newPage>> | null = null
      try {
        const config = validateOfficialConfig(source.config?.collector)
        if (!source.source_url) throw new Error(`${source.name}: source_url requerido`)
        await assertSafeCollectorTarget(source.source_url)
        page = await context.newPage()
        const response = await page.goto(source.source_url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        if (!response?.ok()) throw new Error(`PAGE_LOAD_FAILED: HTTP ${response?.status() ?? 'unknown'}`)
        if (assertBlocked(await page.locator('body').innerText())) throw new Error('PAGE_BLOCKED: Cloudflare o challenge detectado')
        await page.locator(config.waitForSelector).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30_000 })
        const current = await loadCurrentSnapshots(source.id === 'dry-run' ? null : supabase, source.platform_id, config.sourceName)
        for (const period of config.periods) {
          summary.periods++
          try {
            const result = await collectOfficialPeriod(page, config, period)
            summary.warnings += result.diagnostics.length
            const previous = current.get(period.periodKey)
            const comparable = previous ? { amount: previous.amount, payoutCount: previous.payout_count, largestPayout: previous.largest_payout, averagePayout: previous.average_payout, raw_data: previous.raw_data } : null
            if (comparable && snapshotsEqual(comparable, result)) {
              summary.unchanged++; summary.succeeded++
              console.log(`${period.periodKey}: UNCHANGED · SKIPPED`)
              continue
            }
            const capturedAt = new Date().toISOString()
            const payload = {
              platform_id: source.platform_id, metric_type: 'payout_summary', period_key: period.periodKey,
              amount: result.metrics.amount, payout_count: result.metrics.payoutCount, largest_payout: result.metrics.largestPayout,
              average_payout: result.metrics.averagePayout, median_time_minutes: null, currency: config.currency,
              source_type: 'official_firm', source_name: config.sourceName, source_url: source.source_url,
              verification_level: 'firm_reported', is_current: true, collected_at: capturedAt,
              raw_data: { collector: { kind: config.kind, version: config.version }, capturedAt, sourceUrl: source.source_url, selectedPeriod: period.periodKey, visibleValues: result.visibleValues, parsedValues: result.metrics, average_processing_minutes: result.averageProcessingMinutes, recent_rewards: result.recentRewards, diagnostics: result.diagnostics },
            }
            if (!dryRun) {
              if (!supabase) throw new Error('Supabase no configurado para escritura')
              const { error } = await supabase.from('platform_payout_metrics').insert(payload)
              if (error) throw new Error(error.message)
              summary.writes++
            }
            summary.succeeded++
            console.log(`${period.periodKey}: ${dryRun ? 'WOULD_INSERT' : 'INSERTED'}`, JSON.stringify({ metrics: result.metrics, averageProcessingMinutes: result.averageProcessingMinutes, recentRewards: result.recentRewards.length, visibleValues: result.visibleValues }))
          } catch (error) {
            summary.failed++
            sourceError ??= `${period.periodKey}: ${message(error)}`
            console.error(`${period.periodKey}: FAILED · ${message(error)}`)
          }
        }
      } catch (error) {
        summary.failed++
        sourceError = message(error)
        console.error(`SOURCE_FAILED · ${sourceError}`)
      } finally {
        if (page) await page.close()
        if (!dryRun && supabase && source.id !== 'dry-run') {
          await updateSourceStatus(supabase, source.id, sourceError)
        }
      }
    }
  } finally { await browser.close() }
  console.log('\nSUMMARY', summary)
  if (summary.failed) process.exitCode = 1
}

async function updateSourceStatus(supabase: SupabaseClient, sourceId: string, sourceError: string | null) {
  const now = new Date().toISOString()
  const payload = sourceError
    ? { last_sync_at: now, last_error: sourceError }
    : { last_sync_at: now, last_success_at: now, last_error: null }
  const { error } = await supabase.from('payout_sources').update(payload).eq('id', sourceId)
  if (error) throw new Error(`No se pudo actualizar el estado de la fuente: ${error.message}`)
}

function createSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { if (dryRun && requestedPlatform === 'the-trading-pit') return null; throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados') }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function loadSources(supabase: SupabaseClient | null): Promise<SourceRow[]> {
  if (!supabase) return [theTradingPitFallback]
  let query = supabase.from('payout_sources').select('id, platform_id, name, source_url, config, platforms!inner(slug, name)').eq('source_type', 'public_page').eq('status', true)
  if (requestedPlatform) query = query.eq('platforms.slug', requestedPlatform)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const sources = (data ?? []) as unknown as SourceRow[]
  if (dryRun && requestedPlatform === 'the-trading-pit' && (!sources.length || !objectValue(sources[0].config?.collector).enabled)) return [theTradingPitFallback]
  return sources
}

async function loadCurrentSnapshots(supabase: SupabaseClient | null, platformId: string, sourceName: string) {
  const map = new Map<string, CurrentSnapshot>()
  if (!supabase) return map
  const { data, error } = await supabase.from('platform_payout_metrics').select('period_key, amount, payout_count, largest_payout, average_payout, raw_data').eq('platform_id', platformId).eq('metric_type', 'payout_summary').eq('source_type', 'official_firm').eq('source_name', sourceName).eq('is_current', true)
  if (error) throw new Error(error.message)
  for (const row of data ?? []) map.set(row.period_key, row as CurrentSnapshot)
  return map
}

function platform(source: SourceRow) { return Array.isArray(source.platforms) ? source.platforms[0] : source.platforms ?? { slug: '', name: '' } }
function argumentValue(name: string) { const direct = process.argv.find((arg) => arg.startsWith(`${name}=`)); if (direct) return direct.slice(name.length + 1); const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined }
function assertBlocked(text: string) { return /attention required|checking your browser|verify you are human|cloudflare ray id/i.test(text.slice(0, 20_000)) }
function message(error: unknown) { return error instanceof Error ? error.message : String(error) }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }

const theTradingPitCollector: OfficialPageCollectorConfig = {
  enabled: true, kind: 'official_page', version: 1, currency: 'USD', sourceName: 'The Trading Pit Rewards', waitForSelector: '#overall-rewards-card',
  periods: [
    { periodKey: 'all', label: 'All time', triggerSelector: 'button[data-period="all"]:visible', activeSelector: 'button[data-period="all"].active:visible' },
    { periodKey: '30d', label: 'Last 30 days', triggerSelector: 'button[data-period="30days"]:visible', activeSelector: 'button[data-period="30days"].active:visible' },
  ],
  metrics: { amount: { selector: '#stats-total-value', parser: 'currency', required: true }, averagePayout: { selector: '#stats-avg-value', parser: 'currency', required: true } },
  averageProcessingTime: { selector: '#stats-duration-value', parser: 'hours', required: false },
  recentRewards: { rowSelector: '#recent-rewards-tbody tr', columns: { date: 0, market: 1, accountBalance: 2, reward: 3 }, limit: 20 },
}

const theTradingPitFallback: SourceRow = { id: 'dry-run', platform_id: 'dry-run-the-trading-pit', name: 'The Trading Pit · Rewards oficiales', source_url: 'https://www.thetradingpit.com/lp/all-rewards', config: { collector: theTradingPitCollector }, platforms: { slug: 'the-trading-pit', name: 'The Trading Pit' } }

void main().catch((error) => { console.error(message(error)); process.exitCode = 1 })
