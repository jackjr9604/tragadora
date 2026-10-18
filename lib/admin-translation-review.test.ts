import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { PermissionKey } from './admin-permissions'
import type { TranslationStateRow } from './admin-translation-inventory'
import { matchesReviewSnapshot, normalizeReviewFilters, reviewEligibility, reviewableResources } from './admin-translation-review-policy'

test('solo los borradores vigentes enviados a revisión son elegibles', () => {
  assert.deepEqual(reviewEligibility(state()), { eligible: true, reason: null })
  assert.equal(reviewEligibility(state({ workflow_status: 'draft' })).reason, 'not_in_review')
  assert.equal(reviewEligibility(state({ draft_value: null })).reason, 'missing_draft')
  assert.equal(reviewEligibility(state({ publication_status: 'published' })).reason, 'already_published')
  assert.equal(reviewEligibility(state({ status: 'stale' })).reason, 'stale')
  assert.equal(reviewEligibility(state({ draft_source_hash: 'old' })).reason, 'source_changed')
  assert.equal(reviewEligibility(state({ draft_source_revision: 1 })).reason, 'source_changed')
  assert.equal(reviewEligibility(state({ lock_version: 0 })).reason, 'invalid_version')
})

test('la protección manual se muestra pero no impide revisión humana', () => {
  assert.equal(reviewEligibility(state({ is_protected: true })).eligible, true)
})

test('el snapshot detecta cambios concurrentes de versión, fuente o borrador', () => {
  const current = state()
  const snapshot = { stateId: current.id, lockVersion: 4, sourceHash: 'source', sourceRevision: 3, draftSourceHash: 'source', draftSourceRevision: 3 }
  assert.equal(matchesReviewSnapshot(current, snapshot), true)
  assert.equal(matchesReviewSnapshot(state({ lock_version: 5 }), snapshot), false)
  assert.equal(matchesReviewSnapshot(state({ source_hash: 'new-source' }), snapshot), false)
  assert.equal(matchesReviewSnapshot(state({ draft_source_revision: 2 }), snapshot), false)
})

test('los recursos de revisión requieren permiso de actualización y no solo lectura', () => {
  assert.deepEqual(reviewableResources(new Set<PermissionKey>(['blog.view'])), [])
  assert.deepEqual(reviewableResources(new Set<PermissionKey>(['blog.view', 'blog.update'])), ['blog_post_translation'])
})

test('los filtros tienen límites conservadores y rechazan módulos e idiomas inválidos', () => {
  assert.deepEqual(normalizeReviewFilters({ page: '-1', pageSize: '500', module: 'unknown', language: 'ES<script>', protection: 'all' }), { page: 1, pageSize: 25, resourceType: undefined, language: undefined, protection: undefined })
  assert.deepEqual(normalizeReviewFilters({ page: '2', pageSize: '50', module: 'offer_translation', language: 'PT', protection: 'protected' }), { page: 2, pageSize: 50, resourceType: 'offer_translation', language: 'pt', protection: 'protected' })
})

test('la previsualización es de solo lectura y no exporta objetos desde use server', () => {
  const action = readFileSync('app/admin/content-center/review/actions.ts', 'utf8')
  assert.match(action, /'use server'/)
  assert.match(action, /export async function previewTranslationReviewSelection/)
  assert.doesNotMatch(action, /\.rpc\(/)
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
  assert.doesNotMatch(action, /export (?:const|type|interface|class) /)
  const page = readFileSync('components/admin/translations/TranslationReviewSelection.tsx', 'utf8')
  assert.match(page, /Previsualizar selección/)
  assert.match(page, /Fuente/)
  assert.match(page, /Borrador/)
  assert.match(page, /no modifica ningún dato|No aprueba ni publica/)
})

function state(overrides: Partial<TranslationStateRow> = {}): TranslationStateRow {
  return {
    id: '11111111-1111-4111-8111-111111111111', resource_type: 'blog_post_translation', resource_id: 'resource', field_name: 'title',
    source_language: 'es', target_language: 'en', status: 'machine_translated', translation_method: 'manual', source_hash: 'source',
    translated_source_hash: null, source_revision: 3, translated_revision: null, provider: null, is_protected: false, protection_reason: null,
    translated_at: null, reviewed_at: null, updated_at: new Date(0).toISOString(), last_error_code: null, last_error: null,
    publication_status: 'unpublished', workflow_status: 'in_review', draft_value: 'Draft', draft_source_hash: 'source', draft_source_revision: 3,
    lock_version: 4, ...overrides,
  }
}
