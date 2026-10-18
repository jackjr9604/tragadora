import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PermissionKey } from '@/lib/admin-permissions'
import {
  getTranslationResourceDetail,
  makeResourceKey,
  type TranslationFieldDetail,
  type TranslationStateRow,
} from '@/lib/admin-translation-inventory'
import type { TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import { reviewEligibility, reviewableResources, type ReviewFilters } from '@/lib/admin-translation-review-policy'

export { normalizeReviewFilters } from '@/lib/admin-translation-review-policy'

export type ReviewCandidate = TranslationFieldDetail & {
  resourceLabel: string
  originHref: string
  eligible: boolean
  exclusionReason: ReturnType<typeof reviewEligibility>['reason']
}

const REVIEW_FIELDS = 'id,resource_type,resource_id,field_name,source_language,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,translation_method,provider,is_protected,protection_reason,translated_at,reviewed_at,updated_at,last_error_code,last_error,publication_status,workflow_status,draft_value,draft_source_hash,draft_source_revision,lock_version,draft_updated_at,submitted_at,approved_at,published_at,withdrawn_at'

export async function getTranslationReviewCandidates(filters: ReviewFilters, permissions: ReadonlySet<PermissionKey>) {
  const allowed = reviewableResources(permissions)
  if (!allowed.length || (filters.resourceType && !allowed.includes(filters.resourceType))) return emptyResult()
  const db = createAdminClient()
  let query = db.from('translation_field_state').select(REVIEW_FIELDS, { count: 'exact' })
    .in('resource_type', filters.resourceType ? [filters.resourceType] : allowed)
    .eq('workflow_status', 'in_review')
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: true })
  if (filters.language) query = query.eq('target_language', filters.language)
  if (filters.protection) query = query.eq('is_protected', filters.protection === 'protected')
  const offset = (filters.page - 1) * filters.pageSize
  const result = await query.range(offset, offset + filters.pageSize - 1)
  if (result.error) throw new Error(result.error.message)

  const states = (result.data ?? []) as unknown as TranslationStateRow[]
  const keys = [...new Set(states.map((state) => makeResourceKey(state.resource_type, state.resource_id)))]
  const details = await Promise.all(keys.map((key) => getTranslationResourceDetail(key, permissions)))
  const fields = new Map<string, { field: TranslationFieldDetail; label: string; href: string }>()
  for (const detail of details) for (const field of detail?.fields ?? []) fields.set(field.state.id, { field, label: detail!.origin.label, href: detail!.origin.href })
  const rows: ReviewCandidate[] = states.flatMap((state) => {
    const found = fields.get(state.id)
    if (!found) return []
    const eligibility = reviewEligibility(found.field.state)
    return [{ ...found.field, resourceLabel: found.label, originHref: found.href, eligible: eligibility.eligible, exclusionReason: eligibility.reason }]
  })
  const total = Number(result.count ?? 0)
  return { rows, total, pages: Math.ceil(total / filters.pageSize), languages: await activeLanguages(), resources: allowed }
}

export async function getTranslationReviewDetails(stateIds: readonly string[], permissions: ReadonlySet<PermissionKey>) {
  if (!stateIds.length) return new Map<string, TranslationFieldDetail & { resourceLabel: string }>()
  const allowed = reviewableResources(permissions)
  if (!allowed.length) return new Map<string, TranslationFieldDetail & { resourceLabel: string }>()
  const identities = await createAdminClient().from('translation_field_state').select('id,resource_type,resource_id').in('id', [...stateIds]).in('resource_type', allowed)
  if (identities.error) throw new Error(identities.error.message)
  const keys = [...new Set((identities.data ?? []).map((row) => makeResourceKey(row.resource_type as TranslationResourceType, row.resource_id)))]
  const resources = await Promise.all(keys.map((key) => getTranslationResourceDetail(key, permissions)))
  const wanted = new Set(stateIds)
  const result = new Map<string, TranslationFieldDetail & { resourceLabel: string }>()
  for (const resource of resources) for (const field of resource?.fields ?? []) if (wanted.has(field.state.id)) result.set(field.state.id, { ...field, resourceLabel: resource!.origin.label })
  return result
}

async function activeLanguages() {
  const result = await createAdminClient().from('languages').select('code,native_name').eq('is_active', true).order('sort_order')
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

function emptyResult() {
  return { rows: [] as ReviewCandidate[], total: 0, pages: 0, languages: [] as { code: string; native_name: string }[], resources: [] as TranslationResourceType[] }
}
