import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium, type Locator, type Page } from 'playwright'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

loadEnvConfig(process.cwd())

type PeriodKey = '24h' | '7d' | '30d' | '365d' | 'all'
type Mapping = { platform_id: string | null; external_name: string }
type Metric = { amount: number; payoutCount: number; largestPayout: number; averagePayout: number; medianTimeMinutes: number; currency: string; sourceUrl: string }
type CapturedPage = { rows: number; metrics: Map<string, Metric> }
type PeriodCapture = { pagesExpected: number; pages: Map<number, CapturedPage> }

const TRACKER_URL = 'https://propfirmmatch.com/payouts'
const dryRun = process.argv.includes('--dry-run')
const periodByWindow: Record<string, { key: PeriodKey; label: string }> = {
  DAY: { key: '24h', label: 'Last 24h' }, WEEK: { key: '7d', label: 'Last 7 Days' },
  MONTH: { key: '30d', label: 'Last 30 Days' }, YEAR: { key: '365d', label: 'Last 365 Days' }, ALL: { key: 'all', label: 'All Time' },
}
const fallbackMappings: Mapping[] = [
  { platform_id: null, external_name: 'Lucid Trading' }, { platform_id: null, external_name: 'Tradeify' }, { platform_id: null, external_name: 'FundingPips' },
]

async function main() {
  const supabase = createSupabaseClient()
  const mappings = await loadMappings(supabase)
  const captures = new Map<PeriodKey, PeriodCapture>()
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  const terminal = createInterface({ input: stdin, output: stdout })

  console.log(`\nPFM Assisted Capture${dryRun ? ' · DRY RUN' : ''}`)
  console.log('Selecciona manualmente un periodo en Prop Firm Match.')
  console.log('Cuando la tabla esté cargada, pulsa ENTER para capturar la página actual.')
  console.log('Escribe q y pulsa ENTER para terminar.\n')
  await page.goto(TRACKER_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })

  try {
    while (true) {
      const command = (await terminal.question('> ')).trim().toLowerCase()
      if (command === 'q' || command === 'quit' || command === 'exit') break
      try {
        const detected = await detectCurrentPage(page, mappings)
        const existing = captures.get(detected.periodKey)
        if (existing?.pages.has(detected.pageNumber)) {
          const recapture = (await terminal.question(`La página ${detected.pageNumber} ya fue capturada. ¿Recapturarla? [y/N] `)).trim().toLowerCase()
          if (recapture !== 'y') continue
        }
        const periodCapture = existing ?? { pagesExpected: detected.lastPage, pages: new Map<number, CapturedPage>() }
        periodCapture.pagesExpected = detected.lastPage
        periodCapture.pages.set(detected.pageNumber, { rows: detected.rows, metrics: detected.metrics })
        captures.set(detected.periodKey, periodCapture)

        console.log(`\nDetected:\nPeriod: ${detected.periodKey}\nPage: ${detected.pageNumber}/${detected.lastPage}\nRows: ${detected.rows}\n`)
        console.log(`Página ${detected.pageNumber}/${detected.lastPage} capturada.`)
        const missingPages = Array.from({ length: detected.lastPage }, (_, index) => index + 1).filter((number) => !periodCapture.pages.has(number))
        if (missingPages.length) {
          console.log(`Faltan páginas: ${missingPages.join(', ')}`)
          console.log('Navega manualmente a la siguiente página y pulsa ENTER.\n')
          continue
        }

        console.log(`\nPeriod ${detected.periodKey} COMPLETE`)
        const combined = combineMetrics(periodCapture)
        for (const mapping of mappings) console.log(`${mapping.external_name} ${combined.has(mapping.external_name.trim()) ? '✅' : 'NOT_LISTED_IN_PERIOD'}`)
        if (dryRun) {
          console.log(`DRY RUN: ${combined.size} snapshots preparados, 0 escrituras.\n`)
          continue
        }
        const save = (await terminal.question(`Periodo ${detected.periodKey} completo. ¿Guardar snapshots? [y/N] `)).trim().toLowerCase()
        if (save === 'y') {
          const inserted = await saveSnapshots(supabase, mappings, detected.periodKey, periodCapture, combined)
          console.log(`${inserted} snapshots insertados con captureMethod=assisted.\n`)
        }
      } catch (error) {
        console.log(`${errorMessage(error)}\n`)
      }
    }
  } finally {
    terminal.close()
    await browser.close()
  }
}

async function detectCurrentPage(page: Page, mappings: Mapping[]) {
  const bodyText = (await page.locator('body').innerText()).slice(0, 20_000)
  const blocked = ['Attention Required!', 'Cloudflare', 'Verify you are human'].find((marker) => bodyText.includes(marker))
  if (blocked) throw new Error(`PAGE_BLOCKED: ${blocked}`)
  const url = new URL(page.url())
  const timeWindow = url.searchParams.get('timeWindow') ?? 'MONTH'
  const period = periodByWindow[timeWindow]
  if (!period) throw new Error(`PERIOD_MISMATCH: timeWindow desconocido (${timeWindow})`)
  const selector = page.locator('button[role="combobox"]').first()
  await selector.waitFor({ state: 'visible', timeout: 10_000 })
  const selectedLabel = (await selector.innerText()).trim()
  if (selectedLabel !== period.label) throw new Error(`PERIOD_MISMATCH: URL=${timeWindow}, selector=${selectedLabel}`)
  const table = page.getByRole('table')
  await table.waitFor({ state: 'visible', timeout: 10_000 })
  const rows = Math.max(0, (await table.getByRole('row').count()) - 1)
  const pageNumber = Number(url.searchParams.get('page') ?? 1)
  const lastPage = await detectLastPage(page)
  return { periodKey: period.key, pageNumber, lastPage, rows, metrics: await extractMappedMetrics(table, page.url(), mappings) }
}

