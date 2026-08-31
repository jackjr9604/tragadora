import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium, type Locator, type Page } from 'playwright'

loadEnvConfig(process.cwd())

type PeriodKey = '24h' | '7d' | '30d' | 'all'
type Period = { key: PeriodKey; label: string }
type Mapping = { platform_id: string | null; external_name: string; external_url: string }
type Metric = { amount: number; payoutCount: number; largestPayout: number; averagePayout: number; medianTimeMinutes: number | null; currency: string }

const BASE_URL = 'https://mondotraders.com/en/'
const SOURCE_NAME = 'MondoTraders'
const dryRun = process.argv.includes('--dry-run')
const isCI = Boolean(process.env.CI)
const headless = isCI || process.argv.includes('--headless')
const periods: Period[] = [
  { key: '24h', label: 'Last 24h' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' }, { key: 'all', label: 'All time' },
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
  const summary = { startedAt, finishedAt: '', periodsChecked: 0, periodsSucceeded: 0, periodFailures: 0, rowsParsed: 0, mappedRowsFound: 0, notListed: 0, validationFailures: 0, blocked: 0, snapshotsPrepared: 0, snapshotsWouldInsert: 0, writes: 0 }

  console.log(`\nMondoTraders collector${dryRun ? ' · DRY RUN' : ''}`)
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
        const button = page.getByRole('button', { name: period.label, exact: true })
        await button.click()
        await waitForSelectedPeriod(page, period)
        const table = page.getByRole('table')
        await table.waitFor({ state: 'visible', timeout: 15_000 })
        const rows = Math.max(0, (await table.getByRole('row').count()) - 1)
        summary.rowsParsed += rows
        summary.periodsSucceeded++
        console.log(`selector=${period.label} url=${page.url()} rows=${rows} pagination=none Cloudflare=no`)

        const rowByName = await indexRowsByExactName(table)
        for (const mapping of mappings) {
          const row = rowByName.get(mapping.external_name.trim())
          if (!row) { summary.notListed++; console.log(`${mapping.external_name}: NOT_LISTED_IN_PERIOD`); continue }
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
            summary.validationFailures++
            console.log(`${mapping.external_name}: ROW_VALIDATION_FAILED · ${errorMessage(error)}`)
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
  if (summary.periodFailures || summary.blocked || summary.validationFailures || summary.snapshotsPrepared === 0) process.exitCode = 1
}

async function waitForSelectedPeriod(page: Page, period: Period) {
  await page.waitForFunction(({ label }) => {
    const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === label)
    return button?.className.includes('shadow-sm') && !button.className.includes('bg-transparent')
  }, { label: period.label }, { timeout: 15_000 })
  assertNotBlocked((await page.locator('body').innerText()).slice(0, 20_000))
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

async function parseMondoRow(row: Locator): Promise<Metric> {
  const cells = await row.getByRole('cell').allTextContents()
  if (cells.length < 7) throw new Error('fila incompleta')
  const amount = parseThousands(cells[2]), payoutCount = Math.trunc(parseThousands(cells[3]))
  const largestPayout = parseThousands(cells[4]), averagePayout = parseThousands(cells[5])
  const medianTimeMinutes = parseDuration(cells[6])
  if (amount <= 0 || payoutCount <= 0 || largestPayout < 0 || averagePayout <= 0) throw new Error('métricas fuera de rango')
  const calculatedAverage = amount / payoutCount
  if (Math.abs(averagePayout - calculatedAverage) > Math.max(1, calculatedAverage * 0.005)) throw new Error(`promedio ${averagePayout} vs ${calculatedAverage.toFixed(2)}`)
  return { amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes, currency: 'USD' }
}

function parseThousands(value: string) { const parsed = Number(value.replace(/[^0-9-]/g, '')); if (!Number.isFinite(parsed)) throw new Error(`valor no numérico: ${value}`); return parsed }
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
