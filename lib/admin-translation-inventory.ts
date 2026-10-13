import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PermissionKey } from '@/lib/admin-permissions'
import { allowedTranslationResources, summarizeStatuses, TRANSLATION_RESOURCES, TRANSLATION_STATUSES } from './admin-translation-inventory-policy'
import type { InventoryFilters, TranslationResourceType, TranslationStatus } from './admin-translation-inventory-policy'

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

const STATE_BASE_FIELDS = 'id,resource_type,resource_id,field_name,source_language,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,translation_method,provider,is_protected,protection_reason,translated_at,reviewed_at,updated_at,last_error_code,last_error'
const STATE_EDITORIAL_FIELDS = `${STATE_BASE_FIELDS},publication_status,workflow_status,draft_value,draft_source_hash,draft_source_revision,lock_version,draft_updated_at,submitted_at,approved_at,published_at,withdrawn_at`

export async function getTranslationInventory(filters: InventoryFilters, permissions: ReadonlySet<PermissionKey>) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return { rows: [] as TranslationStateRow[], total: 0, pages: 0, languages: [], resources: [], summary: summarizeStatuses({}, 0) }
  const db = createAdminClient()
  const buildQuery = (fields: string) => db.from('translation_field_state').select(fields, { count: 'exact' }).in('resource_type', allowed)
  let query = buildQuery(STATE_EDITORIAL_FIELDS)
  if (filters.resourceType && allowed.includes(filters.resourceType as TranslationResourceType)) query = query.eq('resource_type', filters.resourceType)
  if (filters.language) query = query.eq('target_language', filters.language)
  if (filters.status && TRANSLATION_STATUSES.includes(filters.status as TranslationStatus)) query = query.eq('status', filters.status)
  if (filters.protection === 'protected') query = query.eq('is_protected', true)
  if (filters.protection === 'unprotected') query = query.eq('is_protected', false)
  if (filters.query) {
    const value = filters.query.replace(/[%_,().]/g, ' ').trim()
    if (value) query = query.or(`resource_id.ilike.%${value}%,field_name.ilike.%${value}%,resource_type.ilike.%${value}%`)
  }
  const from = (filters.page - 1) * filters.pageSize
  const [initialPageResult, languageResult, resourceResult, ...countResults] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, from + filters.pageSize - 1),
    db.from('languages').select('code,native_name,is_default,publication_status').eq('is_active', true).order('sort_order'),
    db.from('translation_resource_types').select('resource_type,description').in('resource_type', allowed).eq('enabled', true).order('resource_type'),
    ...TRANSLATION_STATUSES.map((status) => db.from('translation_field_state').select('id', { count: 'exact', head: true }).in('resource_type', allowed).eq('status', status)),
    db.from('translation_field_state').select('id', { count: 'exact', head: true }).in('resource_type', allowed).eq('is_protected', true),
  ])
  let pageResult = initialPageResult
  if (pageResult.error?.code === '42703') {
    let legacyQuery = buildQuery(STATE_BASE_FIELDS)
    if (filters.resourceType && allowed.includes(filters.resourceType as TranslationResourceType)) legacyQuery = legacyQuery.eq('resource_type', filters.resourceType)
    if (filters.language) legacyQuery = legacyQuery.eq('target_language', filters.language)
    if (filters.status && TRANSLATION_STATUSES.includes(filters.status as TranslationStatus)) legacyQuery = legacyQuery.eq('status', filters.status)
    if (filters.protection === 'protected') legacyQuery = legacyQuery.eq('is_protected', true)
    if (filters.protection === 'unprotected') legacyQuery = legacyQuery.eq('is_protected', false)
    if (filters.query) { const value = filters.query.replace(/[%_,().]/g, ' ').trim(); if (value) legacyQuery = legacyQuery.or(`resource_id.ilike.%${value}%,field_name.ilike.%${value}%,resource_type.ilike.%${value}%`) }
    pageResult = await legacyQuery.order('updated_at', { ascending: false }).range(from, from + filters.pageSize - 1)
  }
  const error = pageResult.error ?? languageResult.error ?? resourceResult.error ?? countResults.find((item) => item.error)?.error
  if (error) throw new Error(error.message)
  const counts = Object.fromEntries(TRANSLATION_STATUSES.map((status, index) => [status, countResults[index].count ?? 0]))
  const total = pageResult.count ?? 0
  return {
    rows: (pageResult.data ?? []) as unknown as TranslationStateRow[], total, pages: Math.ceil(total / filters.pageSize),
    languages: languageResult.data ?? [], resources: resourceResult.data ?? [],
    summary: summarizeStatuses(counts, countResults.at(-1)?.count ?? 0),
  }
}

