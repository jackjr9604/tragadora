import type { PermissionKey } from './admin-permissions'

export const TRANSLATION_STATUSES = ['missing', 'queued', 'machine_translated', 'imported_unreviewed', 'reviewed', 'stale', 'error'] as const
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number]

export const TRANSLATION_RESOURCES = {
  site_content: { label: 'Contenido editorial', permission: 'content.view', path: '/admin/content' },
  platform_translation: { label: 'Prop Firms', permission: 'platforms.view', path: '/admin/platforms' },
  broker_detail_translation: { label: 'Brokers', permission: 'platforms.view', path: '/admin/brokers' },
  exchange_detail_translation: { label: 'Exchanges', permission: 'platforms.view', path: '/admin/exchanges' },
  offer_translation: { label: 'Ofertas', permission: 'offers.view', path: '/admin/offers' },
  challenge_phase_translation: { label: 'Fases', permission: 'challenges.view', path: '/admin/challenges' },
  challenge_variant_translation: { label: 'Variantes', permission: 'challenges.view', path: '/admin/challenges' },
  challenge_variant_phase_translation: { label: 'Overrides de fase', permission: 'challenges.view', path: '/admin/challenges' },
  account_plan_translation: { label: 'Planes de cuenta', permission: 'challenges.view', path: '/admin/challenges' },
  challenge_reward_translation: { label: 'Reward options', permission: 'challenges.view', path: '/admin/challenges' },
  tool_translation: { label: 'Herramientas y calculadoras', permission: 'tools.view', path: '/admin/tools' },
  community_translation: { label: 'Comunidades', permission: 'communities.view', path: '/admin/communities' },
  giveaway_translation: { label: 'Giveaways', permission: 'giveaways.view', path: '/admin/giveaways' },
  blog_post_translation: { label: 'Blog', permission: 'blog.view', path: '/admin/blog' },
} as const satisfies Record<string, { label: string; permission: PermissionKey; path: string }>

export type TranslationResourceType = keyof typeof TRANSLATION_RESOURCES
export type InventoryFilters = { page: number; pageSize: number; resourceType?: string; language?: string; status?: string; protection?: string; query?: string; selected?: string }

export function allowedTranslationResources(permissions: ReadonlySet<PermissionKey>) {
  return (Object.keys(TRANSLATION_RESOURCES) as TranslationResourceType[]).filter((key) => permissions.has(TRANSLATION_RESOURCES[key].permission))
}

export function normalizeInventoryFilters(input: Record<string, string | string[] | undefined>): InventoryFilters {
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const parsedPage = Number(one(input.page)), parsedSize = Number(one(input.pageSize))
  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize: [25, 50, 100].includes(parsedSize) ? parsedSize : 25,
    resourceType: clean(one(input.module), 80), language: clean(one(input.language), 20),
    status: clean(one(input.status), 40), protection: clean(one(input.protection), 20),
    query: clean(one(input.q), 100), selected: clean(one(input.selected), 80),
  }
}

export function summarizeStatuses(counts: Record<string, number>, protectedCount: number) {
  return {
    total: TRANSLATION_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0),
    pending: (counts.missing ?? 0) + (counts.queued ?? 0),
    translated: (counts.machine_translated ?? 0) + (counts.imported_unreviewed ?? 0) + (counts.reviewed ?? 0),
    stale: counts.stale ?? 0, errors: counts.error ?? 0, protected: protectedCount,
  }
}

function clean(value: string | undefined, max: number) {
  const normalized = value?.trim().slice(0, max)
  return normalized || undefined
}
