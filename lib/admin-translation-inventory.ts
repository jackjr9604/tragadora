import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PermissionKey } from '@/lib/admin-permissions'
import { allowedTranslationResources, TRANSLATION_RESOURCES, TRANSLATION_STATUSES } from './admin-translation-inventory-policy'
import type { InventoryFilters, TranslationResourceType, TranslationStatus } from './admin-translation-inventory-policy'
import { summarizeResourceStates } from './admin-translation-resource-policy'

export { normalizeInventoryFilters, TRANSLATION_RESOURCES, TRANSLATION_STATUSES } from './admin-translation-inventory-policy'
export type { InventoryFilters, TranslationResourceType, TranslationStatus } from './admin-translation-inventory-policy'

export type TranslationStateRow = {
  id: string; resource_type: TranslationResourceType; resource_id: string; field_name: string
  source_language: string; target_language: string; status: TranslationStatus; translation_method: string | null
  source_hash: string; translated_source_hash: string | null; source_revision: number; translated_revision: number | null
  provider: string | null; is_protected: boolean; protection_reason: string | null; translated_at: string | null
  reviewed_at: string | null; updated_at: string; last_error_code: string | null; last_error: string | null
  publication_status?: 'unpublished' | 'published'; workflow_status?: 'none' | 'draft' | 'in_review' | 'approved'
  draft_value?: unknown; draft_source_hash?: string | null; draft_source_revision?: number | null; lock_version?: number
  draft_updated_at?: string | null; submitted_at?: string | null; approved_at?: string | null; published_at?: string | null; withdrawn_at?: string | null
}

export type TranslationResourceRow = {
  resource_type: TranslationResourceType; resource_id: string; resource_label: string; origin_href: string; updated_at: string
  total_fields: number; pending_count: number; translated_count: number; reviewed_count: number; published_count: number
  stale_count: number; protected_count: number; en_total: number; en_published: number; pt_total: number; pt_published: number
}

export type TranslationFieldDetail = {
  state: TranslationStateRow; sourceValue: unknown; translatedValue: unknown; source: string | null; translated: string | null
  valueKind: string; maxCharacters: number | null
}

const STATE_BASE_FIELDS = 'id,resource_type,resource_id,field_name,source_language,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,translation_method,provider,is_protected,protection_reason,translated_at,reviewed_at,updated_at,last_error_code,last_error'
const STATE_EDITORIAL_FIELDS = `${STATE_BASE_FIELDS},publication_status,workflow_status,draft_value,draft_source_hash,draft_source_revision,lock_version,draft_updated_at,submitted_at,approved_at,published_at,withdrawn_at`

export async function getTranslationResourceInventory(filters: InventoryFilters, permissions: ReadonlySet<PermissionKey>) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return { rows: [] as TranslationResourceRow[], total: 0, pages: 0, languages: [], resources: [], summary: emptySummary(), rpcAvailable: true }
  const db = createAdminClient()
  const [inventoryResult, languageResult, resourceResult] = await Promise.all([
    db.rpc('translation_admin_resource_inventory', {
      p_allowed_resource_types: allowed, p_resource_type: filters.resourceType && allowed.includes(filters.resourceType as TranslationResourceType) ? filters.resourceType : null,
      p_target_language: filters.language ?? null, p_status: filters.status && TRANSLATION_STATUSES.includes(filters.status as TranslationStatus) ? filters.status : null,
      p_protection: filters.protection ?? null, p_query: filters.query ?? null, p_sort: filters.sort, p_page: filters.page, p_page_size: filters.pageSize,
    }),
    db.from('languages').select('code,native_name,is_default,publication_status').eq('is_active', true).order('sort_order'),
    db.from('translation_resource_types').select('resource_type,description').in('resource_type', allowed).eq('enabled', true).order('resource_type'),
  ])
  if (inventoryResult.error) {
    if (inventoryResult.error.code === 'PGRST202' || inventoryResult.error.code === '42883') return { rows: [] as TranslationResourceRow[], total: 0, pages: 0, languages: languageResult.data ?? [], resources: resourceResult.data ?? [], summary: emptySummary(), rpcAvailable: false }
    throw new Error(inventoryResult.error.message)
  }
  if (languageResult.error) throw new Error(languageResult.error.message)
  if (resourceResult.error) throw new Error(resourceResult.error.message)
  const rows = (inventoryResult.data ?? []) as unknown as (TranslationResourceRow & { total_count: number })[]
  const total = Number(rows[0]?.total_count ?? 0)
  const summary = rows.reduce((acc, row) => ({
    total: acc.total + Number(row.total_fields), pending: acc.pending + Number(row.pending_count), translated: acc.translated + Number(row.translated_count),
    reviewed: acc.reviewed + Number(row.reviewed_count), published: acc.published + Number(row.published_count), stale: acc.stale + Number(row.stale_count), protected: acc.protected + Number(row.protected_count),
  }), emptySummary())
  return { rows, total, pages: Math.ceil(total / filters.pageSize), languages: languageResult.data ?? [], resources: resourceResult.data ?? [], summary, rpcAvailable: true }
}

