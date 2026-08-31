import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium, type Locator, type Page } from 'playwright'

loadEnvConfig(process.cwd())

type PeriodKey = '24h' | '7d' | '30d' | '365d' | 'all'
type Period = { key: PeriodKey; timeWindow: string; selectedLabel: string }
type Mapping = { platform_id: string | null; external_name: string; external_slug: string; external_market: string; external_url: string }
type CapturedMetric = { amount: number; payoutCount: number; largestPayout: number; averagePayout: number; medianTimeMinutes: number; currency: string; page: number; sourceUrl: string }
type CurrentSnapshot = { platform_id: string; period_key: PeriodKey; amount: number | null; payout_count: number | null; largest_payout: number | null; average_payout: number | null; median_time_minutes: number | null }
type Summary = { periodsValid: number; periodsBlocked: number; pagesVisited: number; rowsParsed: number; mappedFirmRowsFound: number; mappedFirmsNotListed: number; snapshotsWouldInsert: number; writes: number; unchanged: number; validationFailures: number; errors: number }

const PROVIDER = 'propfirmmatch'
const SOURCE_NAME = 'Prop Firm Match'
const COLLECTOR_VERSION = '2.0.0'
const TRACKER_URL = 'https://propfirmmatch.com/payouts'
const dryRun = process.argv.includes('--dry-run')
const headless = process.argv.includes('--headless')

const periods: Period[] = [
  { key: '24h', timeWindow: 'DAY', selectedLabel: 'Last 24h' },
  { key: '7d', timeWindow: 'WEEK', selectedLabel: 'Last 7 Days' },
  { key: '30d', timeWindow: 'MONTH', selectedLabel: 'Last 30 Days' },
  { key: '365d', timeWindow: 'YEAR', selectedLabel: 'Last 365 Days' },
  { key: 'all', timeWindow: 'ALL', selectedLabel: 'All Time' },
]

const dryRunFallbackMappings: Mapping[] = [
  { platform_id: null, external_name: 'Lucid Trading', external_slug: 'lucid-trading', external_market: 'futures', external_url: 'https://propfirmmatch.com/futures/prop-firms/lucid-trading/payouts' },
  { platform_id: null, external_name: 'Tradeify', external_slug: 'tradeify', external_market: 'futures', external_url: 'https://propfirmmatch.com/futures/prop-firms/tradeify/payouts' },
  { platform_id: null, external_name: 'FundingPips', external_slug: 'funding-pips', external_market: 'forex', external_url: 'https://propfirmmatch.com/prop-firms/funding-pips/payouts' },
]

