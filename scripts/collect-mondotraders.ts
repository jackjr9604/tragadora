import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium, type Locator, type Page } from 'playwright'

loadEnvConfig(process.cwd())

type PeriodKey = '24h' | '7d' | '30d' | 'all'
type MarketKey = 'forex' | 'futures' | 'crypto'
type Period = { key: PeriodKey; label: string }
type Mapping = { platform_id: string | null; external_name: string; external_url: string }
type Metric = { amount: number; payoutCount: number; largestPayout: number; averagePayout: number; medianTimeMinutes: number | null; currency: string }
type ParsedMetric = { amount: number | null; payoutCount: number | null; largestPayout: number | null; averagePayout: number | null; medianTimeMinutes: number | null }
type CatalogFirm = { external_name: string; external_slug: string | null; external_url: string | null; normalized_name: string; markets_seen: MarketKey[]; periods_seen: PeriodKey[] }
type RowDiagnostic = {
  firm: string
  period: PeriodKey
  visible_row_text: string
  raw: { amount: string; count: string; largest: string; average: string; payout_time: string }
  parsed: { amount: number | null; count: number | null; largest: number | null; average: number | null; payout_time_minutes: number | null }
  missing_metrics: string[]
  failed_rules: string[]
  observations: string[]
}

const BASE_URL = 'https://mondotraders.com/en/'
const SOURCE_NAME = 'MondoTraders'
const dryRun = process.argv.includes('--dry-run')
const catalogMode = process.argv.includes('--catalog')
const diagnoseMode = process.argv.includes('--diagnose')
const isCI = Boolean(process.env.CI)
const headless = isCI || process.argv.includes('--headless')
const periods: Period[] = [
  { key: '24h', label: 'Last 24h' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' }, { key: 'all', label: 'All time' },
]
const markets: Array<{ key: MarketKey; label: 'Forex' | 'Futures' | 'Crypto' }> = [
  { key: 'forex', label: 'Forex' }, { key: 'futures', label: 'Futures' }, { key: 'crypto', label: 'Crypto' },
]
const fallbackMappings: Mapping[] = [
  { platform_id: null, external_name: 'Lucid Trading', external_url: 'https://mondotraders.com/en/firma/Lucid%20Trading' },
  { platform_id: null, external_name: 'Tradeify', external_url: 'https://mondotraders.com/en/firma/Tradeify' },
  { platform_id: null, external_name: 'FundingPips', external_url: 'https://mondotraders.com/en/firma/FundingPips' },
]

async function main() {
  const startedAt = new Date().toISOString()
  const supabase = createSupabaseClient()
  const mappings = await loadMappings(supabase)
  const browser = await chromium.launch(isCI ? { headless: true } : { headless, channel: 'chrome' })
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  const summary = { startedAt, finishedAt: '', periodsChecked: 0, periodsSucceeded: 0, periodFailures: 0, rowsParsed: 0, mappedRowsFound: 0, notListed: 0, missingRequiredMetrics: 0, validationFailures: 0, blocked: 0, snapshotsPrepared: 0, snapshotsWouldInsert: 0, writes: 0 }
  const catalog = new Map<string, CatalogFirm>()
  const diagnostics: RowDiagnostic[] = []

  console.log(`\nMondoTraders collector${catalogMode ? ' · CATALOG DIAGNOSTIC' : diagnoseMode ? ' · ROW VALIDATION DIAGNOSTIC' : dryRun ? ' · DRY RUN' : ''}`)
  console.log(`Started at: ${startedAt}`)
  console.log(`Environment: ${isCI ? 'GitHub Actions / CI' : 'local'} · headless=${headless}`)
  console.log(`Active mappings: ${mappings.length}`)
  console.log('Available periods: 24h, 7d, 30d, all')
  console.log(`URLs: ${BASE_URL} (sin parámetros; estado controlado por botones visibles)`)
  console.log('Pagination: none; all rows are rendered in the public table')
  console.log('Documented public API: none found\n')

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    for (const period of periods) {
      summary.periodsChecked++
      console.log(`Mondo · ${period.key}`)
      try {
        assertNotBlocked((await page.locator('body').innerText()).slice(0, 20_000))
        await dismissTransientModal(page)
        const button = page.getByRole('button', { name: period.label, exact: true })
        await button.click({ force: true })
        try {
          await waitForSelectedPeriod(page, period)
        } catch {
          await dismissTransientModal(page)
          await button.click({ force: true })
          await waitForSelectedPeriod(page, period)
        }
        const table = page.getByRole('table')
        await table.waitFor({ state: 'visible', timeout: 15_000 })
        if (catalogMode) await selectMarket(page, 'All')
        const rows = Math.max(0, (await table.getByRole('row').count()) - 1)
        summary.rowsParsed += rows
        summary.periodsSucceeded++
        console.log(`selector=${period.label} url=${page.url()} rows=${rows} pagination=none Cloudflare=no`)

        const rowByName = await indexRowsByExactName(table)
        if (catalogMode) {
          await collectCatalogRows(table, period.key, catalog, null)
          for (const market of markets) {
            await selectMarket(page, market.label)
            await collectCatalogRows(table, period.key, catalog, market.key)
          }
          continue
        }
        for (const mapping of mappings) {
          const row = rowByName.get(mapping.external_name.trim())
          if (!row) { summary.notListed++; console.log(`${mapping.external_name}: NOT_LISTED_IN_PERIOD`); continue }
          if (diagnoseMode) {
            const diagnostic = await diagnoseMondoRow(row, mapping.external_name, period.key)
            if (diagnostic.missing_metrics.length) {
              summary.missingRequiredMetrics++
              diagnostics.push(diagnostic)
              printMissingRequiredMetrics(mapping.external_name, period.key, diagnostic.missing_metrics)
            } else if (diagnostic.failed_rules.length) {
              summary.validationFailures++
              diagnostics.push(diagnostic)
              console.log(`${mapping.external_name}: ROW_VALIDATION_FAILED · ${diagnostic.failed_rules.join('; ')}`)
            } else {
              summary.mappedRowsFound++
            }
            continue
          }
          try {
            const metric = await parseMondoRow(row)
            summary.mappedRowsFound++
            summary.snapshotsPrepared++
            printMetric(mapping.external_name, metric)
            if (dryRun) { summary.snapshotsWouldInsert++; console.log('  status=VALID · WOULD_INSERT'); continue }
            await insertSnapshot(supabase, mapping, period.key, metric)
            summary.writes++
            console.log('  status=INSERTED')
          } catch (error) {
            if (error instanceof MissingRequiredMetricsError) {
              summary.missingRequiredMetrics++
              printMissingRequiredMetrics(mapping.external_name, period.key, error.missingMetrics)
            } else {
              summary.validationFailures++
              console.log(`${mapping.external_name}: ROW_VALIDATION_FAILED · ${errorMessage(error)}`)
            }
          }
        }
      } catch (error) {
        summary.periodFailures++
        if (errorMessage(error).startsWith('PAGE_BLOCKED')) summary.blocked++
        console.error(`PERIOD_FAILED · ${period.key} · ${errorMessage(error)}`)
      }
      console.log('')
    }
  } finally {
    await browser.close()
  }

  summary.finishedAt = new Date().toISOString()
  console.log(`Finished at: ${summary.finishedAt}`)
  console.log('SUMMARY')
  console.log(JSON.stringify(summary, null, 2))
  if (catalogMode) printCatalog(catalog, mappings, summary.rowsParsed)
  if (diagnoseMode) {
    console.log('\nROW VALIDATION FAILURES')
    console.log(JSON.stringify(diagnostics, null, 2))
  }
  if (summary.periodFailures || summary.blocked || (!diagnoseMode && summary.validationFailures) || (!catalogMode && !diagnoseMode && summary.snapshotsPrepared === 0)) process.exitCode = 1
}

