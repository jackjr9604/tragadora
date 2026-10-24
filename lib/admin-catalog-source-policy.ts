export type ToolSourceInput = {
  id?: string
  slug: string
  name: string
  shortDescription: string | null
  toolType: 'internal' | 'external' | 'coming_soon'
  category: string | null
  iconKey: string | null
  badge: string | null
  internalPath: string | null
  externalUrl: string | null
  featured: boolean
  displayOrder: number
  status: 'draft' | 'published'
  openInNewTab: boolean
  pricingModel: 'free' | 'freemium' | 'paid' | null
  hasFreePlan: boolean
  priceLabel: string | null
  availability: string | null
  authorName: string | null
  promoCode: string | null
  promoLabel: string | null
  isOurs: boolean
  logoMediaId: string | null
}

export type CommunitySourceInput = {
  id?: string
  name: string
  slug: string
  shortDescription: string | null
  communityType: 'discord' | 'telegram' | 'whatsapp' | 'x' | 'reddit' | 'forum' | 'other'
  category: string | null
  languageCode: string | null
  regionLabel: string | null
  logoMediaId: string | null
  joinUrl: string
  websiteUrl: string | null
  badge: string | null
  featured: boolean
  displayOrder: number
  status: 'draft' | 'published'
}

export type GiveawaySourceInput = {
  id?: string
  slug: string
  title: string
  shortDescription: string | null
  sponsorPlatformId: string | null
  prizeTitle: string
  prizeQuantity: number | null
  prizeDescription: string | null
  coverMediaId: string | null
  startsAt: string
  endsAt: string
  participationUrl: string | null
  rulesUrl: string | null
  badge: string | null
  revealTitle: string | null
  revealContent: string | null
  featured: boolean
  displayOrder: number
  status: 'draft' | 'published' | 'ended'
}

export function isToolSourceInput(value: unknown): value is ToolSourceInput {
  if (!record(value)) return false
  const v = value
  if (!optionalUuid(v.id) || !slug(v.slug) || !required(v.name, 240)) return false
  if (!oneOf(v.toolType, ['internal', 'external', 'coming_soon']) || !oneOf(v.status, ['draft', 'published'])) return false
  if (!nullable(v.shortDescription, 2_000) || !nullable(v.category, 240) || !nullable(v.iconKey, 100) || !nullable(v.badge, 120)) return false
  if (!nullable(v.internalPath, 500) || !nullable(v.externalUrl, 2_000) || !nullable(v.priceLabel, 240) || !nullable(v.availability, 500)) return false
  if (!nullable(v.authorName, 240) || !nullable(v.promoCode, 240) || !nullable(v.promoLabel, 500) || !nullableUuid(v.logoMediaId)) return false
  if (!bool(v.featured) || !bool(v.openInNewTab) || !bool(v.hasFreePlan) || !bool(v.isOurs) || !order(v.displayOrder)) return false
  if (!(v.pricingModel === null || oneOf(v.pricingModel, ['free', 'freemium', 'paid']))) return false
  if (v.toolType === 'internal') return typeof v.internalPath === 'string' && safeInternalPath(v.internalPath) && v.externalUrl === null
  if (v.toolType === 'external') return v.internalPath === null && typeof v.externalUrl === 'string' && safeUrl(v.externalUrl)
  return v.internalPath === null && v.externalUrl === null
}

export function isCommunitySourceInput(value: unknown): value is CommunitySourceInput {
  if (!record(value)) return false
  const v = value
  return optionalUuid(v.id) && required(v.name, 240) && slug(v.slug)
    && nullable(v.shortDescription, 2_000) && oneOf(v.communityType, ['discord', 'telegram', 'whatsapp', 'x', 'reddit', 'forum', 'other'])
    && nullable(v.category, 240) && nullable(v.languageCode, 35) && nullable(v.regionLabel, 240)
    && nullableUuid(v.logoMediaId) && requiredUrl(v.joinUrl) && (v.websiteUrl === null || (typeof v.websiteUrl === 'string' && safeUrl(v.websiteUrl)))
    && nullable(v.badge, 120) && bool(v.featured) && order(v.displayOrder) && oneOf(v.status, ['draft', 'published'])
}

export function isGiveawaySourceInput(value: unknown): value is GiveawaySourceInput {
  if (!record(value)) return false
  const v = value
  if (!optionalUuid(v.id) || !slug(v.slug) || !required(v.title, 240) || !required(v.prizeTitle, 240)) return false
  if (!nullable(v.shortDescription, 2_000) || !nullable(v.prizeDescription, 2_000) || !nullable(v.badge, 120) || !nullable(v.revealTitle, 240) || !nullable(v.revealContent, 20_000)) return false
  if (!nullableUuid(v.sponsorPlatformId) || !nullableUuid(v.coverMediaId)) return false
  if (!(v.prizeQuantity === null || (typeof v.prizeQuantity === 'number' && Number.isInteger(v.prizeQuantity) && v.prizeQuantity > 0 && v.prizeQuantity <= 1_000_000))) return false
  if (!isoDate(v.startsAt) || !isoDate(v.endsAt) || new Date(v.endsAt) <= new Date(v.startsAt)) return false
  if (!(v.participationUrl === null || (typeof v.participationUrl === 'string' && safeUrl(v.participationUrl))) || !(v.rulesUrl === null || (typeof v.rulesUrl === 'string' && safeUrl(v.rulesUrl)))) return false
  return bool(v.featured) && order(v.displayOrder) && oneOf(v.status, ['draft', 'published', 'ended'])
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function optionalUuid(value: unknown) { return value === undefined || isUuid(value) }
function nullableUuid(value: unknown) { return value === null || isUuid(value) }
function required(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max }
function nullable(value: unknown, max: number): value is string | null { return value === null || (typeof value === 'string' && value.length <= max) }
function bool(value: unknown): value is boolean { return typeof value === 'boolean' }
function order(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000 }
function oneOf<T extends string>(value: unknown, values: readonly T[]): value is T { return typeof value === 'string' && values.includes(value as T) }
function slug(value: unknown): value is string { return typeof value === 'string' && value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) }
function safeInternalPath(value: string) { return value.length <= 500 && /^\/[a-z0-9/_-]*$/i.test(value) && !value.includes('//') }
function safeUrl(value: string) { try { const url = new URL(value); return value.length <= 2_000 && (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname) } catch { return false } }
function requiredUrl(value: unknown): value is string { return typeof value === 'string' && safeUrl(value) }
function isoDate(value: unknown): value is string { return typeof value === 'string' && value.length <= 100 && !Number.isNaN(new Date(value).getTime()) }
