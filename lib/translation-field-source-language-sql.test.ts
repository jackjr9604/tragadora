import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/202610270002_translation_field_source_language.sql', import.meta.url), 'utf8')

test('la migración declara la fuente EN por campo y conserva estados EN históricos', () => {
  assert.match(sql, /add column if not exists source_language_override/i)
  assert.match(sql, /set source_language_override='en'[\s\S]*resource_type='account_plan_translation' and field_name='payout_frequency'/i)
  assert.doesNotMatch(sql, /delete from public\.translation_field_state/i)
  assert.match(sql, /target_language<>public\.translation_effective_source_language/i)
})

test('solo ES y PT son destinos automáticos para payout_frequency', () => {
  assert.match(sql, /source_language_reclassified[\s\S]*target_language='en'/i)
  assert.match(sql, /target_language='es'/i)
  assert.match(sql, /source_language='en'[\s\S]*target_language='pt'/i)
  assert.match(sql, /source_language_target/)
  assert.match(sql, /source_language_mismatch/)
})

test('NULL y borradores protegidos no se sobrescriben', () => {
  assert.match(sql, /nullif\(btrim\(ap\.payout_frequency\),' '\)|nullif\(btrim\(ap\.payout_frequency\),''\)/i)
  assert.match(sql, /is_protected or publication_status='published' or workflow_status<>'none'/i)
  assert.match(sql, /s\.is_protected then raise exception/i)
})