async function waitForSelectedPeriod(page: Page, period: Period) {
  await page.waitForFunction(({ label }) => {
    const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === label)
    return button?.className.includes('shadow-sm') && !button.className.includes('bg-transparent')
  }, { label: period.label }, { timeout: 15_000 })
  assertNotBlocked((await page.locator('body').innerText()).slice(0, 20_000))
}

async function dismissTransientModal(page: Page) {
  const closeButton = page.locator('div.fixed.inset-0.z-\\[200\\]').getByRole('button', { name: 'Close', exact: true })
  if (await closeButton.count() > 0 && await closeButton.isVisible()) await closeButton.click({ force: true })
}

async function indexRowsByExactName(table: Locator) {
  const indexed = new Map<string, Locator>()
  const rows = await table.getByRole('row').all()
  for (const row of rows.slice(1)) {
    const link = row.getByRole('link').first()
    if (await link.count() === 0) continue
    const name = (await link.innerText()).trim()
    if (name) indexed.set(name, row)
  }
  return indexed
}

async function selectMarket(page: Page, label: 'All' | 'Forex' | 'Futures' | 'Crypto') {
  const button = page.getByRole('button', { name: label, exact: true })
  await button.click()
  await page.waitForFunction(({ selectedLabel }) => {
    const marketButton = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === selectedLabel)
    return marketButton?.className.includes('shadow-sm') && !marketButton.className.includes('bg-transparent')
  }, { selectedLabel: label }, { timeout: 15_000 })
}