export async function getTranslationDetail(id: string | undefined, permissions: ReadonlySet<PermissionKey>) {
  if (!id) return null
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return null
  const db = createAdminClient()
  let stateResult = await db.from('translation_field_state').select(STATE_EDITORIAL_FIELDS).eq('id', id).in('resource_type', allowed).maybeSingle()
  let workflowAvailable = true
  if (stateResult.error?.code === '42703') {
    workflowAvailable = false
    stateResult = await db.from('translation_field_state').select(STATE_BASE_FIELDS).eq('id', id).in('resource_type', allowed).maybeSingle()
  }
  if (stateResult.error || !stateResult.data) return null
  const state = stateResult.data as TranslationStateRow
  const [sourceValue, translatedValue, origin, field] = await Promise.all([
    readRawValue(state, state.source_language), readRawValue(state, state.target_language), readOrigin(state),
    db.from('translation_resource_fields').select('value_kind,max_characters').eq('resource_type', state.resource_type).eq('field_name', state.field_name).maybeSingle(),
  ])
  return { state, source: displayValue(sourceValue), translated: displayValue(translatedValue), sourceValue, translatedValue, origin, workflowAvailable, canEdit: permissions.has(TRANSLATION_RESOURCES[state.resource_type].updatePermission), valueKind: field.data?.value_kind ?? 'text', maxCharacters: field.data?.max_characters ?? null }
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

async function readRawValue(state: TranslationStateRow, language: string) {
  const db = createAdminClient(), adapter = ADAPTERS[state.resource_type]
  const source = language === state.source_language
  const table = source ? adapter.sourceTable : adapter.translationTable
  const idColumn = source ? adapter.sourceId : adapter.translationId
  const field = source ? sourceField(state, adapter) : adapter.translationField ?? state.field_name
  let query = db.from(table).select(field).eq(idColumn, state.resource_id)
  if (table.includes('translation') || table === 'site_content') query = query.eq('language', language)
  const result = await query.maybeSingle()
  if (result.error || !result.data) return null
  return (result.data as unknown as Record<string, unknown>)[field] ?? null
}

function sourceField(state: TranslationStateRow, adapter: Adapter) {
  if (adapter.sourceField) return adapter.sourceField
  if (state.resource_type === 'tool_translation') return ({ category_label: 'category', seo_title: 'name', seo_description: 'short_description' } as Record<string, string>)[state.field_name] ?? state.field_name
  if (state.resource_type === 'community_translation' && state.field_name === 'category_label') return 'category'
  return state.field_name
}

async function readOrigin(state: TranslationStateRow) {
  const config = TRANSLATION_RESOURCES[state.resource_type]
  if (state.resource_type === 'site_content') {
    const page = state.resource_id.split('.')[0]
    return { label: state.resource_id, href: page ? `/admin/content/${page}` : config.path }
  }
  const db = createAdminClient()
  if (state.resource_type === 'challenge_phase_translation') {
    const { data } = await db.from('challenge_phases').select('challenge_id,phase_number').eq('id', state.resource_id).maybeSingle()
    return { label: data ? `Fase ${data.phase_number}` : `Fase · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path }
  }
  if (state.resource_type === 'challenge_variant_translation') {
    const { data } = await db.from('challenge_variants').select('challenge_id,name').eq('id', state.resource_id).maybeSingle()
    return { label: data?.name ?? `Variante · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path }
  }
  if (state.resource_type === 'challenge_variant_phase_translation') {
    const { data: phase } = await db.from('challenge_variant_phases').select('variant_id,phase_number').eq('id', state.resource_id).maybeSingle()
    const variant = phase ? await db.from('challenge_variants').select('challenge_id,name').eq('id', phase.variant_id).maybeSingle() : null
    return { label: phase ? `${variant?.data?.name ?? 'Variante'} · Fase ${phase.phase_number}` : `Override · ${state.resource_id.slice(0, 8)}`, href: variant?.data ? `/admin/challenges/${variant.data.challenge_id}` : config.path }
  }
  if (state.resource_type === 'account_plan_translation') {
    const { data } = await db.from('account_plans').select('challenge_id,account_size,currency').eq('id', state.resource_id).maybeSingle()
    return { label: data ? `Plan ${data.account_size ?? 'sin tamaño'}${data.currency ? ` ${data.currency}` : ''}` : `Plan · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path }
  }
  if (state.resource_type === 'challenge_reward_translation') {
    const { data } = await db.from('challenge_reward_options').select('challenge_id,name').eq('id', state.resource_id).maybeSingle()
    return { label: data?.name ?? `Reward · ${state.resource_id.slice(0, 8)}`, href: data ? `/admin/challenges/${data.challenge_id}` : config.path }
  }
  const lookup: Partial<Record<TranslationResourceType, { table: string; label: string; href: (row: Record<string, unknown>) => string }>> = {
    platform_translation: { table: 'platforms', label: 'name,type', href: (row) => row.type === 'broker' ? `/admin/brokers/${state.resource_id}/edit` : row.type === 'exchange' ? `/admin/exchanges/${state.resource_id}/edit` : `/admin/platforms/${state.resource_id}/edit` },
    broker_detail_translation: { table: 'platforms', label: 'name', href: () => `/admin/brokers/${state.resource_id}/edit` },
    exchange_detail_translation: { table: 'platforms', label: 'name', href: () => `/admin/exchanges/${state.resource_id}/edit` },
    offer_translation: { table: 'offers', label: 'title', href: () => `/admin/offers/${state.resource_id}` },
    tool_translation: { table: 'tools', label: 'name', href: () => `/admin/tools/${state.resource_id}/edit` },
    community_translation: { table: 'communities', label: 'name', href: () => `/admin/communities/${state.resource_id}/edit` },
    giveaway_translation: { table: 'giveaways', label: 'title', href: () => `/admin/giveaways/${state.resource_id}/edit` },
    blog_post_translation: { table: 'blog_posts', label: 'title', href: () => `/admin/blog/${state.resource_id}/edit` },
  }
  const item = lookup[state.resource_type]
  if (!item) return { label: `${config.label} · ${state.resource_id.slice(0, 8)}`, href: config.path }
  const result = await db.from(item.table).select(item.label).eq(item.table === 'platforms' ? 'id' : 'id', state.resource_id).maybeSingle()
  const row = (result.data ?? {}) as Record<string, unknown>
  const label = String(row.name ?? row.title ?? `${config.label} · ${state.resource_id.slice(0, 8)}`)
  return { label, href: item.href(row) }
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map(String).join('\n')
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
