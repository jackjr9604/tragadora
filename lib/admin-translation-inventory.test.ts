import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { allowedTranslationResources, normalizeInventoryFilters, summarizeStatuses } from './admin-translation-inventory-policy'
import { countEligibleByLanguage, isEligibleForBulkAction, summarizeEditorialStages, summarizeResourceStates, translationEditorRows, translationFieldLabel } from './admin-translation-resource-policy'
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

test('el resumen editorial no cuenta un campo en más de una etapa', () => {
  const states = [
    state({ status: 'missing' }), state({ status: 'machine_translated', workflow_status: 'draft' }),
    state({ status: 'reviewed', workflow_status: 'in_review' }), state({ status: 'reviewed', workflow_status: 'approved' }),
    state({ status: 'reviewed', workflow_status: 'approved', publication_status: 'published' }), state({ status: 'stale', publication_status: 'published' }),
  ]
  const summary = summarizeEditorialStages(states)
  assert.deepEqual(summary, { pending: 1, drafts: 1, inReview: 1, approved: 1, published: 1, stale: 1 })
  assert.equal(Object.values(summary).reduce((total, value) => total + value, 0), states.length)
})

test('los editores adaptan altura y presentan nombres amigables sin ocultar el identificador', () => {
  assert.equal(translationEditorRows('title', 'text', 120), 4)
  assert.equal(translationEditorRows('short_description', 'text', 500), 8)
  assert.equal(translationEditorRows('body_markdown', 'rich_text', null), 18)
  assert.equal(translationFieldLabel('seo_description'), 'Descripción SEO')
  assert.equal(translationFieldLabel('custom_field'), 'Custom Field')
  const editor = readFileSync('components/admin/translations/TranslationResourceEditor.tsx', 'utf8')
  assert.match(editor, /xl:sticky/)
  assert.doesNotMatch(editor, /className="sticky top-3/)
})

test('acciones agrupadas excluyen protegidos, publicados y borradores activos', () => {
  const missing = state({ status: 'missing' }), protectedMissing = state({ status: 'missing', is_protected: true })
  const draft = state({ status: 'machine_translated', workflow_status: 'draft' }), stale = state({ status: 'stale', target_language: 'pt' })
  assert.equal(isEligibleForBulkAction(missing, 'generate_pending'), true)
  assert.equal(isEligibleForBulkAction(protectedMissing, 'generate_pending'), false)
  assert.equal(isEligibleForBulkAction(draft, 'generate_pending'), false)
  assert.equal(isEligibleForBulkAction(stale, 'regenerate_stale'), true)
  assert.deepEqual(countEligibleByLanguage([missing, protectedMissing, stale], 'generate_pending', ['en', 'pt']), { en: 1, pt: 0 })
  assert.equal(isEligibleForBulkAction(state({ publication_status: 'published', workflow_status: 'approved' }), 'withdraw'), true)
  assert.equal(isEligibleForBulkAction(state({ publication_status: 'unpublished', workflow_status: 'approved' }), 'withdraw'), false)
})

test('el editor unificado conserva contexto, idiomas dinámicos y actividad del recurso', () => {
  const page=readFileSync('app/admin/content-center/translations/[resourceType]/[resourceId]/page.tsx','utf8')
  const editor=readFileSync('components/admin/translations/TranslationResourceEditor.tsx','utf8')
  assert.match(page,/safeContentCenterReturn/)
  assert.match(page,/getTranslationResourceJobs/)
  assert.match(page,/Contenido original/)
  assert.match(editor,/props\.languages/)
  assert.match(editor,/applicable\.map/)
  assert.match(editor,/intent: 'withdraw'/)
})

test('las consultas del Centro a translation_jobs usan únicamente columnas del esquema versionado', () => {
  const sql = readFileSync('supabase/migrations/202610100001_translation_persistence_infrastructure.sql', 'utf8')
  const table = sql.match(/create table if not exists public\.translation_jobs\s*\(([\s\S]*?)\n\);/i)
  assert.ok(table, 'No se encontró la definición versionada de translation_jobs')
  const columns = new Set(Array.from(table[1].matchAll(/^\s{2}([a-z_][a-z0-9_]*)\s+/gim), (match) => match[1]))
  for (const path of ['lib/admin-translation-inventory.ts', 'lib/admin-content-center.ts']) {
    const source = readFileSync(path, 'utf8')
    const queries = Array.from(source.matchAll(/from\('translation_jobs'\)[\s\S]*?\.select\('([^']+)'\)/g), (match) => match[1])
    assert.ok(queries.length > 0, `${path} debe conservar una consulta explícita a translation_jobs`)
    for (const selection of queries) for (const column of selection.split(',')) {
      assert.ok(columns.has(column), `${path} consulta la columna inexistente translation_jobs.${column}`)
    }
  }
})

test('los editores especializados enlazan identidades traducibles existentes y conservan retorno', () => {
  const files = [
    'components/admin/DiscoveryForms.tsx', 'app/admin/exchanges/[id]/edit/page.tsx', 'app/admin/offers/[id]/page.tsx',
    'components/admin/challenges/AccountPlansManager.tsx', 'components/admin/challenges/ChallengePhasesManager.tsx',
    'components/admin/challenges/ChallengeVariantsManager.tsx', 'app/admin/challenges/[id]/page.tsx',
  ].map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const resourceType of ['blog_post_translation','community_translation','giveaway_translation','exchange_detail_translation','offer_translation','account_plan_translation','challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','challenge_reward_translation']) {
    assert.match(files, new RegExp(resourceType))
  }
  assert.match(files, /returnTo=/)
  assert.match(readFileSync('components/admin/DiscoveryForms.tsx','utf8'), /editing&&params\.id&&resourceType/)
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