async function collectCatalogRows(table: Locator, period: PeriodKey, catalog: Map<string, CatalogFirm>, market: MarketKey | null) {
  const rows = await table.getByRole('row').all()
  for (const row of rows.slice(1)) {
    const link = row.getByRole('link').first()
    if (await link.count() === 0) continue
    const externalName = (await link.innerText()).trim()
    if (!externalName) continue
    const normalizedName = normalizeExternalName(externalName)
    const href = await link.getAttribute('href')
    const url = href ? externalUrl(href) : null
    const current = catalog.get(normalizedName)
    if (current) {
      if (!current.periods_seen.includes(period)) current.periods_seen.push(period)
      if (!current.external_slug && href) current.external_slug = externalSlug(href)
      if (!current.external_url && url) current.external_url = url
      if (market && !current.markets_seen.includes(market)) current.markets_seen.push(market)
      continue
    }
    catalog.set(normalizedName, {
      external_name: externalName,
      external_slug: href ? externalSlug(href) : null,
      external_url: url,
      normalized_name: normalizedName,
      markets_seen: market ? [market] : [],
      periods_seen: [period],
    })
  }
}

function printCatalog(catalog: Map<string, CatalogFirm>, mappings: Mapping[], rowsParsed: number) {
  const mappedNames = new Set(mappings.map((mapping) => normalizeExternalName(mapping.external_name)))
  const firms = [...catalog.values()].sort((a, b) => a.external_name.localeCompare(b.external_name, 'en'))
  const mapped = firms.filter((firm) => mappedNames.has(firm.normalized_name))
  const unmapped = firms.filter((firm) => !mappedNames.has(firm.normalized_name))
  const firmsWithMarket = firms.filter((firm) => firm.markets_seen.length > 0)
  const firmsWithoutMarket = firms.filter((firm) => firm.markets_seen.length === 0)
  const firmsWithMultipleMarkets = firms.filter((firm) => firm.markets_seen.length > 1)
  const printableFirms = firms.map(({ normalized_name: _normalizedName, markets_seen, ...firm }) => ({
    ...firm,
    external_market: markets_seen.length === 0 ? null : markets_seen.length === 1 ? markets_seen[0] : markets_seen,
  }))
  console.log('\nMONDO FIRM CATALOG')
  console.log(JSON.stringify(printableFirms, null, 2))
  console.log('\nCATALOG SUMMARY')
  console.log(JSON.stringify({ rows_parsed: rowsParsed, unique_firms: firms.length, mapped: mapped.length, unmapped: unmapped.length, firms_with_market: firmsWithMarket.length, firms_without_market: firmsWithoutMarket.length, firms_with_multiple_markets: firmsWithMultipleMarkets.length }, null, 2))
  console.log('\nUNMAPPED MONDO FIRMS')
  console.log(JSON.stringify(unmapped.map((firm) => ({ external_name: firm.external_name, external_slug: firm.external_slug, normalized_name: firm.normalized_name, external_market: firm.markets_seen.length === 0 ? null : firm.markets_seen.length === 1 ? firm.markets_seen[0] : firm.markets_seen })), null, 2))
  if (firmsWithMultipleMarkets.length) {
    console.log('\nFIRMS WITH MULTIPLE MONDO MARKETS')
    console.log(JSON.stringify(firmsWithMultipleMarkets.map((firm) => ({ external_name: firm.external_name, external_markets: firm.markets_seen })), null, 2))
  }
}

