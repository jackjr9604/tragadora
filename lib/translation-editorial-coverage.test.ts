import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/202610270001_translation_editorial_coverage.sql', 'utf8')
const server = readFileSync('lib/admin-content-center.ts', 'utf8')
const page = readFileSync('app/admin/content-center/page.tsx', 'utf8')
const inventory = readFileSync('scripts/sql/translation-editorial-coverage-readonly.sql', 'utf8')
const payoutAudit = readFileSync('scripts/sql/payout-frequency-translation-audit-readonly.sql', 'utf8')

test('pendiente significa que el campo todavía no es publicable y vigente', () => {
  for (const predicate of [
    "publication_status='published'",
    'translated_source_hash=s.source_hash',
    'translated_revision=s.source_revision',
    "status='reviewed'",
    "status='imported_unreviewed' and s.is_protected",
  ]) assert.match(migration, new RegExp(predicate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(migration, /\) is not true\)::bigint/)
  assert.doesNotMatch(migration, /p_bucket='pending' and l\.pending_count>0[\s\S]*status in \('missing','queued'\)/)
})

test('cobertura usa idiomas publicados y no modifica estados editoriales', () => {
  assert.match(migration, /join public\.languages/)
  assert.match(migration, /l\.is_active and not l\.is_default and l\.publication_status='published'/)
  assert.match(migration, /automatic_review_fields/)
  assert.match(migration, /status='machine_translated'/)
  assert.doesNotMatch(migration, /\b(update|insert into|delete from)\s+public\.translation_field_state\b/i)
})

test('RPC de cobertura queda restringida al servidor y la UI distingue cifras reales', () => {
  assert.match(migration, /auth\.role\(\)<>'service_role'/)
  assert.match(migration, /revoke all on function public\.translation_admin_language_coverage\(text\[\]\) from public,anon,authenticated/)
  assert.match(migration, /grant execute on function public\.translation_admin_language_coverage\(text\[\]\) to service_role/)
  assert.match(server, /translation_admin_language_coverage/)
  for (const label of ['Completados', 'Pendientes', 'Automáticas por revisar', 'Obsoletas', 'Protegidas', 'Errores']) assert.match(page, new RegExp(label))
})

test('inventario manual es de solo lectura y comparte la definición de completitud', () => {
  assert.doesNotMatch(inventory, /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke)\b/i)
  assert.match(inventory, /publication_status = 'published'/)
  assert.match(inventory, /translated_source_hash = s\.source_hash/)
  assert.match(inventory, /translated_revision = s\.source_revision/)
  assert.match(inventory, /status = 'imported_unreviewed' and s\.is_protected/)
  assert.match(inventory, /target_language in \('en', 'pt'\)/)
})

test('payout_frequency nulo no infla cobertura y la reutilización exige igualdad exacta', () => {
  assert.match(migration, /nullif\(btrim\(ap\.payout_frequency\),'\'\) is not null/)
  assert.doesNotMatch(payoutAudit, /\blower\s*\(|regexp_replace|unaccent/i)
  assert.match(payoutAudit, /join donors d using \(source_hash, target_language\)/)
  assert.match(payoutAudit, /s\.status = 'reviewed'/)
  assert.match(payoutAudit, /s\.publication_status = 'published'/)
  assert.match(payoutAudit, /not s\.is_protected/)
  assert.match(payoutAudit, /s\.workflow_status = 'none'/)
  assert.doesNotMatch(payoutAudit, /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke)\b/i)
})
