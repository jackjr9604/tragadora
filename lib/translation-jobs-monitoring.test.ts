import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sql=readFileSync('supabase/migrations/202610150001_translation_jobs_monitoring.sql','utf8')
const precheck=readFileSync('scripts/sql/translation-jobs-monitoring-precheck.sql','utf8')
const postcheck=readFileSync('scripts/sql/translation-jobs-monitoring-postcheck.sql','utf8')

test('3E.8 3.1A añade solo lectura administrativa y heartbeat sin alterar la cola',()=>{
  assert.match(sql,/create table if not exists public\.translation_worker_instances/i)
  for(const rpc of ['translation_worker_heartbeat','translation_admin_jobs_inventory','translation_admin_jobs_summary','translation_admin_worker_status'])assert.match(sql,new RegExp(`create or replace function public\\.${rpc}`,'i'))
  assert.doesNotMatch(sql,/update public\.translation_jobs|delete from public\.translation_jobs|insert into public\.translation_jobs/i)
  assert.doesNotMatch(sql,/endpoint|api_key|service_role_key|translated_value|draft_value/i)
})

test('RPC e información de heartbeat quedan restringidas a service_role',()=>{
  assert.match(sql,/alter table public\.translation_worker_instances enable row level security/i)
  assert.match(sql,/revoke all on public\.translation_worker_instances from public,anon,authenticated/i)
  for(const rpc of ['translation_worker_heartbeat','translation_admin_jobs_inventory','translation_admin_jobs_summary','translation_admin_worker_status']){
    assert.match(sql,new RegExp(`revoke all on function public\\.${rpc}[\\s\\S]*from public,anon,authenticated`,'i'))
    assert.match(sql,new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*to service_role`,'i'))
  }
})

test('inventario limita filtros, orden y paginación y cuenta fuera de la página',()=>{
  assert.match(sql,/p_page_size not between 1 and 50/i)
  assert.match(sql,/p_sort not in \('created_desc','created_asc','updated_desc'\)/i)
  assert.match(sql,/count\(\*\) over\(\)/i)
  assert.match(sql,/translation_admin_jobs_summary/i)
  for(const index of ['jobs_created_admin_idx','status_created_admin_idx','resource_status_created_admin_idx','resource_identity_created_admin_idx','language_status_created_admin_idx','source_language_status_created_admin_idx','error_created_admin_idx','requested_provider_created_admin_idx','provider_used_created_admin_idx'])assert.match(sql,new RegExp(index,'i'))
  assert.match(sql,/lower\(j\.requested_provider\)=lower\(p_provider\) or lower\(j\.provider_used\)=lower\(p_provider\)/i)
})

test('precheck y postcheck no escriben datos ni esquema',()=>{
  const executable=(source:string)=>source.replace(/^\s*--.*$/gm,'')
  for(const check of [precheck,postcheck]){
    assert.doesNotMatch(executable(check),/\b(insert|update|delete|truncate|merge|create|alter|drop|grant|revoke)\b/i)
  }
  assert.match(precheck,/\('translation_jobs','estimated_cost_usd','numeric'\)/i)
  assert.doesNotMatch(postcheck,/translation_worker_heartbeat\s*\(/i)
  assert.match(postcheck,/\bbegin\s*;[\s\S]*\brollback\s*;/i)
})
