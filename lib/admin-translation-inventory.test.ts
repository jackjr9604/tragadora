import assert from 'node:assert/strict'
import test from 'node:test'
import { allowedTranslationResources, normalizeInventoryFilters, summarizeStatuses } from './admin-translation-inventory-policy'
import type { PermissionKey } from './admin-permissions'

test('inventario limita recursos a permisos de vista reales', () => {
  const permissions = new Set<PermissionKey>(['content.view', 'blog.view'])
  assert.deepEqual(allowedTranslationResources(permissions), ['site_content', 'blog_post_translation'])
  assert.equal(allowedTranslationResources(new Set()).length, 0)
})

test('normaliza paginación y filtros sin aceptar tamaños arbitrarios', () => {
  assert.deepEqual(normalizeInventoryFilters({ page: '-2', pageSize: '999', q: '  title  ', status: 'stale' }), { page: 1, pageSize: 25, resourceType: undefined, language: undefined, status: 'stale', protection: undefined, query: 'title', selected: undefined })
  assert.equal(normalizeInventoryFilters({ page: '3', pageSize: '50' }).page, 3)
  assert.equal(normalizeInventoryFilters({ page: '3', pageSize: '50' }).pageSize, 50)
})

test('resume únicamente estados reales y protección como dimensión separada', () => {
  const summary = summarizeStatuses({ missing: 4, queued: 1, machine_translated: 2, imported_unreviewed: 3, reviewed: 5, stale: 6, error: 2 }, 7)
  assert.deepEqual(summary, { total: 23, pending: 5, translated: 10, stale: 6, errors: 2, protected: 7 })
})
