import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PermissionKey } from '@/lib/admin-permissions'
import { allowedTranslationResources, TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import type { TranslationResourceRow } from '@/lib/admin-translation-inventory'
import type { ContentCenterBucket, ContentCenterSummary } from '@/lib/admin-content-center-policy'
import type { TranslationJobFilters, TranslationMetricsPeriod } from '@/lib/admin-translation-jobs-policy'
import { toRpcDateRange } from '@/lib/admin-translation-jobs-policy'

export type ContentCenterResourceRow = TranslationResourceRow & {
  draft_count: number; in_review_count: number; approved_count: number; error_count: number
  language_progress: Record<string, { total: number; published: number }>; total_count: number
}

export type TranslationLanguageCoverageRow = {
  resource_type: TranslationResourceType; target_language: string; total_fields: number
  completed_fields: number; pending_fields: number; automatic_review_fields: number
  stale_fields: number; protected_fields: number; error_fields: number
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

export async function getTranslationLanguageCoverage(permissions: ReadonlySet<PermissionKey>) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return { rows: [] as TranslationLanguageCoverageRow[], available: true }
  const result = await createAdminClient().rpc('translation_admin_language_coverage', { p_allowed_resource_types: allowed })
  if (result.error && ['42883', 'PGRST202'].includes(result.error.code ?? '')) return { rows: [] as TranslationLanguageCoverageRow[], available: false }
  if (result.error) throw new Error(result.error.message)
  const rows = ((result.data ?? []) as unknown as TranslationLanguageCoverageRow[]).map((row) => ({
    ...row,
    total_fields: Number(row.total_fields), completed_fields: Number(row.completed_fields), pending_fields: Number(row.pending_fields),
    automatic_review_fields: Number(row.automatic_review_fields), stale_fields: Number(row.stale_fields),
    protected_fields: Number(row.protected_fields), error_fields: Number(row.error_fields),
  }))
  return { rows, available: true }
}

export type TranslationJobRow = {
  id: string; resource_type: TranslationResourceType; resource_id: string; field_name: string
  source_language: string; target_language: string; status: string; requested_provider: string | null
  provider_used: string | null; priority: number; attempt_count: number; max_attempts: number
  next_attempt_at: string | null; lease_expires_at: string | null; started_at: string | null
  completed_at: string | null; error_code: string | null; input_characters: number | null
  output_characters: number | null; estimated_cost_usd: number | null; created_at: string
  updated_at: string; total_count: number
}

export type TranslationJobSummary = { total: number; queued: number; running: number; retry_wait: number; succeeded: number; failed: number; cancelled: number; recoverable: number }
export type TranslationJobMetrics = {
  period: TranslationMetricsPeriod
  period_started_at: string | null
  period_ended_at: string | null
  oldest_pending_created_at: string | null
  oldest_pending_age_seconds: number | null
  terminal_jobs: number
  succeeded_jobs: number
  failed_jobs: number
  success_rate: number | null
  failure_rate: number | null
  completed_jobs: number
  duration_samples: number
  average_duration_seconds: number | null
  p50_duration_seconds: number | null
  p95_duration_seconds: number | null
  processed_characters: number | null
  error_distribution: Record<string, number> | null
}
export type TranslationJobDetail = Omit<TranslationJobRow, 'total_count' | 'estimated_cost_usd'> & {
  duration_seconds: number | null
  error_category: 'recoverable_connectivity' | 'lease_expired' | 'source_unavailable' | 'editorial_conflict' | 'protected_content_validation' | 'unknown' | null
  error_summary: string | null
  error_recoverable: boolean
  requires_human_review: boolean
  editorial_state_exists: boolean
  editorial_status: string | null
  workflow_status: string | null
  publication_status: string | null
  is_protected: boolean
  source_is_current: boolean
  editorial_updated_at: string | null
  editorial_lock_version: number | null
}
export type TranslationWorkerStatus = {
  availability: 'available' | 'degraded' | 'offline' | 'never_connected'; worker_status: 'ready' | 'degraded' | 'stopping' | null
  provider: string | null; supported_languages: string[] | null; started_at: string | null; provider_checked_at: string | null
  last_seen_at: string | null; last_error_code: string | null; active_workers: number
}

export async function getTranslationJobsMonitor(filters: TranslationJobFilters, permissions: ReadonlySet<PermissionKey>) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return { rows: [] as TranslationJobRow[], total: 0, pages: 0, summary: emptyJobSummary(), metrics: emptyJobMetrics(filters.metricsPeriod), metricsAvailable: true, worker: emptyWorkerStatus() }
  const db = createAdminClient(), dates = toRpcDateRange(filters)
  const common = {
    p_allowed_resource_types: allowed, p_status: filters.status ?? null, p_resource_type: filters.resourceType && allowed.includes(filters.resourceType) ? filters.resourceType : null,
    p_resource_id: filters.resourceId ?? null, p_source_language: filters.sourceLanguage ?? null, p_target_language: filters.targetLanguage ?? null,
    p_provider: filters.provider ?? null, p_created_from: dates.from, p_created_to: dates.to, p_error_code: filters.errorCode ?? null,
  }
  const [inventoryResult, summaryResult, metricsResult, workerResult] = await Promise.all([
    db.rpc('translation_admin_jobs_inventory', { ...common, p_sort: filters.sort, p_page: filters.page, p_page_size: filters.pageSize }),
    db.rpc('translation_admin_jobs_summary', common),
    db.rpc('translation_admin_jobs_metrics', {
      p_allowed_resource_types: allowed, p_period: filters.metricsPeriod,
      p_resource_type: common.p_resource_type, p_resource_id: common.p_resource_id,
      p_source_language: common.p_source_language, p_target_language: common.p_target_language,
      p_provider: common.p_provider,
    }),
    db.rpc('translation_admin_worker_status', { p_stale_after_seconds: 120 }),
  ])
  if (inventoryResult.error) throw new Error(inventoryResult.error.message)
  if (summaryResult.error) throw new Error(summaryResult.error.message)
  const metricsAvailable = !metricsResult.error || !['42883', 'PGRST202'].includes(metricsResult.error.code ?? '')
  if (metricsResult.error && metricsAvailable) throw new Error(metricsResult.error.message)
  if (workerResult.error) throw new Error(workerResult.error.message)
  const rows = (inventoryResult.data ?? []) as unknown as TranslationJobRow[]
  const total = Number(rows[0]?.total_count ?? 0)
  return {
    rows, total, pages: Math.ceil(total / filters.pageSize),
    summary: numericRow<TranslationJobSummary>(summaryResult.data, emptyJobSummary()),
    metrics: metricsAvailable ? normalizeJobMetrics(metricsResult.data, filters.metricsPeriod) : emptyJobMetrics(filters.metricsPeriod),
    metricsAvailable,
    worker: numericRow<TranslationWorkerStatus>(workerResult.data, emptyWorkerStatus(), ['active_workers']),
  }
}

