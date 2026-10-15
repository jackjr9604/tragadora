import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PermissionKey } from '@/lib/admin-permissions'
import { allowedTranslationResources, TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import type { TranslationResourceRow } from '@/lib/admin-translation-inventory'
import type { ContentCenterBucket, ContentCenterSummary } from '@/lib/admin-content-center-policy'

export type ContentCenterResourceRow = TranslationResourceRow & {
  draft_count: number; in_review_count: number; approved_count: number; error_count: number
  language_progress: Record<string, { total: number; published: number }>; total_count: number
}

export async function getContentCenterData(filters: { page: number; pageSize: number; resourceType?: TranslationResourceType; language?: string; query?: string; bucket?: ContentCenterBucket }, permissions: ReadonlySet<PermissionKey>) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return { rows: [] as ContentCenterResourceRow[], total: 0, pages: 0, languages: [], summary: emptySummary(), rpcAvailable: true }
  const db = createAdminClient()
  const [rowsResult, summaryResult, languagesResult] = await Promise.all([
    db.rpc('translation_admin_content_center_inventory', {
      p_allowed_resource_types: allowed, p_resource_type: filters.resourceType ?? null, p_target_language: filters.language ?? null,
      p_bucket: filters.bucket ?? null, p_query: filters.query ?? null, p_page: filters.page, p_page_size: filters.pageSize,
    }),
    db.rpc('translation_admin_content_center_summary', { p_allowed_resource_types: allowed }),
    db.from('languages').select('code,native_name,is_default,publication_status').eq('is_active', true).order('sort_order'),
  ])
  const unavailable = [rowsResult.error, summaryResult.error].some((error) => error?.code === 'PGRST202' || error?.code === '42883')
  if (unavailable) return { rows: [] as ContentCenterResourceRow[], total: 0, pages: 0, languages: languagesResult.data ?? [], summary: emptySummary(), rpcAvailable: false }
  if (rowsResult.error) throw new Error(rowsResult.error.message)
  if (summaryResult.error) throw new Error(summaryResult.error.message)
  if (languagesResult.error) throw new Error(languagesResult.error.message)
  const rows = (rowsResult.data ?? []) as unknown as ContentCenterResourceRow[]
  const rawSummary = (Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data) as Partial<ContentCenterSummary> | null
  const summary = { ...emptySummary(), ...Object.fromEntries(Object.entries(rawSummary ?? {}).map(([key, value]) => [key, Number(value)])) } as ContentCenterSummary
  const total = Number(rows[0]?.total_count ?? 0)
  return { rows, total, pages: Math.ceil(total / filters.pageSize), languages: languagesResult.data ?? [], summary, rpcAvailable: true }
}

export async function getRecentTranslationJobs(permissions: ReadonlySet<PermissionKey>, limit = 25) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return []
  const result = await createAdminClient().from('translation_jobs')
    .select('id,resource_type,resource_id,field_name,source_language,target_language,status,attempt_count,max_attempts,next_attempt_at,created_at,completed_at,error_code')
    .in('resource_type', allowed).order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 100))
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export function resourceEditorHref(row: Pick<ContentCenterResourceRow, 'resource_type' | 'resource_id'>) {
  return `/admin/content-center/translations/${row.resource_type}/${encodeURIComponent(row.resource_id)}`
}

export function resourceModuleLabel(type: string) { return TRANSLATION_RESOURCES[type as TranslationResourceType]?.label ?? type }

function emptySummary(): ContentCenterSummary { return { resources: 0, fields: 0, pending: 0, draft: 0, in_review: 0, approved: 0, published: 0, partial: 0, stale: 0, error: 0, queued_jobs: 0, running_jobs: 0, retry_jobs: 0, failed_jobs: 0 } }
