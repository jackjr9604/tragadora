export type OfferSourceInput = {
  id?: string
  expectedUpdatedAt?: string
  creationRequestId?: string
  platformId: string
  challengeId: string | null
  affiliateLinkId: string | null
  title: string
  description: string | null
  discountValue: number
  discountType: 'percentage' | 'fixed'
  promoCode: string | null
  includesFreeAccount: boolean
  freeAccountLabel: string | null
  featured: boolean
  hotBadge: string | null
  shortHighlight: string | null
  countryCode: string | null
  language: string | null
  startsAt: string | null
  expiresAt: string | null
  priority: number
  status: boolean
}

export type OfferStatusInput = {
  id: string
  expectedUpdatedAt: string
  status: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LANGUAGE = /^[a-z]{2,12}(?:-[a-z0-9]{2,12})*$/
const OFFER_KEYS = new Set([
  'id', 'expectedUpdatedAt', 'creationRequestId', 'platformId', 'challengeId', 'affiliateLinkId', 'title', 'description',
  'discountValue', 'discountType', 'promoCode', 'includesFreeAccount', 'freeAccountLabel', 'featured',
  'hotBadge', 'shortHighlight', 'countryCode', 'language', 'startsAt', 'expiresAt', 'priority', 'status',
])

export function isOfferSourceInput(value: unknown): value is OfferSourceInput {
  if (!isObject(value) || Object.keys(value).some((key) => !OFFER_KEYS.has(key))) return false
  const input = value as Record<string, unknown>
  const editing = input.id !== undefined
  if (editing && (!isUuid(input.id) || !isTimestamp(input.expectedUpdatedAt) || input.creationRequestId !== undefined)) return false
  if (!editing && (input.expectedUpdatedAt !== undefined || input.id !== undefined || !isUuid(input.creationRequestId))) return false
  return isUuid(input.platformId)
    && isNullableUuid(input.challengeId)
    && isNullableUuid(input.affiliateLinkId)
    && isText(input.title, 1, 500)
    && isNullableText(input.description, 10_000)
    && isFiniteNumber(input.discountValue, 0, 1_000_000_000)
    && (input.discountType === 'percentage' || input.discountType === 'fixed')
    && (input.discountType !== 'percentage' || Number(input.discountValue) <= 100)
    && isNullableText(input.promoCode, 240)
    && typeof input.includesFreeAccount === 'boolean'
    && isNullableText(input.freeAccountLabel, 500)
    && typeof input.featured === 'boolean'
    && isNullableText(input.hotBadge, 200)
    && isNullableText(input.shortHighlight, 1_000)
    && (input.countryCode === null || (typeof input.countryCode === 'string' && /^[A-Z]{2}$/.test(input.countryCode)))
    && (input.language === null || (typeof input.language === 'string' && LANGUAGE.test(input.language)))
    && isNullableTimestamp(input.startsAt)
    && isNullableTimestamp(input.expiresAt)
    && validRange(input.startsAt as string | null, input.expiresAt as string | null)
    && Number.isInteger(input.priority) && (input.priority as number) >= 0 && (input.priority as number) <= 10_000
    && typeof input.status === 'boolean'
}

export function isOfferStatusInput(value: unknown): value is OfferStatusInput {
  return isObject(value)
    && Object.keys(value).every((key) => key === 'id' || key === 'expectedUpdatedAt' || key === 'status')
    && Object.keys(value).length === 3
    && isUuid(value.id)
    && isTimestamp(value.expectedUpdatedAt)
    && typeof value.status === 'boolean'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
function isNullableUuid(value: unknown) { return value === null || isUuid(value) }
function isText(value: unknown, min: number, max: number) { return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max }
function isNullableText(value: unknown, max: number) { return value === null || (typeof value === 'string' && value.trim().length <= max) }
function isFiniteNumber(value: unknown, min: number, max: number) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max }
function isTimestamp(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value)) }
function isNullableTimestamp(value: unknown) { return value === null || isTimestamp(value) }
function validRange(start: string | null, end: string | null) { return !start || !end || Date.parse(start) <= Date.parse(end) }