async function main() {
  const supabase = createSupabaseClient()
  const mappings = await loadMappings(supabase)
  const currentSnapshots = await loadCurrentSnapshots(supabase, mappings)
  const browser = await chromium.launch({ headless, channel: 'chrome' })
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const summary: Summary = { periodsValid: 0, periodsBlocked: 0, pagesVisited: 0, rowsParsed: 0, mappedFirmRowsFound: 0, mappedFirmsNotListed: 0, snapshotsWouldInsert: 0, writes: 0, unchanged: 0, validationFailures: 0, errors: 0 }

  console.log(`\nProp Firm Match Collector${dryRun ? ' · DRY RUN' : ''}\n`)
  console.log('Browser sessions created: 1')
  console.log('Browser contexts created: 1\n')
  try {
    await page.goto(TRACKER_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await dismissPublicOverlays(page)
    await waitForTrackerReady(page)

    for (const period of periods) {
      console.log(`PFM · ${period.key}`)
      const capturedByName = new Map<string, CapturedMetric>()
      let periodComplete = false
      let periodBlocked = false
      let pageCount = 0
      const rowsBefore = summary.rowsParsed
      const startedAt = Date.now()
      let selectedUrl = ''
      let selectedLabel = ''
      try {
        await selectPeriodThroughUI(page, period)
        selectedUrl = page.url()
        selectedLabel = await selectedPeriodLabel(page)
        pageCount = await detectMaxPage(page)
        summary.pagesVisited++
        console.log(`page 1/${pageCount}`)
        await captureMappedRows(page, mappings, capturedByName, 1, page.url(), summary)
        for (let pageNumber = 2; pageNumber <= pageCount; pageNumber++) {
          summary.pagesVisited++
          await openPaginationPage(page, period, pageNumber)
          console.log(`page ${pageNumber}/${pageCount}`)
          await captureMappedRows(page, mappings, capturedByName, pageNumber, page.url(), summary)
        }
        periodComplete = true
      } catch (error) {
        const message = errorMessage(error)
        periodBlocked = message.startsWith('PAGE_BLOCKED')
        if (periodBlocked) summary.periodsBlocked++
        else summary.errors++
        console.log(`  ${message}`)
      }

      console.log(`selector: ${selectedLabel || 'no disponible'}`)
      console.log(`URL: ${selectedUrl || page.url()}`)
      console.log(`pages: ${pageCount}`)
      console.log(`rows: ${summary.rowsParsed - rowsBefore}`)
      console.log(`Cloudflare: ${periodBlocked ? 'sí' : 'no'}`)
      console.log(`duration: ${Date.now() - startedAt} ms`)

      if (!periodComplete) {
        for (const mapping of mappings) console.log(`${mapping.external_name}: PERIOD_SKIPPED`)
        console.log('')
        await page.waitForTimeout(3_000)
        continue
      }

      for (const mapping of mappings) {
        const captured = capturedByName.get(mapping.external_name.trim())
        if (!captured) {
          summary.mappedFirmsNotListed++
          console.log(`${mapping.external_name}: NOT_LISTED_IN_PERIOD`)
          continue
        }
        summary.mappedFirmRowsFound++
        const current = mapping.platform_id ? currentSnapshots.get(snapshotKey(mapping.platform_id, period.key)) : undefined
        const status = await persistMetric(supabase, mapping, period, captured, current, summary)
        printMetric(mapping.external_name, captured, status)
      }
      summary.periodsValid++
      console.log('')
      await page.waitForTimeout(3_000)
    }
  } finally {
    await browser.close()
  }

  console.log('SUMMARY')
  console.log(JSON.stringify(summary, null, 2))
  if (summary.errors || summary.validationFailures || summary.periodsBlocked) process.exitCode = 1
}

function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    if (dryRun) return null
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias fuera de dry-run')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function loadMappings(supabase: SupabaseClient | null): Promise<Mapping[]> {
  if (supabase) {
    const { data, error } = await supabase.from('external_platform_mappings').select('platform_id, external_name, external_slug, external_market, external_url').eq('provider', PROVIDER).eq('active', true).order('external_name')
    if (!error && data?.length) return data
    if (!dryRun) throw new Error(error?.message ?? 'No hay mappings activos de Prop Firm Match')
    console.warn(`Mappings DB no disponibles; usando los mappings aprobados para dry-run. ${error?.message ?? ''}`)
  }
  return dryRunFallbackMappings
}

async function loadCurrentSnapshots(supabase: SupabaseClient | null, mappings: Mapping[]) {
  const snapshots = new Map<string, CurrentSnapshot>()
  const platformIds = mappings.flatMap((mapping) => mapping.platform_id ? [mapping.platform_id] : [])
  if (!supabase || !platformIds.length) return snapshots
  const { data, error } = await supabase.from('platform_payout_metrics').select('platform_id, period_key, amount, payout_count, largest_payout, average_payout, median_time_minutes').in('platform_id', platformIds).eq('metric_type', 'payout_summary').eq('source_type', 'third_party_public').eq('source_name', SOURCE_NAME).eq('is_current', true)
  if (error) {
    if (!dryRun) throw new Error(`No se pudieron cargar snapshots current: ${error.message}`)
    console.warn(`Snapshots current no disponibles durante dry-run: ${error.message}`)
    return snapshots
  }
  for (const row of (data ?? []) as CurrentSnapshot[]) snapshots.set(snapshotKey(row.platform_id, row.period_key), row)
  return snapshots
}

