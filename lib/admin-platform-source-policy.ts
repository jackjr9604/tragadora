export type PropFirmSourceInput = {
  id?: string; expectedUpdatedAt?: string; name: string; slug: string; description: string; websiteUrl: string | null; logoMediaId: string | null
  status: 'active' | 'draft' | 'inactive'; score: number | null; originCountryCode: string | null
  ceoName: string | null; foundedAt: string | null; brokerProvider: string | null; inactivityDays: number | null; isNew: boolean
  profitSplitMin: number | null; profitSplitMax: number | null; supportsEa: boolean | null; allowsNews: boolean | null
  allowsWeekend: boolean | null; allowsScalping: boolean | null; allowsDayTrading: boolean | null; allowsCopyTrading: boolean | null
  timeLimitPolicy: string | null; consistencyRules: string | null; specialRules: string | null
  markets: string[]; tradingPlatformIds: string[]; instrumentCategoryIds: string[]
  transactionMethods: Array<{ id: string; supportsDeposit: boolean; supportsPayout: boolean }>
}

export type BrokerSourceInput = {
  id?: string; expectedUpdatedAt?: string; name: string; slug: string; websiteUrl: string | null; status: 'active' | 'draft' | 'inactive'
  countryCode: string | null; description: string | null; logoMediaId: string | null; foundedYear: number | null
  minimumDeposit: number | null; minimumDepositCurrency: string | null; regulationSummary: string | null
  regulationSourceUrl: string | null; featured: boolean; displayOrder: number; markets: string[]; tradingPlatformIds: string[]
}

export type ExchangeSourceInput = {
  id?: string; expectedUpdatedAt?: string; name: string; slug: string; websiteUrl: string | null; status: 'active' | 'draft' | 'inactive'
  countryCode: string | null; description: string | null; logoMediaId: string | null; foundedYear: number | null
  exchangeType: 'centralized' | 'decentralized'; productSummary: string | null; fiatSupport: boolean | null
  regulationSummary: string | null; regulationSourceUrl: string | null; featured: boolean; displayOrder: number
}

export type PlatformDeleteInput = { id: string; type: 'prop_firm' | 'broker' | 'exchange'; slug: string; expectedUpdatedAt: string }

export function isPropFirmSourceInput(value: unknown): value is PropFirmSourceInput {
  if (!record(value) || !exactKeys(value, PROP_FIRM_KEYS) || !base(value) || !nullableCountry(value.originCountryCode) || !nullableNumber(value.score, 0, 10) || !nullableText(value.ceoName, 240)) return false
  if (!nullableDate(value.foundedAt) || !nullableText(value.brokerProvider, 500) || !nullableInteger(value.inactivityDays, 0, 100000)) return false
  if (!bool(value.isNew) || !nullableNumber(value.profitSplitMin, 0, 100) || !nullableNumber(value.profitSplitMax, 0, 100)) return false
  if (![value.supportsEa, value.allowsNews, value.allowsWeekend, value.allowsScalping, value.allowsDayTrading, value.allowsCopyTrading].every(nullableBoolean)) return false
  if (!nullableText(value.timeLimitPolicy, 10000) || !nullableText(value.consistencyRules, 10000) || !nullableText(value.specialRules, 10000)) return false
  if (!stringSet(value.markets, ['cfd', 'futures', 'crypto', 'options'], 4) || !uuidSet(value.tradingPlatformIds, 100) || !uuidSet(value.instrumentCategoryIds, 100)) return false
  if (!Array.isArray(value.transactionMethods) || value.transactionMethods.length > 100) return false
  return value.transactionMethods.every((item) => record(item) && isUuid(item.id) && bool(item.supportsDeposit) && bool(item.supportsPayout))
}

export function isBrokerSourceInput(value: unknown): value is BrokerSourceInput {
  return record(value) && exactKeys(value, BROKER_KEYS) && base(value) && nullableCountry(value.countryCode) && nullableInteger(value.foundedYear, 1800, 2200)
    && nullableNumber(value.minimumDeposit, 0, 1e12) && nullableCurrency(value.minimumDepositCurrency)
    && nullableText(value.regulationSummary, 10000) && nullableUrl(value.regulationSourceUrl)
    && bool(value.featured) && order(value.displayOrder) && stringSet(value.markets, ['cfd', 'futures', 'crypto', 'options'], 4)
    && uuidSet(value.tradingPlatformIds, 100)
}

