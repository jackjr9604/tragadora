import type { TranslationStateRow } from './admin-translation-inventory'
import type { PermissionKey } from './admin-permissions'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from './admin-translation-inventory-policy'

export type ReviewFilters = { page:number;pageSize:25|50;resourceType?:TranslationResourceType;language?:string;protection?:'protected'|'unprotected' }

export const REVIEW_EXCLUSION_REASONS = [
  'not_in_review',
  'missing_draft',
  'already_published',
  'stale',
  'source_changed',
  'invalid_version',
  'concurrent_change',
] as const

export type ReviewExclusionReason = (typeof REVIEW_EXCLUSION_REASONS)[number]

export type ReviewSnapshot = {
  stateId: string
  lockVersion: number
  sourceHash: string
  sourceRevision: number
  draftSourceHash: string | null
  draftSourceRevision: number | null
}

export function reviewEligibility(state: TranslationStateRow) {
  if (state.workflow_status !== 'in_review') return excluded('not_in_review')
  if (state.draft_value == null) return excluded('missing_draft')
  if (state.publication_status === 'published') return excluded('already_published')
  if (state.status === 'stale') return excluded('stale')
  if (state.draft_source_hash !== state.source_hash || state.draft_source_revision !== state.source_revision) return excluded('source_changed')
  if (!Number.isInteger(state.lock_version) || Number(state.lock_version) < 1) return excluded('invalid_version')
  return { eligible: true as const, reason: null }
}

export function matchesReviewSnapshot(state: TranslationStateRow, snapshot: ReviewSnapshot) {
  return state.id === snapshot.stateId
    && state.lock_version === snapshot.lockVersion
    && state.source_hash === snapshot.sourceHash
    && state.source_revision === snapshot.sourceRevision
    && state.draft_source_hash === snapshot.draftSourceHash
    && state.draft_source_revision === snapshot.draftSourceRevision
}

export function reviewReasonLabel(reason: ReviewExclusionReason) {
  return ({
    not_in_review: 'Ya no está en revisión',
    missing_draft: 'No existe un borrador para revisar',
    already_published: 'La traducción ya está publicada',
    stale: 'La fuente cambió y la traducción está desactualizada',
    source_changed: 'El borrador corresponde a una versión anterior de la fuente',
    invalid_version: 'La versión editorial no es válida',
    concurrent_change: 'Cambió después de seleccionarla; recarga antes de continuar',
  } satisfies Record<ReviewExclusionReason, string>)[reason]
}

export function normalizeReviewFilters(input: Record<string, string | string[] | undefined>): ReviewFilters {
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const page = Number(one(input.page)), pageSize = Number(one(input.pageSize)), resourceType = one(input.module)
  const language = one(input.language)?.trim().toLowerCase(), protection = one(input.protection)
  return { page: Number.isInteger(page) && page > 0 ? page : 1, pageSize: pageSize === 50 ? 50 : 25,
    resourceType: resourceType && resourceType in TRANSLATION_RESOURCES ? resourceType as TranslationResourceType : undefined,
    language: language && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(language) ? language : undefined,
    protection: protection === 'protected' || protection === 'unprotected' ? protection : undefined }
}

export function reviewableResources(permissions: ReadonlySet<PermissionKey>) {
  return (Object.keys(TRANSLATION_RESOURCES) as TranslationResourceType[]).filter((type) => permissions.has(TRANSLATION_RESOURCES[type].updatePermission))
}

function excluded(reason: ReviewExclusionReason) {
  return { eligible: false as const, reason }
}
