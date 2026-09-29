import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { BrowserContext, Page } from 'playwright'

export type OfficialPeriodKey = '24h' | '7d' | '30d' | '365d' | 'all'
export type OfficialParser = 'currency' | 'integer' | 'number' | 'hours' | 'minutes' | 'percentage' | 'text'
export type OfficialMetricKey = 'amount' | 'payoutCount' | 'largestPayout' | 'averagePayout'

export type OfficialMetricDefinition = {
  selector: string
  parser: OfficialParser
  required: boolean
}

export type OfficialPeriodDefinition = {
  periodKey: OfficialPeriodKey
  label: string
  triggerSelector: string
  activeSelector: string
}

export type OfficialRecentRewardsDefinition = {
  rowSelector: string
  columns: { date: number; market: number; accountBalance: number; reward: number }
  limit?: number
}

export type OfficialPageCollectorConfig = {
  enabled: boolean
  kind: 'official_page'
  version: number
  currency: string
  sourceName: string
  waitForSelector: string
  periods: OfficialPeriodDefinition[]
  metrics: Partial<Record<OfficialMetricKey, OfficialMetricDefinition>>
  averageProcessingTime?: OfficialMetricDefinition
  recentRewards?: OfficialRecentRewardsDefinition
}

export type ParsedOfficialMetrics = {
  amount: number | null
  payoutCount: number | null
  largestPayout: number | null
  averagePayout: number | null
}

export type CollectorDiagnostic = {
  code: 'WARNING' | 'SELECTOR_NOT_FOUND' | 'VALUE_INVALID' | 'PERIOD_NOT_FOUND' | 'STRUCTURE_CHANGED'
  field?: string
  message: string
}

export type CollectorResult = {
  periodKey: OfficialPeriodKey
  metrics: ParsedOfficialMetrics
  visibleValues: Record<string, string | null>
  averageProcessingMinutes: number | null
  recentRewards: Array<{ date: string; market: string; accountBalance: number | null; reward: number | null; raw: string[] }>
  diagnostics: CollectorDiagnostic[]
}

const PERIODS = new Set<OfficialPeriodKey>(['24h', '7d', '30d', '365d', 'all'])
const PARSERS = new Set<OfficialParser>(['currency', 'integer', 'number', 'hours', 'minutes', 'percentage', 'text'])

export function parseOfficialValue(value: string, parser: OfficialParser): number | string | null {
  const normalized = value.replace(/\u00a0/g, ' ').trim()
  if (!normalized || ['—', '-', 'N/A', 'NA'].includes(normalized.toUpperCase())) return null
  if (parser === 'text') return normalized
  const numeric = Number(normalized.replace(/[^0-9.,+-]/g, '').replace(/,/g, ''))
  if (!Number.isFinite(numeric)) return null
  if (parser === 'integer') return Math.trunc(numeric)
  if (parser === 'hours') return numeric * 60
  return numeric
}

export function validateOfficialConfig(input: unknown): OfficialPageCollectorConfig {
  if (!input || typeof input !== 'object') throw new Error('COLLECTOR_CONFIG_INVALID: collector ausente')
  const value = input as Record<string, unknown>
  if (value.enabled !== true || value.kind !== 'official_page') throw new Error('COLLECTOR_CONFIG_INVALID: collector no habilitado')
  if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error('COLLECTOR_CONFIG_INVALID: version inválida')
  if (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) throw new Error('COLLECTOR_CONFIG_INVALID: currency inválida')
  if (typeof value.sourceName !== 'string' || !value.sourceName.trim()) throw new Error('COLLECTOR_CONFIG_INVALID: sourceName requerido')
  if (typeof value.waitForSelector !== 'string' || !value.waitForSelector.trim()) throw new Error('COLLECTOR_CONFIG_INVALID: waitForSelector requerido')
  if (!Array.isArray(value.periods) || !value.periods.length) throw new Error('COLLECTOR_CONFIG_INVALID: periods requerido')
  const periods = value.periods.map((period) => validatePeriod(period))
  if (new Set(periods.map((period) => period.periodKey)).size !== periods.length) throw new Error('COLLECTOR_CONFIG_INVALID: periodos duplicados')
  const metrics = validateMetrics(value.metrics)
  const averageProcessingTime = value.averageProcessingTime === undefined ? undefined : validateMetric(value.averageProcessingTime, 'averageProcessingTime')
  const recentRewards = value.recentRewards === undefined ? undefined : validateRecentRewards(value.recentRewards)
  return { enabled: true, kind: 'official_page', version: Number(value.version), currency: value.currency, sourceName: value.sourceName.trim(), waitForSelector: value.waitForSelector, periods, metrics, averageProcessingTime, recentRewards }
}

