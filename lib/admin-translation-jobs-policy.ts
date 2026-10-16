import { TRANSLATION_RESOURCES, type TranslationResourceType } from './admin-translation-inventory-policy'

export const TRANSLATION_JOB_STATUSES = ['queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled'] as const
export type TranslationJobStatus = (typeof TRANSLATION_JOB_STATUSES)[number]
export type TranslationJobSort = 'created_desc' | 'created_asc' | 'updated_desc'
export const TRANSLATION_METRICS_PERIODS = ['24h', '7d', '30d'] as const
export type TranslationMetricsPeriod = (typeof TRANSLATION_METRICS_PERIODS)[number]

export type TranslationJobFilters = {
  page: number
  pageSize: number
  status?: TranslationJobStatus
  resourceType?: TranslationResourceType
  resourceId?: string
  sourceLanguage?: string
  targetLanguage?: string
  provider?: string
  createdFrom?: string
  createdTo?: string
  errorCode?: string
  sort: TranslationJobSort
  metricsPeriod: TranslationMetricsPeriod
}

export function normalizeTranslationJobFilters(input: Record<string, string | string[] | undefined>): TranslationJobFilters {
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const page = Number(one(input.page)), pageSize = Number(one(input.pageSize))
  const status = clean(one(input.status), 30)
  const resourceType = clean(one(input.module), 80)
  const sourceLanguage = language(one(input.sourceLanguage))
  const targetLanguage = language(one(input.targetLanguage))
  const provider = token(one(input.provider), 100)
  const errorCode = token(one(input.error), 100)
  const sort = one(input.sort)
  return {
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1_000_000) : 1,
    pageSize: [25, 50].includes(pageSize) ? pageSize : 25,
    status: TRANSLATION_JOB_STATUSES.includes(status as TranslationJobStatus) ? status as TranslationJobStatus : undefined,
    resourceType: resourceType && resourceType in TRANSLATION_RESOURCES ? resourceType as TranslationResourceType : undefined,
    resourceId: clean(one(input.resource), 500), sourceLanguage, targetLanguage, provider,
    createdFrom: date(one(input.from)), createdTo: date(one(input.to)), errorCode,
    sort: sort === 'created_asc' || sort === 'updated_desc' ? sort : 'created_desc',
    metricsPeriod: TRANSLATION_METRICS_PERIODS.includes(one(input.metricsPeriod) as TranslationMetricsPeriod)
      ? one(input.metricsPeriod) as TranslationMetricsPeriod : '24h',
  }
}

export function toRpcDateRange(filters: Pick<TranslationJobFilters, 'createdFrom' | 'createdTo'>) {
  const from = filters.createdFrom ? new Date(`${filters.createdFrom}T00:00:00.000Z`).toISOString() : null
  const toDate = filters.createdTo ? new Date(`${filters.createdTo}T00:00:00.000Z`) : null
  if (toDate) toDate.setUTCDate(toDate.getUTCDate() + 1)
  return { from, to: toDate?.toISOString() ?? null }
}

export function safeTranslationJobsReturn(value: string | undefined) {
  if (!value) return '/admin/content-center/jobs'
  try {
    const decoded = decodeURIComponent(value)
    const url = new URL(decoded, 'https://tradagora.local')
    if (url.origin !== 'https://tradagora.local' || url.pathname !== '/admin/content-center/jobs') return '/admin/content-center/jobs'
    return `${url.pathname}${url.search}`
  } catch {
    return '/admin/content-center/jobs'
  }
}

function clean(value: string | undefined, max: number) { const result = value?.trim().slice(0, max); return result || undefined }
function language(value: string | undefined) { const result = value?.trim().toLowerCase(); return result && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(result) ? result : undefined }
function token(value: string | undefined, max: number) { const result = value?.trim().toLowerCase().slice(0, max); return result && /^[a-z0-9._-]+$/.test(result) ? result : undefined }
function date(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : undefined }
