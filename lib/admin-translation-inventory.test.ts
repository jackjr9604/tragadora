import assert from 'node:assert/strict'
import test from 'node:test'
import { allowedTranslationResources, normalizeInventoryFilters, summarizeStatuses } from './admin-translation-inventory-policy'
import { countEligibleByLanguage, isEligibleForBulkAction, summarizeResourceStates } from './admin-translation-resource-policy'
import type { TranslationStateRow } from './admin-translation-inventory'
import type { PermissionKey } from './admin-permissions'

test('inventario limita recursos a permisos de vista reales', () => {
  const permissions = new Set<PermissionKey>(['content.view', 'blog.view'])
  assert.deepEqual(allowedTranslationResources(permissions), ['site_content', 'blog_post_translation'])
  assert.equal(allowedTranslationResources(new Set()).length, 0)
})

test('normaliza paginación y filtros sin aceptar tamaños arbitrarios', () => {
  assert.deepEqual(normalizeInventoryFilters({ page: '-2', pageSize: '999', q: '  title  ', status: 'stale' }), { page: 1, pageSize: 25, resourceType: undefined, language: undefined, status: 'stale', protection: undefined, query: 'title', selected: undefined, sort: 'updated_desc' })
  assert.equal(normalizeInventoryFilters({ page: '3', pageSize: '50' }).page, 3)
  assert.equal(normalizeInventoryFilters({ page: '3', pageSize: '50' }).pageSize, 50)
})

test('agrupa progreso editorial por recurso e idioma', () => {
  const states = [
    state({ target_language: 'en', status: 'reviewed', publication_status: 'published', is_protected: true }),
    state({ target_language: 'en', field_name: 'description', status: 'missing' }),
    state({ target_language: 'pt', status: 'stale' }),
    state({ target_language: 'pt', field_name: 'description', status: 'machine_translated', workflow_status: 'draft' }),
  ]
  assert.deepEqual(summarizeResourceStates(states), {
    total: 4, pending: 1, stale: 1, drafts: 1, inReview: 0, approved: 0, published: 1, protected: 1,
    languages: { en: { total: 2, translated: 1, reviewed: 1, published: 1 }, pt: { total: 2, translated: 2, reviewed: 0, published: 0 } },
  })
})

test('acciones agrupadas excluyen protegidos, publicados y borradores activos', () => {
  const missing = state({ status: 'missing' }), protectedMissing = state({ status: 'missing', is_protected: true })
  const draft = state({ status: 'machine_translated', workflow_status: 'draft' }), stale = state({ status: 'stale', target_language: 'pt' })
  assert.equal(isEligibleForBulkAction(missing, 'generate_pending'), true)
  assert.equal(isEligibleForBulkAction(protectedMissing, 'generate_pending'), false)
  assert.equal(isEligibleForBulkAction(draft, 'generate_pending'), false)
  assert.equal(isEligibleForBulkAction(stale, 'regenerate_stale'), true)
  assert.deepEqual(countEligibleByLanguage([missing, protectedMissing, stale], 'generate_pending', ['en', 'pt']), { en: 1, pt: 0 })
})

function state(overrides: Partial<TranslationStateRow>): TranslationStateRow {
  return {
    id: crypto.randomUUID(), resource_type: 'blog_post_translation', resource_id: 'resource', field_name: 'title', source_language: 'es', target_language: 'en', status: 'missing',
    translation_method: null, source_hash: 'hash', translated_source_hash: null, source_revision: 1, translated_revision: null, provider: null, is_protected: false,
    protection_reason: null, translated_at: null, reviewed_at: null, updated_at: new Date(0).toISOString(), last_error_code: null, last_error: null, publication_status: 'unpublished', workflow_status: 'none', lock_version: 1,
    ...overrides,
  }
}

test('resume únicamente estados reales y protección como dimensión separada', () => {
  const summary = summarizeStatuses({ missing: 4, queued: 1, machine_translated: 2, imported_unreviewed: 3, reviewed: 5, stale: 6, error: 2 }, 7)
  assert.deepEqual(summary, { total: 23, pending: 5, translated: 10, stale: 6, errors: 2, protected: 7 })
})