export async function getTranslationResourceDetail(resourceKey: string | undefined, permissions: ReadonlySet<PermissionKey>) {
  const parsed = parseResourceKey(resourceKey)
  if (!parsed) return null
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.includes(parsed.resourceType)) return null
  const db = createAdminClient()
  let statesResult: { data: unknown[] | null; error: { code?: string; message: string } | null } = await db.from('translation_field_state').select(STATE_EDITORIAL_FIELDS).eq('resource_type', parsed.resourceType).eq('resource_id', parsed.resourceId).order('field_name').order('target_language')
  let workflowAvailable = true
  if (statesResult.error?.code === '42703') {
    workflowAvailable = false
    statesResult = await db.from('translation_field_state').select(STATE_BASE_FIELDS).eq('resource_type', parsed.resourceType).eq('resource_id', parsed.resourceId).order('field_name').order('target_language')
  }
  if (statesResult.error || !statesResult.data?.length) return null
  const states = statesResult.data as unknown as TranslationStateRow[]
  const adapter = ADAPTERS[parsed.resourceType]
  const sourceLanguage = states[0].source_language
  const sourceFields = [...new Set(states.map((state) => sourceField(state, adapter)))]
  const translatedFields = [...new Set(states.map((state) => adapter.translationField ?? state.field_name))]
  const targetLanguages = [...new Set(states.map((state) => state.target_language))]
  const [sourceRow, targetRows, fields, origin] = await Promise.all([
    readResourceRow(adapter.sourceTable, adapter.sourceId, parsed.resourceId, sourceFields, sourceLanguage),
    Promise.all(targetLanguages.map(async (language) => [language, await readResourceRow(adapter.translationTable, adapter.translationId, parsed.resourceId, translatedFields, language)] as const)),
    db.from('translation_resource_fields').select('field_name,value_kind,max_characters').eq('resource_type', parsed.resourceType), readOrigin(states[0]),
  ])
  if (fields.error) throw new Error(fields.error.message)
  const targetByLanguage = new Map(targetRows), fieldConfig = new Map((fields.data ?? []).map((field) => [field.field_name, field]))
  const details: TranslationFieldDetail[] = states.map((state) => {
    const config = fieldConfig.get(state.field_name), sourceValue = sourceRow?.[sourceField(state, adapter)] ?? null
    const translatedValue = targetByLanguage.get(state.target_language)?.[adapter.translationField ?? state.field_name] ?? null
    return { state, sourceValue, translatedValue, source: displayValue(sourceValue), translated: displayValue(translatedValue), valueKind: config?.value_kind ?? 'text', maxCharacters: config?.max_characters ?? null }
  })
  return { resourceType: parsed.resourceType, resourceId: parsed.resourceId, origin, fields: details, workflowAvailable, canEdit: permissions.has(TRANSLATION_RESOURCES[parsed.resourceType].updatePermission), summary: summarizeResourceStates(states) }
}

export async function getTranslationDetail(id: string | undefined, permissions: ReadonlySet<PermissionKey>) {
  if (!id) return null
  const db = createAdminClient(), state = await db.from('translation_field_state').select('resource_type,resource_id').eq('id', id).maybeSingle()
  if (state.error || !state.data) return null
  const detail = await getTranslationResourceDetail(makeResourceKey(state.data.resource_type as TranslationResourceType, state.data.resource_id), permissions)
  const field = detail?.fields.find((item) => item.state.id === id)
  return field && detail ? { ...field, origin: detail.origin, workflowAvailable: detail.workflowAvailable, canEdit: detail.canEdit } : null
}

