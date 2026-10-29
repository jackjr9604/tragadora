import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration=readFileSync('supabase/migrations/202610270004_translation_initial_load_runner.sql','utf8')
const runner=readFileSync('scripts/run-translation-initial-load.ts','utf8')

test('la carga temporal es service_role, acotada y nunca aprueba ni publica',()=>{
  assert.match(migration,/budget_scope','initial_exact_group_load'/)
  assert.match(migration,/max_groups between 1 and 4000/)
  assert.match(migration,/grant execute[\s\S]*to service_role/)
  assert.doesNotMatch(migration,/set[\s\S]{0,200}publication_status\s*=\s*'published'/)
  assert.doesNotMatch(migration,/set[\s\S]{0,200}workflow_status\s*=\s*'approved'/)
  assert.match(migration,/translation\.initial_load\.apply/)
})

test('el runner exige confirmación remota, usa dos workers y corta por memoria o errores',()=>{
  assert.match(runner,/--allow-production/)
  assert.match(runner,/TRANSLATION_INITIAL_LOAD_APPROVED/)
  assert.match(runner,/workers: integer\(value\('--workers'\), 2, 1, 2\)/)
  assert.match(runner,/freemem\(\)/)
  assert.match(runner,/maxErrorRate/)
})
