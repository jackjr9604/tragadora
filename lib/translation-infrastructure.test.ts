import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '202610100001_translation_persistence_infrastructure.sql')
const sql = readFileSync(migrationPath, 'utf8')

test('la transición mantiene ES/EN/PT publicados sin cambiar las consultas públicas', () => {
  assert.match(sql, /where code in \('es', 'en', 'pt'\)/)
  assert.match(sql, /publication_status <> 'published' or is_active = true/)
  assert.doesNotMatch(sql, /create policy languages_public_read/)
})

test('global queda fuera de metadata y adaptadores traducibles', () => {
  assert.match(sql, /if p_language = 'global' then raise exception/)
  assert.match(sql, /s\.language<>'global'/)
  assert.match(sql, /source_language='global' or target_language='global'/)
})

test('los recursos y campos están enumerados y no usan SQL dinámico', () => {
  for (const token of [
    "('site_content', 'value'",
    "('platform_translation', 'short_description'",
    "('platform_translation', 'description'",
    "('platform_translation', 'pros'",
    "('platform_translation', 'cons'",
    "('platform_translation', 'seo_title'",
    "('platform_translation', 'seo_description'",
  ]) assert.ok(sql.includes(token), `Falta ${token}`)
  assert.doesNotMatch(sql, /execute\s+format\s*\(/i)
})

test('authenticated no recibe DML directo sobre estados ni jobs', () => {
  assert.match(sql, /revoke all on public\.translation_resource_types[\s\S]*from public, anon, authenticated;/)
  assert.match(sql, /grant select on public\.translation_resource_types[\s\S]*to authenticated;/)
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[\s\S]{0,180}translation_field_state[\s\S]{0,80}to authenticated/i)
})

test('la cola implementa idempotencia, exclusión y leases recuperables', () => {
  assert.match(sql, /unique \(logical_key, generation\)/)
  assert.match(sql, /translation_jobs_one_active_identity_idx/)
  assert.match(sql, /for update skip locked limit p_limit/)
  assert.match(sql, /translation_recover_expired_leases/)
  assert.match(sql, /lease_expires_at < now\(\)/)
  assert.match(sql, /source_hash, source_revision[\s\S]{0,100}where status in \('queued', 'running', 'retry_wait'\)/)
  assert.match(sql, /superseded_by_forced_regeneration/)
  assert.match(sql, /active_job\.status = 'running' and active_job\.lease_expires_at > now\(\)/)
  assert.match(sql, /pg_advisory_xact_lock/)
})

test('un resultado no puede sobrescribir una fuente nueva ni contenido protegido', () => {
  assert.match(sql, /state_row\.source_hash <> job\.source_hash/)
  assert.match(sql, /state_row\.source_revision <> job\.source_revision/)
  assert.match(sql, /if state_row\.is_protected then/)
  assert.match(sql, /cancelled_protected/)
  const failJob = sql.slice(
    sql.indexOf('create or replace function public.translation_fail_job'),
    sql.indexOf('-- Revisión y protección administrativas.'),
  )
  assert.match(failJob, /state_row\.source_hash <> job\.source_hash/)
  assert.match(failJob, /state_row\.source_revision <> job\.source_revision/)
  assert.match(failJob, /return 'cancelled_source_changed'/)
  assert.match(failJob, /source_hash=job\.source_hash and source_revision=job\.source_revision/)
})

test('las traducciones importadas no se revisan ni generan jobs automáticamente', () => {
  assert.match(sql, /'imported_unreviewed'/)
  assert.match(sql, /protection_reason[\s\S]{0,300}'imported'/)
  assert.match(sql, /if exists\(select 1 from public\.translation_jobs\)/)
  assert.doesNotMatch(sql, /insert into public\.translation_jobs[\s\S]{0,500}imported_unreviewed/i)
})