export function makeResourceKey(resourceType: TranslationResourceType, resourceId: string) { return `${resourceType}:${encodeURIComponent(resourceId)}` }
export function parseResourceKey(value: string | undefined) {
  if (!value) return null
  const separator = value.indexOf(':'); if (separator < 1) return null
  const resourceType = value.slice(0, separator) as TranslationResourceType
  if (!(resourceType in TRANSLATION_RESOURCES)) return null
  try { const resourceId = decodeURIComponent(value.slice(separator + 1)); return resourceId ? { resourceType, resourceId } : null } catch { return null }
}

type Adapter = { sourceTable: string; translationTable: string; sourceId: string; translationId: string; sourceField?: string; translationField?: string }
const ADAPTERS: Record<TranslationResourceType, Adapter> = {
  site_content: { sourceTable: 'site_content', translationTable: 'site_content', sourceId: 'key', translationId: 'key', sourceField: 'value', translationField: 'value' },
  platform_translation: { sourceTable: 'platform_translations', translationTable: 'platform_translations', sourceId: 'platform_id', translationId: 'platform_id' },
  broker_detail_translation: { sourceTable: 'broker_details', translationTable: 'broker_detail_translations', sourceId: 'platform_id', translationId: 'platform_id' },
  exchange_detail_translation: { sourceTable: 'exchange_details', translationTable: 'exchange_detail_translations', sourceId: 'platform_id', translationId: 'platform_id' },
  offer_translation: { sourceTable: 'offers', translationTable: 'offer_translations', sourceId: 'id', translationId: 'offer_id' },
  challenge_phase_translation: { sourceTable: 'challenge_phases', translationTable: 'challenge_phase_translations', sourceId: 'id', translationId: 'phase_id' },
  challenge_variant_translation: { sourceTable: 'challenge_variants', translationTable: 'challenge_variant_translations', sourceId: 'id', translationId: 'variant_id' },
  challenge_variant_phase_translation: { sourceTable: 'challenge_variant_phases', translationTable: 'challenge_variant_phase_translations', sourceId: 'id', translationId: 'variant_phase_id' },
  account_plan_translation: { sourceTable: 'account_plans', translationTable: 'account_plan_translations', sourceId: 'id', translationId: 'account_plan_id' },
  challenge_reward_translation: { sourceTable: 'challenge_reward_options', translationTable: 'challenge_reward_translations', sourceId: 'id', translationId: 'reward_option_id' },
  tool_translation: { sourceTable: 'tools', translationTable: 'tool_translations', sourceId: 'id', translationId: 'tool_id' },
  community_translation: { sourceTable: 'communities', translationTable: 'community_translations', sourceId: 'id', translationId: 'community_id' },
  giveaway_translation: { sourceTable: 'giveaways', translationTable: 'giveaway_translations', sourceId: 'id', translationId: 'giveaway_id' },
  blog_post_translation: { sourceTable: 'blog_posts', translationTable: 'blog_post_translations', sourceId: 'id', translationId: 'blog_post_id' },
}

async function readResourceRow(table: string, idColumn: string, resourceId: string, fields: string[], language: string) {
  if (!fields.length) return null
  const db = createAdminClient(); let query = db.from(table).select(fields.join(',')).eq(idColumn, resourceId)
  if (table.includes('translation') || table === 'site_content') query = query.eq('language', language)
  const result = await query.maybeSingle(); if (result.error) throw new Error(result.error.message)
  return result.data as unknown as Record<string, unknown> | null
}

function sourceField(state: TranslationStateRow, adapter: Adapter) {
  if (adapter.sourceField) return adapter.sourceField
  if (state.resource_type === 'tool_translation') return ({ category_label: 'category', seo_title: 'name', seo_description: 'short_description' } as Record<string, string>)[state.field_name] ?? state.field_name
  if (state.resource_type === 'community_translation' && state.field_name === 'category_label') return 'category'
  return state.field_name
}

