import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'

export const CONTENT_CENTER_BUCKETS = ['pending', 'draft', 'in_review', 'approved', 'published', 'partial', 'stale', 'error'] as const
export type ContentCenterBucket = (typeof CONTENT_CENTER_BUCKETS)[number]
export type ContentCenterView = 'summary' | 'translations' | 'jobs'

export const CONTENT_CENTER_BUCKET_LABELS: Record<ContentCenterBucket, string> = {
  pending: 'Pendientes', draft: 'Borradores', in_review: 'En revisión', approved: 'Aprobadas',
  published: 'Publicadas', partial: 'Parciales', stale: 'Desactualizadas', error: 'Errores',
}

export function normalizeContentCenterParams(input: Record<string, string | string[] | undefined>) {
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const rawView = one(input.view), rawBucket = one(input.bucket), rawPage = Number(one(input.page)), rawSize = Number(one(input.pageSize))
  const resourceType = clean(one(input.module), 80)
  return {
    view: (['summary', 'translations', 'jobs'].includes(rawView ?? '') ? rawView : 'summary') as ContentCenterView,
    bucket: CONTENT_CENTER_BUCKETS.includes(rawBucket as ContentCenterBucket) ? rawBucket as ContentCenterBucket : undefined,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: [25, 50, 100].includes(rawSize) ? rawSize : 25,
    resourceType: resourceType && resourceType in TRANSLATION_RESOURCES ? resourceType as TranslationResourceType : undefined,
    language: clean(one(input.language), 20), query: clean(one(input.q), 100), selected: clean(one(input.selected), 180),
  }
}

export function bucketCount(summary: ContentCenterSummary, bucket: ContentCenterBucket) {
  return summary[bucket]
}

export type ContentCenterSummary = {
  resources: number; fields: number; pending: number; draft: number; in_review: number; approved: number
  published: number; partial: number; stale: number; error: number; queued_jobs: number; running_jobs: number
  retry_jobs: number; failed_jobs: number
}

function clean(value: string | undefined, max: number) { const result = value?.trim().slice(0, max); return result || undefined }