export function isExchangeSourceInput(value: unknown): value is ExchangeSourceInput {
  return record(value) && exactKeys(value, EXCHANGE_KEYS) && base(value) && nullableCountry(value.countryCode) && nullableInteger(value.foundedYear, 1800, 2200)
    && oneOf(value.exchangeType, ['centralized', 'decentralized']) && nullableText(value.productSummary, 5000)
    && nullableBoolean(value.fiatSupport) && nullableText(value.regulationSummary, 10000) && nullableUrl(value.regulationSourceUrl)
    && bool(value.featured) && order(value.displayOrder)
}

export function isPlatformDeleteInput(value: unknown): value is PlatformDeleteInput {
  return record(value) && exactKeys(value, ['id', 'type', 'slug', 'expectedUpdatedAt']) && isUuid(value.id)
    && oneOf(value.type, ['prop_firm', 'broker', 'exchange']) && slug(value.slug)
    && typeof value.expectedUpdatedAt === 'string' && !Number.isNaN(Date.parse(value.expectedUpdatedAt))
}

export function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const COMMON_KEYS = ['id', 'expectedUpdatedAt', 'name', 'slug', 'description', 'websiteUrl', 'logoMediaId', 'status'] as const
const PROP_FIRM_KEYS = [...COMMON_KEYS, 'score', 'originCountryCode', 'ceoName', 'foundedAt', 'brokerProvider', 'inactivityDays', 'isNew', 'profitSplitMin', 'profitSplitMax', 'supportsEa', 'allowsNews', 'allowsWeekend', 'allowsScalping', 'allowsDayTrading', 'allowsCopyTrading', 'timeLimitPolicy', 'consistencyRules', 'specialRules', 'markets', 'tradingPlatformIds', 'instrumentCategoryIds', 'transactionMethods'] as const
const BROKER_KEYS = [...COMMON_KEYS, 'countryCode', 'foundedYear', 'minimumDeposit', 'minimumDepositCurrency', 'regulationSummary', 'regulationSourceUrl', 'featured', 'displayOrder', 'markets', 'tradingPlatformIds'] as const
const EXCHANGE_KEYS = [...COMMON_KEYS, 'countryCode', 'foundedYear', 'exchangeType', 'productSummary', 'fiatSupport', 'regulationSummary', 'regulationSourceUrl', 'featured', 'displayOrder'] as const
function base(v: Record<string, unknown>) { return optionalUuid(v.id) && expectedVersion(v.id, v.expectedUpdatedAt) && required(v.name, 240) && slug(v.slug) && nullableText(v.description, 5000) && nullableUrl(v.websiteUrl) && nullableUuid(v.logoMediaId) && oneOf(v.status, ['active', 'draft', 'inactive']) }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) { const keys = new Set(allowed); return Object.keys(value).every((key) => keys.has(key)) }
function expectedVersion(id: unknown, value: unknown) { return id === undefined ? value === undefined : typeof value === 'string' && !Number.isNaN(Date.parse(value)) }
function optionalUuid(v: unknown) { return v === undefined || isUuid(v) }
function nullableUuid(v: unknown) { return v === null || isUuid(v) }
function required(v: unknown, max: number) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max }
function slug(v: unknown) { return typeof v === 'string' && v.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) }
function bool(v: unknown): v is boolean { return typeof v === 'boolean' }
function nullableBoolean(v: unknown): v is boolean | null { return v === null || bool(v) }
function nullableText(v: unknown, max: number) { return v === null || (typeof v === 'string' && v.length <= max) }
function nullableNumber(v: unknown, min: number, max: number) { return v === null || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) }
function nullableInteger(v: unknown, min: number, max: number) { return v === null || (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) }
function nullableDate(v: unknown) { return v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())) }
function nullableUrl(v: unknown) { if (v === null) return true; if (typeof v !== 'string' || v.length > 2000) return false; try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname) } catch { return false } }
function nullableCountry(v: unknown) { return v === null || (typeof v === 'string' && /^[A-Z]{2}$/.test(v)) }
function nullableCurrency(v: unknown) { return v === null || (typeof v === 'string' && /^[A-Z]{3}$/.test(v)) }
function order(v: unknown) { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000000 }
function oneOf<T extends string>(v: unknown, values: readonly T[]): v is T { return typeof v === 'string' && values.includes(v as T) }
function stringSet(v: unknown, allowed: readonly string[], max: number) { return Array.isArray(v) && v.length <= max && new Set(v).size === v.length && v.every((x) => typeof x === 'string' && allowed.includes(x)) }
function uuidSet(v: unknown, max: number) { return Array.isArray(v) && v.length <= max && new Set(v).size === v.length && v.every(isUuid) }