test('edición manual, aprobación, bloqueo y regeneración pasan por RPC', () => {
  for (const functionName of [
    'translation_save_manual',
    'translation_approve',
    'translation_set_protection',
    'translation_request_regeneration',
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${functionName}`))
  }
  assert.match(sql, /translation_method='manual'/)
  assert.match(sql, /error_code='manual_override'/)
  assert.match(sql, /p_expected_source_hash text[\s\S]{0,120}/)
  assert.match(sql, /p_expected_translation_hash text/)
  assert.match(sql, /El contenido cambió después de la revisión/)
  assert.match(sql, /actual_source_hash <> state_row\.source_hash/)
})

test('fallar un job exige el mismo lease vigente que completarlo', () => {
  const failJob = sql.slice(
    sql.indexOf('create or replace function public.translation_fail_job'),
    sql.indexOf('-- Revisión y protección administrativas.'),
  )
  assert.match(failJob, /job\.status <> 'running'/)
  assert.match(failJob, /job\.locked_by is distinct from p_worker_id/)
  assert.match(failJob, /job\.lease_expires_at is null/)
  assert.match(failJob, /job\.lease_expires_at <= now\(\)/)
  assert.ok(
    failJob.indexOf('from public.translation_field_state') < failJob.indexOf('where id=p_job_id for update'),
    'translation_fail_job debe bloquear state antes de job para evitar deadlocks',
  )
})

test('las RPC administrativas separan permisos de contenido y plataformas', () => {
  assert.match(sql, /when 'site_content' then 'content\.update'/)
  assert.match(sql, /when 'platform_translation' then 'platforms\.update'/)
  assert.match(sql, /perform public\.translation_assert_admin_permission\(p_resource_type\)/)
  assert.doesNotMatch(sql, /if public\.has_admin_permission\('content\.update'\)/)
  assert.match(sql, /grant execute on function public\.translation_approve\([^)]+\) to authenticated;/)
  assert.doesNotMatch(sql, /grant execute on function public\.translation_approve\([^)]+\) to authenticated, service_role;/)
})

test('fuentes borradas, vacías o deshabilitadas invalidan estados y jobs', () => {
  assert.match(sql, /translation_invalidate_source_internal/)
  assert.match(sql, /source_removed_or_untranslatable/)
  for (const resource of ['site_content', 'platform']) {
    for (const operation of ['insert', 'update', 'delete']) {
      assert.match(sql, new RegExp(`translation_${resource}_source_${operation}_trigger`))
    }
  }
  assert.match(sql, /translation_site_content_source_insert after insert on public\.site_content/)
  assert.match(sql, /translation_site_content_source_update after update on public\.site_content/)
  assert.match(sql, /translation_site_content_source_delete after delete on public\.site_content/)
  assert.match(sql, /translation_platform_source_insert after insert on public\.platform_translations/)
  assert.match(sql, /translation_platform_source_update after update on public\.platform_translations/)
  assert.match(sql, /translation_platform_source_delete after delete on public\.platform_translations/)
  assert.doesNotMatch(sql, /after insert or update or delete/)
  assert.match(sql, /translation_registry_disable_trigger/)
  assert.match(sql, /translation_source_language_disable_trigger/)
  assert.match(sql, /source_language_disabled/)
  assert.match(sql, /status = 'cancelled'[\s\S]{0,300}source_unavailable/)
})

test('las invalidaciones no se revierten mediante una excepción posterior', () => {
  for (const functionName of [
    'translation_enqueue_internal',
    'translation_approve',
    'translation_save_manual',
  ]) {
    const start = sql.indexOf(`create or replace function public.${functionName}`)
    const end = sql.indexOf('create or replace function public.', start + 1)
    const body = sql.slice(start, end === -1 ? undefined : end)
    const invalidation = body.indexOf('translation_invalidate_source_internal')
    assert.ok(invalidation >= 0, `${functionName} debe invalidar la fuente`)
    const returnMatch = body.slice(invalidation).match(/return(?: null)?;/)
    assert.ok(returnMatch?.index !== undefined, `${functionName} debe retornar tras invalidar`)
    const invalidationPath = body.slice(invalidation, invalidation + returnMatch.index + returnMatch[0].length)
    assert.doesNotMatch(invalidationPath, /raise exception[^;]+;/)
  }
})

test('funciones definer fijan search_path y validan tipos reales', () => {
  assert.doesNotMatch(sql, /set search_path\s*=\s*[^\n;]*auth/i)
  assert.match(sql, /extensions\.digest\(pg_catalog\.convert_to/)
  assert.match(sql, /platform_translations\.pros\/cons deben ser jsonb/)
  assert.match(sql, /pros_type is distinct from 'jsonb'/)
  assert.match(sql, /cons_type is distinct from 'jsonb'/)
  assert.match(sql, /jsonb_array_elements\(p_value\)/)
  assert.match(sql, /jsonb_typeof\(element\) <> 'string'/)
  assert.match(sql, /jsonb_typeof\(p_value\) <> 'string'/)
  assert.match(sql, /pros = case when p_field_name = 'pros'[\s\S]{0,100}then excluded\.pros/)
  assert.match(sql, /cons = case when p_field_name = 'cons'[\s\S]{0,100}then excluded\.cons/)
  assert.doesNotMatch(sql, /array_value text\[\]/)
  assert.match(sql, /revoke all on function public\.translation_assert_admin_permission\(text\) from public, anon, authenticated/)
})

test('platform_translations se escribe con un único UPSERT completo', () => {
  const writeValue = sql.slice(
    sql.indexOf('create or replace function public.translation_write_value'),
    sql.indexOf('-- Registro de cambios e idempotencia.'),
  )
  assert.match(writeValue, /insert into public\.platform_translations \([\s\S]*short_description[\s\S]*pros[\s\S]*seo_description/)
  assert.match(writeValue, /on conflict \(platform_id, language\) do update set/)
  assert.doesNotMatch(writeValue, /on conflict \(platform_id, language\) do nothing/)
  assert.doesNotMatch(writeValue, /update public\.platform_translations set/)
})

test('las funciones de worker solo se conceden a service_role', () => {
  for (const signature of [
    'translation_claim_jobs(text,integer,integer,text)',
    'translation_recover_expired_leases(integer)',
    'translation_complete_job(uuid,text,jsonb,text,jsonb)',
    'translation_fail_job(uuid,text,text,text,boolean)',
  ]) {
    const escaped = signature.replace(/[()]/g, '\\$&')
    assert.match(sql, new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated;`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${escaped} to service_role;`))
  }
})