export function assertSafeCollectorUrl(rawUrl: string) {
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new Error('UNSAFE_SOURCE_URL: URL inválida') }
  if (url.protocol !== 'https:') throw new Error('UNSAFE_SOURCE_URL: solo HTTPS')
  if (url.username || url.password) throw new Error('UNSAFE_SOURCE_URL: credenciales no permitidas')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || isPrivateAddress(host)) throw new Error('UNSAFE_SOURCE_URL: host privado o local')
  return url
}

export async function assertSafeCollectorTarget(rawUrl: string) {
  const url = assertSafeCollectorUrl(rawUrl)
  const addresses = await lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('UNSAFE_SOURCE_URL: DNS resuelve a red privada')
  return url
}

export async function configureSafeContext(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    try { assertSafeCollectorUrl(route.request().url()); await route.continue() } catch { await route.abort('blockedbyclient') }
  })
}

export async function collectOfficialPeriod(page: Page, config: OfficialPageCollectorConfig, period: OfficialPeriodDefinition): Promise<CollectorResult> {
  const diagnostics: CollectorDiagnostic[] = []
  const trigger = page.locator(period.triggerSelector).first()
  if (!await trigger.count()) throw new Error(`PERIOD_NOT_FOUND: ${period.periodKey}`)
  const amountSelector = config.metrics.amount?.selector
  const beforeAmount = amountSelector ? await readSelector(page, amountSelector) : null
  await trigger.click()
  if (period.periodKey === 'all') {
    try { await page.locator(period.activeSelector).first().waitFor({ state: 'visible', timeout: 10_000 }) } catch { throw new Error(`PERIOD_NOT_FOUND: no se confirmó ${period.periodKey}`) }
  }
  if (period.periodKey !== 'all' && amountSelector && beforeAmount !== null) {
    try {
      await page.waitForFunction(({ selector, previous }) => document.querySelector(selector)?.textContent?.trim() !== previous, { selector: amountSelector, previous: beforeAmount }, { timeout: 12_000 })
    } catch {
      await trigger.click()
      try { await page.waitForFunction(({ selector, previous }) => document.querySelector(selector)?.textContent?.trim() !== previous, { selector: amountSelector, previous: beforeAmount }, { timeout: 12_000 }) } catch { throw new Error(`PERIOD_NOT_FOUND: métricas sin cambio para ${period.periodKey}`) }
    }
  }

  const metrics: ParsedOfficialMetrics = { amount: null, payoutCount: null, largestPayout: null, averagePayout: null }
  const visibleValues: Record<string, string | null> = {}
  for (const key of ['amount', 'payoutCount', 'largestPayout', 'averagePayout'] as OfficialMetricKey[]) {
    const definition = config.metrics[key]
    if (!definition) continue
    const raw = await readSelector(page, definition.selector)
    visibleValues[key] = raw
    if (raw === null) {
      const diagnostic = { code: 'SELECTOR_NOT_FOUND' as const, field: key, message: `${key}: selector ausente` }
      if (definition.required) throw new Error(`SELECTOR_NOT_FOUND: ${key}`)
      diagnostics.push(diagnostic)
      continue
    }
    const parsed = parseOfficialValue(raw, definition.parser)
    if (typeof parsed !== 'number' || parsed < 0) {
      if (definition.required) throw new Error(`VALUE_INVALID: ${key}`)
      diagnostics.push({ code: 'VALUE_INVALID', field: key, message: `${key}: valor no numérico` })
      continue
    }
    metrics[key] = parsed
  }

  let averageProcessingMinutes: number | null = null
  if (config.averageProcessingTime) {
    const raw = await readSelector(page, config.averageProcessingTime.selector)
    visibleValues.averageProcessingTime = raw
    const parsed = raw === null ? null : parseOfficialValue(raw, config.averageProcessingTime.parser)
    if (typeof parsed === 'number' && parsed >= 0) averageProcessingMinutes = parsed
    else if (config.averageProcessingTime.required) throw new Error('VALUE_INVALID: averageProcessingTime')
    else diagnostics.push({ code: raw === null ? 'SELECTOR_NOT_FOUND' : 'VALUE_INVALID', field: 'averageProcessingTime', message: 'Tiempo promedio no disponible' })
  }

  const recentRewards = config.recentRewards ? await readRecentRewards(page, config.recentRewards, diagnostics) : []
  return { periodKey: period.periodKey, metrics, visibleValues, averageProcessingMinutes, recentRewards, diagnostics }
}