async function selectPeriodThroughUI(page: Page, period: Period) {
  await dismissPublicOverlays(page)
  assertNotBlocked(await page.locator('body').innerText())
  const selector = page.locator('button[role="combobox"]').first()
  await selector.waitFor({ state: 'visible', timeout: 20_000 })
  await selector.click()
  const option = page.getByRole('option', { name: period.selectedLabel, exact: true })
  await option.waitFor({ state: 'visible', timeout: 10_000 })
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('timeWindow') === period.timeWindow, { timeout: 30_000 }),
    option.click(),
  ])
  await waitForTrackerReady(page)
  await validatePeriod(page, period)
}

async function openPaginationPage(page: Page, period: Period, pageNumber: number) {
  const pagination = page.getByRole('navigation', { name: 'pagination' })
  const pageLink = pagination.getByRole('link', { name: String(pageNumber), exact: true })
  await pageLink.waitFor({ state: 'visible', timeout: 10_000 })
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('timeWindow') === period.timeWindow && url.searchParams.get('page') === String(pageNumber), { timeout: 30_000 }),
    pageLink.click(),
  ])
  await waitForTrackerReady(page)
  await validatePeriod(page, period)
}

async function waitForTrackerReady(page: Page) {
  await dismissPublicOverlays(page)
  const bodyText = (await page.locator('body').innerText()).slice(0, 20_000)
  assertNotBlocked(bodyText)
  const table = page.getByRole('table')
  await table.waitFor({ state: 'visible', timeout: 20_000 })
  const firstDataRow = table.getByRole('row').nth(1)
  const emptyState = page.getByText(/no payouts|no results/i).first()
  await firstDataRow.or(emptyState).waitFor({ state: 'visible', timeout: 20_000 })
}

async function validatePeriod(page: Page, period: Period) {
  const currentUrl = new URL(page.url())
  const selectedLabel = await selectedPeriodLabel(page)
  if (currentUrl.searchParams.get('timeWindow') !== period.timeWindow || selectedLabel !== period.selectedLabel) {
    throw new Error(`PERIOD_MISMATCH: esperado ${period.timeWindow}/${period.selectedLabel}, recibido ${currentUrl.searchParams.get('timeWindow')}/${selectedLabel}`)
  }
}

async function selectedPeriodLabel(page: Page) {
  return (await page.locator('button[role="combobox"]').first().innerText()).trim()
}

function assertNotBlocked(bodyText: string) {
  const blocked = ['Attention Required!', 'Cloudflare', 'Verify you are human'].find((marker) => bodyText.includes(marker))
  if (blocked) throw new Error(`PAGE_BLOCKED: ${blocked}`)
}

async function dismissPublicOverlays(page: Page) {
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click({ timeout: 1_500 }).catch(() => undefined)
  await page.getByRole('button', { name: 'Close', exact: true }).click({ timeout: 1_500 }).catch(() => undefined)
}

async function detectMaxPage(page: Page) {
  const pagination = page.getByRole('navigation', { name: 'pagination' })
  if (await pagination.count() === 0) return 1
  const labels = await pagination.getByRole('link').allTextContents()
  const pages = labels.map((label) => Number(label.trim())).filter(Number.isInteger)
  return pages.length ? Math.max(...pages) : 1
}

async function captureMappedRows(page: Page, mappings: Mapping[], capturedByName: Map<string, CapturedMetric>, pageNumber: number, sourceUrl: string, summary: Summary) {
  const table = page.getByRole('table')
  const rows = await table.getByRole('row').all()
  summary.rowsParsed += Math.max(0, rows.length - 1)
  for (const mapping of mappings) {
    const externalName = mapping.external_name.trim()
    if (capturedByName.has(externalName)) continue
    const firmLink = table.getByRole('link', { name: externalName, exact: true }).first()
    if (await firmLink.count() === 0) continue
    try {
      const row = firmLink.locator('xpath=ancestor::tr')
      capturedByName.set(externalName, await parseRow(row, pageNumber, sourceUrl))
    } catch (error) {
      summary.validationFailures++
      console.log(`${externalName}: ROW_VALIDATION_FAILED · ${errorMessage(error)}`)
    }
  }
}