function normalizeExternalName(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function externalSlug(href: string) {
  try {
    const pathname = new URL(href, BASE_URL).pathname
    const segment = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '')
    return segment ? normalizeExternalName(segment).replaceAll(' ', '-') : null
  } catch {
    return null
  }
}

function externalUrl(href: string) {
  try { return new URL(href, BASE_URL).toString() } catch { return null }
}

async function parseMondoRow(row: Locator): Promise<Metric> {
  const cells = await row.getByRole('cell').allTextContents()
  if (cells.length < 7) throw new Error('fila incompleta')
  const amount = parseThousands(cells[2]), parsedCount = parseThousands(cells[3])
  const payoutCount = parsedCount === null ? null : Math.trunc(parsedCount)
  const largestPayout = parseThousands(cells[4]), averagePayout = parseThousands(cells[5])
  const medianTimeMinutes = parseDuration(cells[6])
  const parsed: ParsedMetric = { amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes }
  const missingMetrics = requiredMetricsMissing(parsed)
  if (amount === null || payoutCount === null || largestPayout === null || averagePayout === null) {
    throw new MissingRequiredMetricsError(missingMetrics)
  }
  if (amount <= 0 || payoutCount <= 0 || largestPayout < 0 || averagePayout <= 0) throw new Error('métricas fuera de rango')
  const calculatedAverage = amount / payoutCount
  if (Math.abs(averagePayout - calculatedAverage) > Math.max(1, calculatedAverage * 0.005)) throw new Error(`promedio ${averagePayout} vs ${calculatedAverage.toFixed(2)}`)
  return { amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes, currency: 'USD' }
}

async function diagnoseMondoRow(row: Locator, firm: string, period: PeriodKey): Promise<RowDiagnostic> {
  const cells = await row.getByRole('cell').allTextContents()
  if (cells.length < 7) throw new Error(`fila incompleta en diagnóstico: ${firm}/${period}`)
  const amount = parseThousands(cells[2])
  const parsedCount = parseThousands(cells[3])
  const payoutCount = parsedCount === null ? null : Math.trunc(parsedCount)
  const largestPayout = parseThousands(cells[4])
  const averagePayout = parseThousands(cells[5])
  const payoutTimeMinutes = parseDuration(cells[6])
  const parsed: ParsedMetric = { amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes: payoutTimeMinutes }
  const missingMetrics = requiredMetricsMissing(parsed)
  const failedRules: string[] = []
  const observations: string[] = []
  if (amount !== null && amount <= 0) failedRules.push(`amount > 0 (actual: ${amount})`)
  if (payoutCount !== null && payoutCount <= 0) failedRules.push(`count > 0 (actual: ${payoutCount})`)
  if (largestPayout !== null && largestPayout < 0) failedRules.push(`largest >= 0 (actual: ${largestPayout})`)
  if (averagePayout !== null && averagePayout <= 0) failedRules.push(`average > 0 (actual: ${averagePayout})`)
  if (amount !== null && payoutCount !== null && averagePayout !== null && amount > 0 && payoutCount > 0) {
    const calculatedAverage = amount / payoutCount
    const difference = Math.abs(averagePayout - calculatedAverage)
    const tolerance = Math.max(1, calculatedAverage * 0.005)
    if (difference > tolerance) failedRules.push(`abs(average - amount/count) <= max(1, calculatedAverage * 0.005) (actual difference: ${difference.toFixed(6)}, tolerance: ${tolerance.toFixed(6)})`)
  } else if (!missingMetrics.length) {
    observations.push('La regla de consistencia average ≈ amount/count no se evalúa porque amount o count no es positivo.')
  }
  if (largestPayout !== null && amount !== null && largestPayout > amount) observations.push(`largest (${largestPayout}) > amount (${amount}); esta relación no es una regla de rechazo actual.`)
  return {
    firm,
    period,
    visible_row_text: await row.innerText(),
    raw: { amount: cells[2].trim(), count: cells[3].trim(), largest: cells[4].trim(), average: cells[5].trim(), payout_time: cells[6].trim() },
    parsed: { amount, count: payoutCount, largest: largestPayout, average: averagePayout, payout_time_minutes: payoutTimeMinutes },
    missing_metrics: missingMetrics,
    failed_rules: failedRules,
    observations,
  }
}

