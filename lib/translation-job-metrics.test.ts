import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { normalizeTranslationJobFilters } from './admin-translation-jobs-policy'

const migration=readFileSync('supabase/migrations/202610160001_translation_job_operational_metrics.sql','utf8')
const page=readFileSync('app/admin/content-center/jobs/page.tsx','utf8')
const server=readFileSync('lib/admin-content-center.ts','utf8')

test('periodos operativos se normalizan sin aceptar valores arbitrarios',()=>{
  assert.equal(normalizeTranslationJobFilters({metricsPeriod:'7d'}).metricsPeriod,'7d')
  assert.equal(normalizeTranslationJobFilters({metricsPeriod:'30d'}).metricsPeriod,'30d')
  assert.equal(normalizeTranslationJobFilters({metricsPeriod:'1y'}).metricsPeriod,'24h')
})

test('RPC de métricas es read-only, restringida y no expone errores crudos',()=>{
  assert.match(migration,/create or replace function public\.translation_admin_jobs_metrics/i)
  assert.match(migration,/security definer[\s\S]*set search_path=pg_catalog,public/i)
  assert.match(migration,/revoke all on function public\.translation_admin_jobs_metrics\(text\[\],text,text,text,text,text,text\) from public,anon,authenticated/i)
  assert.match(migration,/grant execute on function public\.translation_admin_jobs_metrics\(text\[\],text,text,text,text,text,text\) to service_role/i)
  const body=migration.match(/as \$\$([\s\S]*?)\$\$;/i)?.[1]??''
  assert.doesNotMatch(body,/\b(insert into|update|delete from|merge into)\s+public\./i)
  const returns=migration.match(/returns table\(([\s\S]*?)\)\nlanguage/i)?.[1]??''
  assert.doesNotMatch(returns,/last_error|metadata|worker|hash|credential|endpoint/i)
})

test('métricas conservan null, usan periodos y clasificación segura de 3.2A',()=>{
  for(const category of ['recoverable_connectivity','lease_expired','source_unavailable','editorial_conflict','protected_content_validation','unknown'])assert.match(migration,new RegExp(category))
  assert.match(migration,/terminal\.succeeded_count::numeric\/nullif\(terminal\.terminal_count,0\)/i)
  assert.match(migration,/case when count\(\*\)>=2 then percentile_cont\(0\.5\)[\s\S]*?::numeric p50_seconds/i)
  assert.match(migration,/case when count\(\*\)>=5 then percentile_cont\(0\.95\)[\s\S]*?::numeric p95_seconds/i)
  assert.match(migration,/translation_jobs_resource_completed_metrics_idx/i)
  assert.match(migration,/j\.status in \('succeeded','failed','cancelled'\)[\s\S]*j\.completed_at>=v_period_started_at/i)
  assert.match(migration,/select min\(j\.created_at\) oldest from public\.translation_jobs j[\s\S]*j\.status in \('queued','retry_wait'\)/i)
  assert.match(migration,/sum\(coalesce\(p\.input_characters,0\)::bigint\+coalesce\(p\.output_characters,0\)::bigint\)::bigint/i)
})

test('pestaña integra métricas sin duplicar inventario ni perder filtros',()=>{
  assert.match(server,/rpc\('translation_admin_jobs_metrics'/)
  assert.match(server,/p_allowed_resource_types: allowed/)
  assert.match(page,/Métricas operativas/)
  assert.match(page,/Periodo de métricas/)
  assert.match(page,/No depende de la página actual/)
  assert.match(page,/Sin datos/)
  assert.doesNotMatch(page,/getRecentTranslationJobs/)
})
