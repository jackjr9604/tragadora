import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/202610240002_admin_offer_transactional_writes.sql', 'utf8')
const precheck = readFileSync('scripts/sql/admin-offer-transactional-writes-precheck.sql', 'utf8')
const postcheck = readFileSync('scripts/sql/admin-offer-transactional-writes-postcheck.sql', 'utf8')
const postgresTest = readFileSync('scripts/sql/admin-offer-transactional-writes-postgres-test.sql', 'utf8')
const concurrencyTest = readFileSync('scripts/sql/admin-offer-transactional-writes-concurrency-test.sql', 'utf8')
const localPrestate = readFileSync('scripts/sql/admin-offer-transactional-writes-local-prestate.sql', 'utf8')
const runner = readFileSync('scripts/run-admin-offer-transactional-writes-postgres.ps1', 'utf8')

test('RPC de ofertas usa seguridad y permisos mínimos', () => {
  assert.match(migration, /admin_save_offer\(\s*p_offer_id uuid,\s*p_expected_updated_at timestamptz,\s*p_creation_request_id uuid,\s*p_payload jsonb/i)
  assert.match(migration, /admin_set_offer_status\(\s*p_offer_id uuid,\s*p_expected_updated_at timestamptz,\s*p_status boolean/i)
  assert.equal((migration.match(/security definer/gi) ?? []).length, 2)
  assert.match(migration, /set search_path = pg_catalog, public/gi)
  assert.match(migration, /revoke all on function public\.admin_save_offer\(uuid,timestamptz,uuid,jsonb\) from public,anon,authenticated,service_role/i)
  assert.match(migration, /grant execute on function public\.admin_save_offer\(uuid,timestamptz,uuid,jsonb\) to authenticated/i)
  assert.match(migration, /revoke insert,update,delete on table public\.offers from public,anon,authenticated/i)
})

test('valida relaciones, payload cerrado y concurrencia antes de escribir', () => {
  assert.match(migration, /jsonb_object_keys\(p_payload\)/i)
  assert.match(migration, /p\.type in \('prop_firm','broker','exchange'\)\s+for share/i)
  assert.match(migration, /c\.platform_id=next_platform_id for share/i)
  assert.match(migration, /a\.platform_id=next_platform_id for share/i)
  assert.match(migration, /from public\.countries c where c\.code=next_country_code for share/i)
  assert.match(migration, /from public\.languages l where l\.code=next_language and l\.is_active for share/i)
  assert.match(migration, /from public\.offers o where o\.id=p_offer_id for update/i)
  assert.match(migration, /current_row\.updated_at is distinct from p_expected_updated_at/i)
  assert.match(migration, /before insert or update on public\.offers/i)
  assert.match(migration, /insert into public\.admin_audit_log/i)
  assert.match(migration, /not isfinite\(next_starts_at\)/i)
  assert.match(migration, /not isfinite\(next_expires_at\)/i)
  assert.match(migration, /foreign key \(challenge_id, platform_id\)[\s\S]*on delete set null \(challenge_id\)/i)
  assert.match(migration, /foreign key \(affiliate_link_id, platform_id\)[\s\S]*on delete set null \(affiliate_link_id\)/i)
  assert.match(migration, /unique \(id, platform_id\)/i)
})

test('precheck y postcheck son read-only y la prueba PostgreSQL revierte fixtures', () => {
  for (const sql of [precheck, postcheck]) {
    assert.match(sql, /begin transaction read only/i)
    assert.match(sql, /rollback/i)
    assert.doesNotMatch(sql, /\b(insert|update|delete)\s+(into|public\.|from)/i)
  }
  assert.match(postgresTest, /tradagora_local_e2e_guard/i)
  assert.match(postgresTest, /select 'PASS' as result/i)
  assert.match(postgresTest, /rollback;\s*$/i)
  assert.match(postgresTest, /set local role authenticated/i)
  assert.match(postgresTest, /set local role anon/i)
  assert.match(postgresTest, /set local role service_role/i)
  assert.match(postgresTest, /authenticated conserva DML directo sobre offers/i)
  assert.match(postgresTest, /replayed/i)
  assert.match(precheck, /PRECHECK: faltan dependencias/i)
  assert.match(postcheck, /POSTCHECK: seguridad inválida/i)
  assert.match(postcheck, /POSTCHECK: triggers de offers incompletos/i)
  assert.match(postcheck, /POSTCHECK: restricciones relacionales estructurales incorrectas/i)
  assert.match(precheck, /PRECHECK: existen ofertas con challenge ausente o de otra plataforma/i)
})

test('concurrencia usa dos conexiones reales y cubre todas las relaciones bloqueadas', () => {
  assert.match(concurrencyTest, /dblink_connect\('offer_a'/i)
  assert.match(concurrencyTest, /dblink_connect\('offer_b'/i)
  assert.match(concurrencyTest, /same_offer/i)
  assert.match(concurrencyTest, /idempotent_create/i)
  for (const race of ['platform_type', 'challenge_platform', 'affiliate_platform', 'language_active', 'country_delete']) {
    assert.match(concurrencyTest, new RegExp(race, 'i'))
  }
  assert.match(concurrencyTest, /result='conflict'/i)
  assert.match(concurrencyTest, /rejected_constraint:offers_challenge_platform_fkey/i)
  assert.match(concurrencyTest, /rejected_constraint:offers_affiliate_link_platform_fkey/i)
  assert.match(concurrencyTest, /get stacked diagnostics rejected_constraint_name=constraint_name/i)
  assert.doesNotMatch(concurrencyTest, /when check_violation then return 'rejected_constraint'/i)
  assert.match(concurrencyTest, /result<>'committed'/i)
  assert.match(concurrencyTest, /e2e_wait_for_backend_waiting/i)
  assert.doesNotMatch(concurrencyTest, /set_config\('lock_timeout'/i)
  assert.match(concurrencyTest, /statement_timeout='15s'/i)
  assert.match(concurrencyTest, /E2E_FORCE_TIMEOUT/i)
  assert.match(concurrencyTest, /select 'PASS' as result/i)
})

test('runner aísla bases temporales y limpia también los escenarios negativos', () => {
  assert.match(localPrestate, /tradagora_offer_c5c1f_/i)
  assert.match(localPrestate, /tradagora_local_e2e_guard/i)
  assert.match(runner, /finally[\s\S]*Remove-TemporaryDatabase/i)
  assert.match(runner, /createdDatabases\.Contains/i)
  assert.match(runner, /forced-failure/i)
  assert.match(runner, /forced-timeout/i)
  assert.match(runner, /Test-DatabaseExists/i)
  assert.match(runner, /supabase\/postgres:15/i)
  assert.doesNotMatch(runner, /--linked|db push|supabase\.co/i)
})