function requiredMetricsMissing(metric: ParsedMetric) {
  const missing: string[] = []
  if (metric.amount === null) missing.push('amount')
  if (metric.payoutCount === null) missing.push('payout_count')
  if (metric.largestPayout === null) missing.push('largest_payout')
  if (metric.averagePayout === null) missing.push('average_payout')
  return missing
}

class MissingRequiredMetricsError extends Error {
  constructor(readonly missingMetrics: string[]) {
    super(`MISSING_REQUIRED_METRICS: ${missingMetrics.join(',')}`)
    this.name = 'MissingRequiredMetricsError'
  }
}

function printMissingRequiredMetrics(firm: string, period: PeriodKey, missingMetrics: string[]) {
  console.log(firm)
  console.log(`  period=${period}`)
  console.log(`  missing=${missingMetrics.join(',')}`)
  console.log('  status=MISSING_REQUIRED_METRICS')
}

function parseThousands(value: string): number | null {
  const normalized = value.trim()
  if (normalized === '' || normalized === '—' || normalized === '-' || normalized.toUpperCase() === 'N/A') return null
  const parsed = Number(normalized.replace(/[^0-9-]/g, ''))
  if (!Number.isFinite(parsed)) throw new Error(`valor no numérico: ${value}`)
  return parsed
}
function parseDuration(value: string) { const normalized = value.toLowerCase(); if (normalized === 'n/a') return null; if (normalized.includes('less than a minute')) return 0.5; const amount = Number(normalized.match(/[0-9]+(?:\.[0-9]+)?/)?.[0] ?? NaN); if (normalized.includes('day')) return amount * 1_440; if (normalized.includes('hour')) return amount * 60; if (normalized.includes('minute')) return amount; throw new Error(`Avg. Time no interpretable: ${value}`) }
function assertNotBlocked(text: string) { const marker = ['Attention Required!', 'Cloudflare', 'Verify you are human'].find((item) => text.includes(item)); if (marker) throw new Error(`PAGE_BLOCKED: ${marker}`) }

async function insertSnapshot(supabase: SupabaseClient | null, mapping: Mapping, periodKey: PeriodKey, metric: Metric) {
  if (!supabase || !mapping.platform_id) throw new Error('Mapping sin platform_id o Supabase no configurado')
  const capturedAt = new Date().toISOString()
  const { error } = await supabase.from('platform_payout_metrics').insert({ platform_id: mapping.platform_id, metric_type: 'payout_summary', period_key: periodKey, amount: metric.amount, payout_count: metric.payoutCount, largest_payout: metric.largestPayout, average_payout: metric.averagePayout, median_time_minutes: metric.medianTimeMinutes, currency: metric.currency, source_type: 'third_party_public', source_name: SOURCE_NAME, source_url: BASE_URL, verification_level: 'blockchain_external', is_current: true, collected_at: capturedAt, raw_data: { provider: 'mondotraders', captureMethod: 'collector', methodology: 'external_blockchain_tracking', sourceUrl: BASE_URL, capturedAt } })
  if (error) throw new Error(error.message)
}

function createSupabaseClient(): SupabaseClient | null { const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) { if (dryRun) return null; throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias') } return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }
async function loadMappings(supabase: SupabaseClient | null): Promise<Mapping[]> { if (!supabase) return fallbackMappings; const { data, error } = await supabase.from('external_platform_mappings').select('platform_id, external_name, external_url').eq('provider', 'mondotraders').eq('active', true).order('external_name'); if (!error && data?.length) return data; if (dryRun) return fallbackMappings; throw new Error(error?.message ?? 'No hay mappings MondoTraders activos') }
function printMetric(name: string, metric: Metric) { console.log(name); console.log(`  amount=${metric.amount}`); console.log(`  count=${metric.payoutCount}`); console.log(`  largest=${metric.largestPayout}`); console.log(`  average=${metric.averagePayout}`); console.log(`  payoutTime=${metric.medianTimeMinutes ?? 'N/A'} min`) }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

main().catch((error) => { console.error(errorMessage(error)); process.exitCode = 1 })