async function readOrigin(state: TranslationStateRow) {
  const config = TRANSLATION_RESOURCES[state.resource_type]
  if (state.resource_type === 'site_content') { const page = state.resource_id.split('.')[0]; return { label: state.resource_id, href: page ? `/admin/content/${page}` : config.path } }
  const db = createAdminClient()
  if (state.resource_type === 'challenge_phase_translation') { const { data } = await db.from('challenge_phases').select('challenge_id,phase_number').eq('id', state.resource_id).maybeSingle(); return { label: data ? `Fase ${data.phase_number}` : `Fase · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path } }
  if (state.resource_type === 'challenge_variant_translation') { const { data } = await db.from('challenge_variants').select('challenge_id,name').eq('id', state.resource_id).maybeSingle(); return { label: data?.name ?? `Variante · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path } }
  if (state.resource_type === 'challenge_variant_phase_translation') { const { data: phase } = await db.from('challenge_variant_phases').select('variant_id,phase_number').eq('id', state.resource_id).maybeSingle(); const variant = phase ? await db.from('challenge_variants').select('challenge_id,name').eq('id', phase.variant_id).maybeSingle() : null; return { label: phase ? `${variant?.data?.name ?? 'Variante'} · Fase ${phase.phase_number}` : `Override · ${state.resource_id.slice(0, 8)}`, href: variant?.data ? `/admin/challenges/${variant.data.challenge_id}` : config.path } }
  if (state.resource_type === 'account_plan_translation') { const { data } = await db.from('account_plans').select('challenge_id,account_size,currency').eq('id', state.resource_id).maybeSingle(); return { label: data ? `Plan ${data.account_size ?? 'sin tamaño'}${data.currency ? ` ${data.currency}` : ''}` : `Plan · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path } }
  if (state.resource_type === 'challenge_reward_translation') { const { data } = await db.from('challenge_reward_options').select('challenge_id,name').eq('id', state.resource_id).maybeSingle(); return { label: data?.name ?? `Reward · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path } }
  const lookup: Partial<Record<TranslationResourceType, { table: string; select: string; href: (row: Record<string, unknown>) => string }>> = {
    platform_translation: { table: 'platforms', select: 'name,type', href: (row) => row.type === 'broker' ? `/admin/brokers/${state.resource_id}/edit` : row.type === 'exchange' ? `/admin/exchanges/${state.resource_id}/edit` : `/admin/platforms/${state.resource_id}/edit` },
    broker_detail_translation: { table: 'platforms', select: 'name', href: () => `/admin/brokers/${state.resource_id}/edit` }, exchange_detail_translation: { table: 'platforms', select: 'name', href: () => `/admin/exchanges/${state.resource_id}/edit` },
    offer_translation: { table: 'offers', select: 'title', href: () => `/admin/offers/${state.resource_id}` }, tool_translation: { table: 'tools', select: 'name', href: () => `/admin/tools/${state.resource_id}/edit` },
    community_translation: { table: 'communities', select: 'name', href: () => `/admin/communities/${state.resource_id}/edit` }, giveaway_translation: { table: 'giveaways', select: 'title', href: () => `/admin/giveaways/${state.resource_id}/edit` }, blog_post_translation: { table: 'blog_posts', select: 'title', href: () => `/admin/blog/${state.resource_id}/edit` },
  }
  const item = lookup[state.resource_type]; if (!item) return { label: `${config.label} · ${state.resource_id.slice(0, 8)}`, href: config.path }
  const result = await db.from(item.table).select(item.select).eq('id', state.resource_id).maybeSingle(), row = (result.data ?? {}) as Record<string, unknown>
  return { label: String(row.name ?? row.title ?? `${config.label} · ${state.resource_id.slice(0, 8)}`), href: item.href(row) }
}

function displayValue(value: unknown) { if (value == null) return null; if (Array.isArray(value)) return value.map(String).join('\n'); if (typeof value === 'object') return JSON.stringify(value, null, 2); return String(value) }
function emptySummary() { return { total: 0, pending: 0, translated: 0, reviewed: 0, published: 0, stale: 0, protected: 0 } }
