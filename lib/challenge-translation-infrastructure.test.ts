import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/202610100003_challenge_translations.sql', 'utf8')

test('mantiene identidad por registro e idioma sin copiar datos financieros', () => {
  for (const identity of ['phase_id', 'variant_id', 'variant_phase_id', 'account_plan_id', 'reward_option_id']) {
    assert.match(sql, new RegExp(`primary key \\(${identity}, language\\)`, 'i'))
  }
  const tableDefinitions = sql.slice(0, sql.indexOf("insert into public.translation_resource_types"))
  for (const technical of ['account_size', 'price numeric', 'currency text', 'profit_target', 'daily_drawdown', 'max_drawdown', 'profit_split numeric']) {
    assert.doesNotMatch(tableDefinitions, new RegExp(technical, 'i'))
  }
})

test('registra únicamente los nueve campos editoriales aprobados', () => {
  const expected = [
    ['challenge_phase_translation', 'name'], ['challenge_phase_translation', 'notes'],
    ['challenge_variant_translation', 'payout_frequency'], ['challenge_variant_translation', 'notes'],
    ['challenge_variant_phase_translation', 'notes'], ['account_plan_translation', 'payout_frequency'],
    ['challenge_reward_translation', 'name'], ['challenge_reward_translation', 'payout_frequency'],
    ['challenge_reward_translation', 'notes'],
  ]
  for (const [resource, field] of expected) assert.match(sql, new RegExp(`'${resource}','${field}'`))
  assert.doesNotMatch(sql, /insert into public\.translation_jobs/i)
})

test('protege adaptadores, usa permiso challenges y separa triggers por operación', () => {
  assert.match(sql, /then 'challenges\.update'/i)
  assert.match(sql, /has_admin_permission\('challenges\.view'\)/i)
  assert.match(sql, /translation_challenge_source_insert_trigger/i)
  assert.match(sql, /translation_challenge_source_update_trigger/i)
  assert.match(sql, /translation_challenge_source_delete_trigger/i)
  assert.match(sql, /revoke all on function public\.translation_write_challenge_value/i)
  assert.match(sql, /revoke all on function public\.translation_read_value_before_challenges\(text,text,text,text\) from public,anon,authenticated/i)
  assert.match(sql, /revoke all on function public\.translation_write_value_before_challenges\(text,text,text,text,jsonb,uuid\) from public,anon,authenticated/i)
})

test('la inicialización no escribe traducciones ni crea trabajos', () => {
  const initialization = sql.slice(sql.indexOf('-- Inicializa solamente metadata'))
  assert.doesNotMatch(initialization, /insert into public\.(challenge_phase_translations|challenge_variant_translations|challenge_variant_phase_translations|account_plan_translations|challenge_reward_translations)/i)
  assert.match(initialization, /if exists\(select 1 from public\.translation_jobs/i)
})