async function detectLastPage(page: Page) {
  const pagination = page.getByRole('navigation', { name: 'pagination' })
  if (await pagination.count() === 0) return 1
  const numbers = (await pagination.getByRole('link').allTextContents()).map((text) => Number(text.trim())).filter(Number.isInteger)
  return numbers.length ? Math.max(...numbers) : 1
}

async function extractMappedMetrics(table: Locator, sourceUrl: string, mappings: Mapping[]) {
  const metrics = new Map<string, Metric>()
  for (const name of mappings.map((mapping) => mapping.external_name.trim())) {
    const link = table.getByRole('link', { name, exact: true }).first()
    if (await link.count() === 0) continue
    metrics.set(name, await parsePfmRow(link.locator('xpath=ancestor::tr'), sourceUrl))
  }
  return metrics
}

async function parsePfmRow(row: Locator, sourceUrl: string): Promise<Metric> {
  const cells = await row.getByRole('cell').allTextContents()
  if (cells.length < 6) throw new Error('ROW_VALIDATION_FAILED: fila incompleta')
  const amount = parseUsNumber(cells[1]), payoutCount = Math.trunc(parseUsNumber(cells[2]))
  const largestPayout = parseUsNumber(cells[3]), averagePayout = parseUsNumber(cells[4]), medianTimeMinutes = parseDuration(cells[5])
  validateMath(amount, payoutCount, largestPayout, averagePayout)
  return { amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes, currency: 'USD', sourceUrl }
}

function combineMetrics(capture: PeriodCapture) {
  const combined = new Map<string, Metric>()
  for (const page of capture.pages.values()) for (const [name, metric] of page.metrics) combined.set(name, metric)
  return combined
}

async function saveSnapshots(supabase: SupabaseClient | null, mappings: Mapping[], periodKey: PeriodKey, capture: PeriodCapture, metrics: Map<string, Metric>) {
  if (!supabase) throw new Error('Supabase no está configurado')
  const capturedAt = new Date().toISOString()
  const pagesCaptured = [...capture.pages.keys()].sort((a, b) => a - b)
  const rows = mappings.flatMap((mapping) => {
    const metric = metrics.get(mapping.external_name.trim())
    if (!metric || !mapping.platform_id) return []
    return [{ platform_id: mapping.platform_id, metric_type: 'payout_summary', period_key: periodKey, amount: metric.amount, payout_count: metric.payoutCount, largest_payout: metric.largestPayout, average_payout: metric.averagePayout, median_time_minutes: metric.medianTimeMinutes, currency: metric.currency, source_type: 'third_party_public', source_name: 'Prop Firm Match', source_url: metric.sourceUrl, verification_level: 'tracked_external', is_current: true, collected_at: capturedAt, raw_data: { provider: 'propfirmmatch', captureMethod: 'assisted', humanNavigated: true, periodKey, pagesCaptured, capturedAt, enteredByAdmin: true } }]
  })
  if (!rows.length) return 0
  const { error } = await supabase.from('platform_payout_metrics').insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}

function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { if (dryRun) return null; throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias') }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function loadMappings(supabase: SupabaseClient | null): Promise<Mapping[]> {
  if (!supabase) return fallbackMappings
  const { data, error } = await supabase.from('external_platform_mappings').select('platform_id, external_name').eq('provider', 'propfirmmatch').eq('active', true).order('external_name')
  if (!error && data?.length) return data
  if (dryRun) return fallbackMappings
  throw new Error(error?.message ?? 'No hay mappings PFM activos')
}

function parseUsNumber(value: string) { const parsed = Number(value.replace(/[^0-9.-]/g, '')); if (!Number.isFinite(parsed)) throw new Error(`ROW_VALIDATION_FAILED: ${value}`); return parsed }
function parseDuration(value: string) { const normalized = value.toLowerCase(); if (normalized.includes('less than a minute')) return 0.5; const amount = Number(normalized.match(/[0-9]+(?:\.[0-9]+)?/)?.[0] ?? NaN); if (normalized.includes('day')) return amount * 1_440; if (normalized.includes('hour')) return amount * 60; if (normalized.includes('minute')) return amount; throw new Error(`ROW_VALIDATION_FAILED: Median Time ${value}`) }
function validateMath(amount: number, count: number, largest: number, average: number) { if (amount <= 0 || count <= 0 || largest < 0 || average <= 0) throw new Error('ROW_VALIDATION_FAILED: métricas fuera de rango'); const expected = amount / count; if (Math.abs(average - expected) > Math.max(1, expected * 0.005)) throw new Error(`ROW_VALIDATION_FAILED: promedio ${average} vs ${expected.toFixed(2)}`) }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

main().catch((error) => { console.error(errorMessage(error)); process.exitCode = 1 })