export async function getTranslationJobDetail(jobId: string, permissions: ReadonlySet<PermissionKey>) {
  const allowed = allowedTranslationResources(permissions)
  if (!allowed.length) return null
  const db = createAdminClient()
  const result = await db.rpc('translation_admin_job_detail', { p_job_id: jobId, p_allowed_resource_types: allowed })
  if (result.error) throw new Error(result.error.message)
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Omit<TranslationJobDetail, 'editorial_lock_version'> | null
  if (!row) return null
  const state = row.editorial_state_exists
    ? await db.from('translation_field_state').select('lock_version')
      .eq('resource_type', row.resource_type).eq('resource_id', row.resource_id)
      .eq('field_name', row.field_name).eq('target_language', row.target_language).maybeSingle()
    : null
  if (state?.error) throw new Error(state.error.message)
  return row ? {
    ...row,
    attempt_count: Number(row.attempt_count), max_attempts: Number(row.max_attempts), priority: Number(row.priority),
    input_characters: row.input_characters === null ? null : Number(row.input_characters),
    output_characters: row.output_characters === null ? null : Number(row.output_characters),
    duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    editorial_lock_version: state?.data ? Number(state.data.lock_version) : null,
  } : null
}

export function resourceEditorHref(row: Pick<ContentCenterResourceRow, 'resource_type' | 'resource_id'>) {
  return `/admin/content-center/translations/${row.resource_type}/${encodeURIComponent(row.resource_id)}`
}

export function resourceModuleLabel(type: string) { return TRANSLATION_RESOURCES[type as TranslationResourceType]?.label ?? type }

function emptySummary(): ContentCenterSummary { return { resources: 0, fields: 0, pending: 0, draft: 0, in_review: 0, approved: 0, published: 0, partial: 0, stale: 0, error: 0, queued_jobs: 0, running_jobs: 0, retry_jobs: 0, failed_jobs: 0 } }
function emptyJobSummary(): TranslationJobSummary { return { total: 0, queued: 0, running: 0, retry_wait: 0, succeeded: 0, failed: 0, cancelled: 0, recoverable: 0 } }
function emptyJobMetrics(period: TranslationMetricsPeriod): TranslationJobMetrics { return { period, period_started_at: null, period_ended_at: null, oldest_pending_created_at: null, oldest_pending_age_seconds: null, terminal_jobs: 0, succeeded_jobs: 0, failed_jobs: 0, success_rate: null, failure_rate: null, completed_jobs: 0, duration_samples: 0, average_duration_seconds: null, p50_duration_seconds: null, p95_duration_seconds: null, processed_characters: null, error_distribution: null } }
function emptyWorkerStatus(): TranslationWorkerStatus { return { availability: 'never_connected', worker_status: null, provider: null, supported_languages: [], started_at: null, provider_checked_at: null, last_seen_at: null, last_error_code: null, active_workers: 0 } }
function numericRow<T extends object>(data: unknown, fallback: T, numericKeys: string[] = Object.keys(fallback)) {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
  if (!row) return fallback
  return { ...fallback, ...row, ...Object.fromEntries(numericKeys.filter((key) => key in row).map((key) => [key, Number(row[key])])) } as T
}

function normalizeJobMetrics(data: unknown, period: TranslationMetricsPeriod): TranslationJobMetrics {
  const fallback = emptyJobMetrics(period)
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
  if (!row) return fallback
  const nullableNumber = (key: string) => row[key] === null || row[key] === undefined ? null : Number(row[key])
  return {
    ...fallback, ...row,
    terminal_jobs: Number(row.terminal_jobs ?? 0), succeeded_jobs: Number(row.succeeded_jobs ?? 0), failed_jobs: Number(row.failed_jobs ?? 0),
    completed_jobs: Number(row.completed_jobs ?? 0), duration_samples: Number(row.duration_samples ?? 0),
    oldest_pending_age_seconds: nullableNumber('oldest_pending_age_seconds'), success_rate: nullableNumber('success_rate'),
    failure_rate: nullableNumber('failure_rate'), average_duration_seconds: nullableNumber('average_duration_seconds'),
    p50_duration_seconds: nullableNumber('p50_duration_seconds'), p95_duration_seconds: nullableNumber('p95_duration_seconds'),
    processed_characters: nullableNumber('processed_characters'),
    error_distribution: row.error_distribution && typeof row.error_distribution === 'object' ? row.error_distribution as Record<string, number> : null,
  } as TranslationJobMetrics
}