async function parseRow(row: Locator, pageNumber: number, sourceUrl: string): Promise<CapturedMetric> {
  const cells = await row.getByRole('cell').allTextContents()
  if (cells.length < 6) throw new Error('fila incompleta')
  const amount = parseNumeric(cells[1])
  const payoutCount = Math.trunc(parseNumeric(cells[2]))
  const largestPayout = parseNumeric(cells[3])
  const averagePayout = parseNumeric(cells[4])
  const medianTimeMinutes = parseDurationMinutes(cells[5])
  if (amount <= 0 || payoutCount <= 0 || largestPayout < 0 || averagePayout <= 0 || medianTimeMinutes < 0) throw new Error('métricas fuera de rango')
  const derivedAverage = amount / payoutCount
  const allowedDifference = Math.max(1, derivedAverage * 0.005)
  if (Math.abs(averagePayout - derivedAverage) > allowedDifference) throw new Error(`average incompatible: visible=${averagePayout}, calculado=${derivedAverage.toFixed(2)}`)
  return { amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes, currency: 'USD', page: pageNumber, sourceUrl }
}

function parseNumeric(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed)) throw new Error(`valor no numérico: ${value}`)
  return parsed
}

function parseDurationMinutes(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.includes('less than a minute')) return 0.5
  const amount = Number(normalized.match(/[0-9]+(?:\.[0-9]+)?/)?.[0] ?? NaN)
  if (!Number.isFinite(amount)) throw new Error(`Median Time no interpretable: ${value}`)
  if (normalized.includes('day')) return amount * 1_440
  if (normalized.includes('hour')) return amount * 60
  if (normalized.includes('minute')) return amount
  throw new Error(`unidad desconocida en Median Time: ${value}`)
}

async function persistMetric(supabase: SupabaseClient | null, mapping: Mapping, period: Period, captured: CapturedMetric, current: CurrentSnapshot | undefined, summary: Summary) {
  if (current && sameMetrics(current, captured)) {
    summary.unchanged++
    return 'UNCHANGED'
  }
  if (period.key === 'all' && current?.amount && captured.amount < Number(current.amount) * 0.8) return 'SUSPICIOUS_ALL_TIME_DECREASE'
  if (dryRun) {
    summary.snapshotsWouldInsert++
    return 'VALID · WOULD_INSERT'
  }
  if (!supabase || !mapping.platform_id) throw new Error('Mapping sin platform_id o cliente Supabase')
  const capturedAt = new Date().toISOString()
  const { error } = await supabase.from('platform_payout_metrics').insert({
    platform_id: mapping.platform_id, metric_type: 'payout_summary', period_key: period.key,
    amount: captured.amount, payout_count: captured.payoutCount, largest_payout: captured.largestPayout,
    average_payout: captured.averagePayout, median_time_minutes: captured.medianTimeMinutes,
    currency: captured.currency, source_type: 'third_party_public', source_name: SOURCE_NAME,
    verification_level: 'tracked_external', source_url: captured.sourceUrl, is_current: true, collected_at: capturedAt,
    raw_data: { provider: PROVIDER, captureMethod: 'collector', periodKey: period.key, timeWindow: period.timeWindow, selectedLabel: period.selectedLabel, page: captured.page, capturedAt, sourceUrl: captured.sourceUrl, collectorVersion: COLLECTOR_VERSION, matchingStrategy: 'external_name_exact' },
  })
  if (error) throw new Error(error.message)
  summary.writes++
  return 'INSERTED'
}

function sameMetrics(current: CurrentSnapshot, captured: CapturedMetric) {
  return Number(current.amount) === captured.amount && Number(current.payout_count) === captured.payoutCount && Number(current.largest_payout) === captured.largestPayout && Number(current.average_payout) === captured.averagePayout && Number(current.median_time_minutes) === captured.medianTimeMinutes
}

function snapshotKey(platformId: string, period: PeriodKey) { return `${platformId}:${period}` }

function printMetric(name: string, metric: CapturedMetric, status: string) {
  console.log(name)
  console.log(`  amount=${metric.amount}`)
  console.log(`  count=${metric.payoutCount}`)
  console.log(`  largest=${metric.largestPayout}`)
  console.log(`  average=${metric.averagePayout}`)
  console.log(`  median=${metric.medianTimeMinutes} min`)
  console.log(`  status=${status}`)
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

main().catch((error) => { console.error(errorMessage(error)); process.exitCode = 1 })