export function snapshotsEqual(current: ParsedOfficialMetrics & { raw_data?: Record<string, unknown> | null }, next: CollectorResult) {
  return current.amount === next.metrics.amount && current.payoutCount === next.metrics.payoutCount && current.largestPayout === next.metrics.largestPayout && current.averagePayout === next.metrics.averagePayout && Number(current.raw_data?.average_processing_minutes ?? -1) === Number(next.averageProcessingMinutes ?? -1)
}

export function sourceTrustRank(sourceType: string, verificationLevel: string) {
  if (sourceType === 'official_api' && verificationLevel !== 'unverified') return 500
  if (sourceType === 'official_firm' && verificationLevel === 'firm_reported') return 400
  if (sourceType === 'third_party_api' && verificationLevel === 'tracked_external') return 300
  if (sourceType === 'third_party_public' && verificationLevel === 'blockchain_external') return 250
  if (sourceType === 'third_party_public' && verificationLevel === 'tracked_external') return 200
  if (['official_api', 'official_firm', 'third_party_api'].includes(sourceType)) return 150
  if (sourceType === 'third_party_public') return 120
  if (sourceType === 'manual') return 100
  return 0
}

async function readSelector(page: Page, selector: string) { const locator = page.locator(selector).filter({ visible: true }).first(); return await locator.count() ? (await locator.innerText()).trim() : null }
async function readRecentRewards(page: Page, definition: OfficialRecentRewardsDefinition, diagnostics: CollectorDiagnostic[]) {
  const rows = page.locator(definition.rowSelector).filter({ visible: true })
  const count = Math.min(await rows.count(), definition.limit ?? 25)
  if (!count) { diagnostics.push({ code: 'SELECTOR_NOT_FOUND', field: 'recentRewards', message: 'Tabla de rewards recientes no encontrada' }); return [] }
  const output: CollectorResult['recentRewards'] = []
  for (let index = 0; index < count; index++) {
    const raw = await rows.nth(index).locator('td').allInnerTexts()
    const value = (column: number) => raw[column]?.trim() ?? ''
    const balance = parseOfficialValue(value(definition.columns.accountBalance), 'currency')
    const reward = parseOfficialValue(value(definition.columns.reward), 'currency')
    output.push({ date: value(definition.columns.date), market: value(definition.columns.market), accountBalance: typeof balance === 'number' ? balance : null, reward: typeof reward === 'number' ? reward : null, raw })
  }
  return output
}

function validatePeriod(input: unknown): OfficialPeriodDefinition { if (!input || typeof input !== 'object') throw new Error('COLLECTOR_CONFIG_INVALID: period'); const value = input as Record<string, unknown>; if (!PERIODS.has(value.periodKey as OfficialPeriodKey) || typeof value.label !== 'string' || typeof value.triggerSelector !== 'string' || typeof value.activeSelector !== 'string') throw new Error('COLLECTOR_CONFIG_INVALID: period'); return value as OfficialPeriodDefinition }
function validateMetrics(input: unknown) { if (!input || typeof input !== 'object') throw new Error('COLLECTOR_CONFIG_INVALID: metrics'); const value = input as Record<string, unknown>; const output: Partial<Record<OfficialMetricKey, OfficialMetricDefinition>> = {}; for (const key of ['amount', 'payoutCount', 'largestPayout', 'averagePayout'] as OfficialMetricKey[]) if (value[key] !== undefined) output[key] = validateMetric(value[key], key); return output }
function validateMetric(input: unknown, field: string): OfficialMetricDefinition { if (!input || typeof input !== 'object') throw new Error(`COLLECTOR_CONFIG_INVALID: ${field}`); const value = input as Record<string, unknown>; if (typeof value.selector !== 'string' || !value.selector.trim() || !PARSERS.has(value.parser as OfficialParser) || typeof value.required !== 'boolean') throw new Error(`COLLECTOR_CONFIG_INVALID: ${field}`); return value as OfficialMetricDefinition }
function validateRecentRewards(input: unknown): OfficialRecentRewardsDefinition { if (!input || typeof input !== 'object') throw new Error('COLLECTOR_CONFIG_INVALID: recentRewards'); const value = input as Record<string, unknown>; const columns = value.columns as Record<string, unknown> | undefined; if (typeof value.rowSelector !== 'string' || !columns || !['date', 'market', 'accountBalance', 'reward'].every((key) => Number.isInteger(columns[key]))) throw new Error('COLLECTOR_CONFIG_INVALID: recentRewards'); return value as unknown as OfficialRecentRewardsDefinition }
function isPrivateAddress(host: string) { if (host === '::1' || host === '0.0.0.0') return true; if (!isIP(host)) return false; if (host.includes(':')) return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb'); const parts = host.split('.').map(Number); return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) }
